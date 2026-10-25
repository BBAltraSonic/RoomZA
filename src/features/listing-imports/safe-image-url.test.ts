import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dns = vi.hoisted(() => ({ resolve4: vi.fn(), resolve6: vi.fn() }));
vi.mock("node:dns/promises", () => dns);
// These tests exercise URL/DNS/redirect/byte policy. Native socket/TLS behavior
// has a separate contained connection suite, not a global-fetch simulation.
vi.mock("./node-image-transport", () => ({ hasNativeNodeHttps: false }));
vi.mock("./edge-image-transport", () => ({
  // Policy-only fixture; the real authenticated hop has separate socket/runtime checks.
  fetchPinnedEdgeImage: (url: URL, _addresses: string[], signal: AbortSignal) => fetch(url, {
    redirect: "manual", headers: { accept: "image/jpeg,image/png,image/webp" }, signal,
  }),
}));

import { IMPORT_LIMITS } from "./limits";
import { detectImageMime, fetchSafeImage, isPublicAddress } from "./safe-image-url";

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("import image download boundaries", () => {
  beforeEach(() => {
    dns.resolve4.mockReset().mockResolvedValue(["8.8.8.8"]);
    dns.resolve6.mockReset().mockResolvedValue([]);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("recognizes complete supported signatures and refuses unrelated bytes", () => {
    expect(detectImageMime(png)).toBe("image/png");
    expect(detectImageMime(Uint8Array.from([0xff, 0xd8, 0xff]))).toBe("image/jpeg");
    expect(detectImageMime(new TextEncoder().encode("RIFF1234WEBP"))).toBe("image/webp");
    expect(detectImageMime(new TextEncoder().encode("not an image"))).toBeNull();
  });

  it("refuses empty or truncated PNG signatures instead of registering them as images", () => {
    for (let length = 0; length < png.length; length += 1) {
      expect(detectImageMime(png.slice(0, length)), `PNG prefix of ${length} bytes`).toBeNull();
    }
  });

  it("refuses equivalent IPv6 loopback, local and mapped private-network spellings", () => {
    const denied = [
      "0:0:0:0:0:0:0:0", "0:0:0:0:0:0:0:1", "fc00::1", "fe80::1",
      "::ffff:172.16.0.1", "::ffff:169.254.169.254", "::ffff:100.64.0.1",
      "::ffff:7f00:1", "::ffff:ac10:1", "0:0:0:0:0:ffff:c0a8:1",
    ];
    for (const address of denied) expect(isPublicAddress(address), address).toBe(false);
  });

  it("continues to allow public IPv4, IPv6 and public mapped IPv4 addresses", () => {
    for (const address of ["8.8.8.8", "2606:4700:4700::1111", "::ffff:8.8.8.8", "::ffff:808:808"]) {
      expect(isPublicAddress(address), address).toBe(true);
    }
  });

  it("does not fetch a host whose DNS answer mixes a public and a private address", async () => {
    dns.resolve6.mockResolvedValue(["::ffff:ac10:1"]);
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(fetchSafeImage("https://images.example.test/cover.png")).rejects.toThrow(/public address/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rechecks a redirect before making any request to its private target", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://127.0.0.1/secret.png" } }));
    vi.stubGlobal("fetch", fetcher);
    await expect(fetchSafeImage("https://images.example.test/cover.png")).rejects.toThrow(/Private-network/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("stops and cancels an undeclared oversized response before consuming more data", async () => {
    let pulls = 0; const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        if (pulls === 1) controller.enqueue(png);
        else if (pulls === 2) controller.enqueue(new Uint8Array(IMPORT_LIMITS.imageBytes));
        else controller.error(new Error("Download continued beyond the size limit"));
      },
      cancel,
    }, { highWaterMark: 0 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(stream)));
    await expect(fetchSafeImage("https://images.example.test/cover.png")).rejects.toThrow(/10 MB/);
    expect(pulls).toBe(2); expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("returns a bounded valid image with the original bytes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(png, { headers: { "content-length": String(png.length) } })));
    const image = await fetchSafeImage("https://images.example.test/cover.png");
    expect(image.bytes).toEqual(png); expect(image.mimeType).toBe("image/png");
    expect(image.finalUrl.toString()).toBe("https://images.example.test/cover.png");
  });
});
