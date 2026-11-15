import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/admin", () => ({ createUntypedClient: () => ({ rpc }) }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { POST } from "./route";

const secretKey = "sk_test_route";

function webhook(body: string, headers: Record<string, string>) {
  return new Request("https://roomza.test/api/payments/paystack/webhook", { method: "POST", body, headers });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("POST /api/payments/paystack/webhook", () => {
  const body = JSON.stringify({ event: "transfer.success", data: {} });
  const signature = createHmac("sha512", secretKey).update(body).digest("hex");

  it("should answer 503 while no Paystack key is set", async () => {
    vi.stubEnv("PAYSTACK_SECRET_KEY", "");
    expect((await POST(webhook(body, { "x-paystack-signature": signature }))).status).toBe(503);
  });

  it("should read the signature from the x-paystack-signature header", async () => {
    vi.stubEnv("PAYSTACK_SECRET_KEY", secretKey);
    const response = await POST(webhook(body, { "x-paystack-signature": signature }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, data: { outcome: "ignored" } });
  });

  it("should answer 401 to an unsigned request", async () => {
    vi.stubEnv("PAYSTACK_SECRET_KEY", secretKey);
    expect((await POST(webhook(body, {}))).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
});
