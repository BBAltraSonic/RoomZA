import { afterEach, describe, expect, it, vi } from "vitest";

import { verifyTurnstileToken } from "@/lib/turnstile";

describe("Turnstile verification", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    delete process.env.TURNSTILE_SECRET_KEY;
  });

  it("fails closed when the secret is missing", async () => {
    vi.stubEnv("NODE_ENV", "test");
    delete process.env.TURNSTILE_SECRET_KEY;

    await expect(verifyTurnstileToken("token", "203.0.113.10")).resolves.toBe(false);
  });

  it("rejects an empty token before calling Cloudflare", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(verifyTurnstileToken(null)).resolves.toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns the Cloudflare verification result", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: async () => ({ success: true }),
    } as Response);

    await expect(verifyTurnstileToken("token", "203.0.113.10")).resolves.toBe(true);
  });
});
