import { describe, expect, it, vi, afterEach } from "vitest";

import { consumeRateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";

describe("rate limiting", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("fails open outside production when Upstash is not configured", async () => {
    vi.stubEnv("NODE_ENV", "test");
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    await expect(consumeRateLimit({ key: "test", requests: 10, window: "60 s" })).resolves.toMatchObject({
      success: true,
      limit: 10,
      remaining: 10,
      reason: "not_configured",
    });
  });

  it("fails closed in production when Upstash is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const before = Date.now();
    const result = await consumeRateLimit({ key: "test", requests: 10, window: "60 s" });

    expect(result).toMatchObject({
      success: false,
      limit: 10,
      remaining: 0,
      reason: "not_configured",
    });
    expect(result.reset).toBeGreaterThanOrEqual(before + 60_000);
  });

  it("fails open outside production when Upstash cannot be reached", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://unreachable.roomza.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(consumeRateLimit({ key: "test", requests: 10, window: "60 s" })).resolves.toMatchObject({
      success: true,
      limit: 10,
      remaining: 10,
      reason: "provider_error",
    });
  });

  it("fails closed in production when Upstash cannot be reached", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://unreachable.roomza.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(consumeRateLimit({ key: "test", requests: 10, window: "60 s" })).resolves.toMatchObject({
      success: false,
      limit: 10,
      remaining: 0,
      reason: "provider_error",
    });
  });

  it("extracts the first forwarded client IP before falling back to anonymous", () => {
    expect(getClientIpFromHeaders(new Headers({ "x-forwarded-for": "203.0.113.4, 10.0.0.1" }))).toBe("203.0.113.4");
    expect(getClientIpFromHeaders(new Headers())).toBe("anonymous");
  });
});
