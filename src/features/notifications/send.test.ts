import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: (args: unknown) => mocks.send(args) };
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: mocks.logger,
}));

import { getEmailConfigStatus, sendEmail } from "./send";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("getEmailConfigStatus", () => {
  it("reports not configured when the API key is missing", () => {
    const status = getEmailConfigStatus();
    expect(status.configured).toBe(false);
    expect(status.hasApiKey).toBe(false);
    expect(status.usingFallbackFrom).toBe(true);
  });

  it("reports configured and echoes the sender when both are set", () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "hello@roomza.co.za";
    const status = getEmailConfigStatus();
    expect(status.configured).toBe(true);
    expect(status.hasFromEmail).toBe(true);
    expect(status.fromEmail).toBe("hello@roomza.co.za");
    expect(status.usingFallbackFrom).toBe(false);
  });
});

describe("sendEmail", () => {
  it("logs an error and returns an error when RESEND_API_KEY is missing", async () => {
    const result = await sendEmail("user@example.com", "Subject", "<p>hi</p>");

    expect("error" in result && result.error).toBeInstanceOf(Error);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.logger.error).toHaveBeenCalledWith(
      "Email not sent: RESEND_API_KEY is not configured",
      expect.objectContaining({ subject: "Subject" }),
    );
  });

  it("sends via the fallback sender and warns when RESEND_FROM_EMAIL is missing", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    mocks.send.mockResolvedValue({ data: { id: "email-1" }, error: null });

    const result = await sendEmail("user@example.com", "Subject", "<p>hi</p>");

    expect(result).toEqual({ data: { id: "email-1" } });
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({ from: "notifications@roomza.app", to: "user@example.com" }),
    );
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      "RESEND_FROM_EMAIL is not set; using fallback sender",
      expect.objectContaining({ from: "notifications@roomza.app" }),
    );
  });

  it("uses the configured sender without warning when set", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "hello@roomza.co.za";
    mocks.send.mockResolvedValue({ data: { id: "email-2" }, error: null });

    await sendEmail("user@example.com", "Subject", "<p>hi</p>");

    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({ from: "hello@roomza.co.za" }),
    );
    expect(mocks.logger.warn).not.toHaveBeenCalled();
  });

  it("logs and returns the error when Resend reports a send error", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    const providerError = { name: "validation_error", message: "domain not verified" };
    mocks.send.mockResolvedValue({ data: null, error: providerError });

    const result = await sendEmail("user@example.com", "Subject", "<p>hi</p>");

    expect(result).toEqual({ error: providerError });
    expect(mocks.logger.error).toHaveBeenCalledWith(
      "Resend API error",
      expect.objectContaining({ error: providerError }),
    );
  });

  it("catches thrown errors and returns them", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    const thrown = new Error("network down");
    mocks.send.mockRejectedValue(thrown);

    const result = await sendEmail("user@example.com", "Subject", "<p>hi</p>");

    expect(result).toEqual({ error: thrown });
    expect(mocks.logger.error).toHaveBeenCalledWith(
      "Email send error",
      expect.objectContaining({ error: thrown }),
    );
  });
});
