// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildListingShareUrl,
  copyWithDomFallback,
  isShareCancellation,
  shareListing,
  type ListingSharePayload,
} from "./listing-share";

const payload: ListingSharePayload = {
  title: "Sunny studio",
  text: "10 Main Road, Cape Town",
  url: "https://roomza.example/listing/listing-123",
};

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("listing share URL", () => {
  it("builds a canonical listing URL without discovery state", () => {
    expect(buildListingShareUrl("https://roomza.example/discover?q=sea&listingId=old", "listing 123")).toBe(
      "https://roomza.example/listing/listing%20123",
    );
  });
});

describe("shareListing", () => {
  it("uses native sharing when the payload is supported", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    const writeText = vi.fn();

    await expect(
      shareListing(payload, { navigator: { share, canShare, clipboard: { writeText } } }),
    ).resolves.toBe("shared");
    expect(canShare).toHaveBeenCalledWith(payload);
    expect(share).toHaveBeenCalledWith(payload);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("treats native cancellation as neutral and does not copy", async () => {
    const writeText = vi.fn();
    const share = vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError"));

    await expect(
      shareListing(payload, { navigator: { share, clipboard: { writeText } } }),
    ).resolves.toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
    expect(isShareCancellation({ name: "AbortError" })).toBe(true);
  });

  it("copies after a non-cancellation native share failure", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const share = vi.fn().mockRejectedValue(new DOMException("Blocked", "NotAllowedError"));

    await expect(
      shareListing(payload, { navigator: { share, clipboard: { writeText } } }),
    ).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith(payload.url);
  });

  it("skips native sharing when canShare rejects the payload", async () => {
    const share = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(
      shareListing(payload, {
        navigator: { share, canShare: () => false, clipboard: { writeText } },
      }),
    ).resolves.toBe("copied");
    expect(share).not.toHaveBeenCalled();
  });

  it("uses the legacy DOM copy fallback without Clipboard API access", async () => {
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", { configurable: true, value: execCommand });

    await expect(shareListing(payload, { navigator: {}, document })).resolves.toBe("copied");
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("falls through to the DOM copy fallback when Clipboard API access fails", async () => {
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", { configurable: true, value: execCommand });

    await expect(
      shareListing(payload, {
        navigator: { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("Denied")) } },
        document,
      }),
    ).resolves.toBe("copied");
  });

  it("requires manual copying when every automatic path fails", async () => {
    Object.defineProperty(document, "execCommand", { configurable: true, value: vi.fn().mockReturnValue(false) });

    await expect(
      shareListing(payload, {
        navigator: { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("Denied")) } },
        document,
      }),
    ).resolves.toBe("manual-copy-required");
  });
});

describe("copyWithDomFallback", () => {
  it("restores focus after copying", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    Object.defineProperty(document, "execCommand", { configurable: true, value: vi.fn().mockReturnValue(true) });

    expect(copyWithDomFallback(document, payload.url)).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });
});
