import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  url: vi.fn(),
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Resend's REST API is called directly, so the Worker bundle carries no SDK.
// `send` receives the parsed request body and returns { status, body } or throws.
const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
  mocks.url(url, init);
  const { status, body } = await mocks.send(JSON.parse(String(init.body)));
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
});

vi.mock("@/lib/logger", () => ({
  logger: mocks.logger,
}));

import { getEmailConfigStatus, sendEmail } from "./send";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
});

afterEach(() => {
  vi.unstubAllGlobals();
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
    mocks.send.mockResolvedValue({ status: 200, body: { id: "email-1" } });

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
    mocks.send.mockResolvedValue({ status: 200, body: { id: "email-2" } });

    await sendEmail("user@example.com", "Subject", "<p>hi</p>");

    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({ from: "hello@roomza.co.za" }),
    );
    expect(mocks.logger.warn).not.toHaveBeenCalled();
  });

  it("logs and returns the error when Resend reports a send error", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    const providerError = { name: "validation_error", message: "domain not verified", statusCode: 403 };
    mocks.send.mockResolvedValue({ status: 403, body: providerError });

    const result = await sendEmail("user@example.com", "Subject", "<p>hi</p>");

    expect(result).toEqual({ error: providerError });
    expect(mocks.logger.error).toHaveBeenCalledWith(
      "Resend API error",
      expect.objectContaining({ error: providerError }),
    );
  });

  it("posts to Resend's emails endpoint with the API key as a bearer token", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    mocks.send.mockResolvedValue({ status: 200, body: { id: "email-3" } });

    await sendEmail("user@example.com", "Subject", "<p>hi</p>");

    const [url, init] = mocks.url.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer re_test_key");
    expect(mocks.send).toHaveBeenCalledWith({ from: "notifications@roomza.app", to: "user@example.com", subject: "Subject", html: "<p>hi</p>" });
  });

  it("returns an application error when Resend answers with a non-JSON failure", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    fetchMock.mockImplementationOnce(async () => new Response("Bad Gateway", { status: 502 }));

    const result = await sendEmail("user@example.com", "Subject", "<p>hi</p>");

    expect(result).toEqual({ error: { name: "application_error", message: "Resend returned HTTP 502", statusCode: 502 } });
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
