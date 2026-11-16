import { beforeEach, describe, expect, it, vi } from "vitest";

const logs = vi.hoisted(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: logs }));

import { runDepositSweep } from "./sweep";

function setup() {
  const sweep = vi.fn(async () => ({ cancelled: 1, refundsStarted: 2, autoReleased: 0 }));
  const dispatch = vi.fn(async () => ({ submitted: 2, manual: 0, failed: 0 }));
  return { sweep, dispatch };
}

beforeEach(() => vi.clearAllMocks());

describe("runDepositSweep", () => {
  it("should apply the timed rules and then send waiting refunds to Paystack", async () => {
    const { sweep, dispatch } = setup();
    await expect(runDepositSweep({ sweep, dispatch, secretKey: "sk_test_abc" })).resolves.toEqual({
      ok: true, swept: { cancelled: 1, refundsStarted: 2, autoReleased: 0 }, refunds: { submitted: 2, manual: 0, failed: 0 },
    });
    expect(sweep.mock.invocationCallOrder[0]).toBeLessThan(dispatch.mock.invocationCallOrder[0] ?? 0);
  });

  it("should apply the timed rules but hold refunds while Paystack is not configured", async () => {
    const { sweep, dispatch } = setup();
    await expect(runDepositSweep({ sweep, dispatch, secretKey: undefined })).resolves.toMatchObject({ ok: true, refunds: null });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("should hold refunds while a live key is configured before live payments are switched on", async () => {
    const { sweep, dispatch } = setup();
    await expect(runDepositSweep({ sweep, dispatch, secretKey: "sk_live_abc" })).resolves.toMatchObject({ ok: true, refunds: null });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("should still send refunds that were already waiting when the timed rules fail", async () => {
    const { sweep, dispatch } = setup();
    sweep.mockRejectedValue(new Error("db down"));
    await expect(runDepositSweep({ sweep, dispatch, secretKey: "sk_test_abc" })).resolves.toMatchObject({ ok: false, swept: null });
    expect(dispatch).toHaveBeenCalled();
  });

  it("should report failure when refunds cannot be dispatched", async () => {
    const { sweep, dispatch } = setup();
    dispatch.mockRejectedValue(new Error("db down"));
    await expect(runDepositSweep({ sweep, dispatch, secretKey: "sk_test_abc" })).resolves.toMatchObject({ ok: false, refunds: null });
  });
});
