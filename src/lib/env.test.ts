import { afterEach, describe, expect, it, vi } from "vitest";

import { getServerEnv } from "./env";

afterEach(() => vi.unstubAllEnvs());

describe("optional server configuration", () => {
  it("treats explicit empty overrides as unset without accepting invalid values", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "local-test-key");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3100");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("RESEND_FROM_EMAIL", "");
    vi.stubEnv("QSTASH_TOKEN", "");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("CRON_SECRET", "");

    const env = getServerEnv();
    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.RESEND_FROM_EMAIL).toBeUndefined();
    expect(env.QSTASH_TOKEN).toBeUndefined();
    expect(env.UPSTASH_REDIS_REST_URL).toBeUndefined();
    expect(env.CRON_SECRET).toBeUndefined();

    vi.stubEnv("RESEND_FROM_EMAIL", "not-an-email");
    expect(getServerEnv).toThrow("RESEND_FROM_EMAIL");
  });
});
