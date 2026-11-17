import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), createRefund: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createUntypedClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("@/features/payments/paystack", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/payments/paystack")>()),
  createPaystackClient: () => ({ createRefund: mocks.createRefund }),
}));

import { POST } from "./route";

function sweepRequest(authorization?: string) {
  return new Request("https://roomza.test/api/cron/payments/sweep", {
    method: "POST", headers: authorization ? { authorization } : {},
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("POST /api/cron/payments/sweep", () => {
  it("should refuse a request without the cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    expect((await POST(sweepRequest())).status).toBe(401);
    expect((await POST(sweepRequest("Bearer wrong"))).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("should refuse every request while no cron secret is configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await POST(sweepRequest("Bearer "))).status).toBe(401);
  });

  it("should run the timed rules and send waiting refunds", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_test_abc");
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "pinpoint_deposit_sweep") {
        return { data: { cancelled: 0, refundsStarted: 1, autoReleased: 0, reminders: 2 }, error: null };
      }
      if (name === "pinpoint_deposit_claim_refunds") return { data: [], error: null };
      throw new Error(`unexpected rpc ${name}`);
    });
    const response = await POST(sweepRequest("Bearer cron-secret"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true, data: { swept: { refundsStarted: 1, reminders: 2 }, refunds: { submitted: 0, manual: 0, failed: 0 } },
    });
  });

  it("should hold refunds while a live key is configured and live payments are off", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_live_abc");
    vi.stubEnv("PAYSTACK_LIVE_PAYMENTS", "");
    mocks.rpc.mockResolvedValue({ data: { cancelled: 0, refundsStarted: 0, autoReleased: 0, reminders: 0 }, error: null });
    const response = await POST(sweepRequest("Bearer cron-secret"));
    await expect(response.json()).resolves.toMatchObject({ ok: true, data: { refunds: null } });
    expect(mocks.rpc).not.toHaveBeenCalledWith("pinpoint_deposit_claim_refunds", expect.anything());
  });

  it("should answer 500 when the sweep fails so the failure is visible", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.stubEnv("PAYSTACK_SECRET_KEY", "");
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "XX000" } });
    expect((await POST(sweepRequest("Bearer cron-secret"))).status).toBe(500);
  });
});
