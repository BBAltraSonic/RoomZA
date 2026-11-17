import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  claims: vi.fn(),
  requirePersona: vi.fn(),
  rpc: vi.fn(),
  rateLimit: vi.fn(),
  dispatch: vi.fn(),
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: mocks.claims } }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createUntypedClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/auth", () => ({ requirePersona: (persona: string) => mocks.requirePersona(persona) }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: (options: unknown) => mocks.rateLimit(options) }));
vi.mock("@/lib/logger", () => ({ logger: mocks.logger }));
vi.mock("./refunds", () => ({
  createRefundStore: () => ({}),
  dispatchDepositRefunds: (input: unknown) => mocks.dispatch(input),
}));

import {
  cancelDepositAsOwner,
  confirmMoveIn,
  contestDepositRefund,
  requestDepositRefund,
} from "./deposit-actions";

const userId = "10000000-0000-4000-8000-000000000001";
const sessionId = "10000000-0000-4000-8000-0000000000a1";
const paymentId = "10000000-0000-4000-8000-000000000020";

function summary(state: string) {
  return { paymentId, state, amountCents: 800_000, currency: "ZAR", reference: "dep_abc", checkoutUrl: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePersona.mockResolvedValue({ user: { id: userId } });
  mocks.claims.mockResolvedValue({ data: { claims: { sub: userId, session_id: sessionId } }, error: null });
  mocks.rateLimit.mockResolvedValue({ success: true });
  mocks.dispatch.mockResolvedValue({ submitted: 1, manual: 0, failed: 0 });
  vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_test_abc");
});

afterEach(() => vi.unstubAllEnvs());

describe.each([
  ["confirmMoveIn", confirmMoveIn, "renter", "pinpoint_deposit_confirm_move_in"],
  ["requestDepositRefund", requestDepositRefund, "renter", "pinpoint_deposit_request_refund"],
  ["contestDepositRefund", contestDepositRefund, "landlord", "pinpoint_deposit_contest_refund"],
  ["cancelDepositAsOwner", cancelDepositAsOwner, "landlord", "pinpoint_deposit_owner_cancel"],
] as const)("%s", (_name, action, persona, rpcName) => {
  it("should act as the signed-in person in their current session", async () => {
    mocks.rpc.mockResolvedValue({ data: summary("held"), error: null });
    await expect(action(paymentId)).resolves.toEqual({ success: true, data: { state: "held" } });
    expect(mocks.requirePersona).toHaveBeenCalledWith(persona);
    expect(mocks.rpc).toHaveBeenCalledWith(rpcName, { actor_id: userId, actor_session_id: sessionId, target_payment_id: paymentId });
  });

  it("should reject an invalid deposit id before anything else", async () => {
    expect((await action("nope")).success).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("should reject a session whose claims name another person", async () => {
    mocks.claims.mockResolvedValue({ data: { claims: { sub: "someone-else", session_id: sessionId } }, error: null });
    expect((await action(paymentId)).success).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("should be rate limited", async () => {
    mocks.rateLimit.mockResolvedValue({ success: false });
    expect((await action(paymentId)).success).toBe(false);
    expect(mocks.rateLimit).toHaveBeenCalledWith({ key: `deposit-action:${userId}`, requests: 20, window: "10 m" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("should not reveal whether someone else's deposit exists", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Deposit not found or access denied" } });
    expect(await action(paymentId)).toEqual({ success: false, error: "This deposit is unavailable." });
  });

  it("should fail without detail when the database is unavailable", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });
    const result = await action(paymentId);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).not.toContain("boom");
  });
});

describe("refunds started by an action", () => {
  it("should send the renter's refund to Paystack straight away", async () => {
    mocks.rpc.mockResolvedValue({ data: summary("refunding"), error: null });
    await expect(requestDepositRefund(paymentId)).resolves.toEqual({ success: true, data: { state: "refunding" } });
    expect(mocks.dispatch).toHaveBeenCalledWith(expect.objectContaining({ paymentId }));
  });

  it("should send the owner's full refund to Paystack straight away", async () => {
    mocks.rpc.mockResolvedValue({ data: summary("refunding"), error: null });
    await cancelDepositAsOwner(paymentId);
    expect(mocks.dispatch).toHaveBeenCalledWith(expect.objectContaining({ paymentId }));
  });

  it("should not refund anything while the request waits for the owner's answer", async () => {
    mocks.rpc.mockResolvedValue({ data: summary("held"), error: null });
    await requestDepositRefund(paymentId);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("should still report success when Paystack cannot be reached, leaving the refund for the sweep", async () => {
    mocks.rpc.mockResolvedValue({ data: summary("refunding"), error: null });
    mocks.dispatch.mockRejectedValue(new Error("down"));
    await expect(requestDepositRefund(paymentId)).resolves.toEqual({ success: true, data: { state: "refunding" } });
    expect(mocks.logger.warn).toHaveBeenCalled();
  });

  it("should hold refunds while a live key is configured before live payments are switched on", async () => {
    vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_live_abc");
    mocks.rpc.mockResolvedValue({ data: summary("refunding"), error: null });
    await requestDepositRefund(paymentId);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("should send refunds with a live key once live payments are switched on", async () => {
    vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_live_abc");
    vi.stubEnv("PAYSTACK_LIVE_PAYMENTS", "enabled");
    mocks.rpc.mockResolvedValue({ data: summary("refunding"), error: null });
    await requestDepositRefund(paymentId);
    expect(mocks.dispatch).toHaveBeenCalledWith(expect.objectContaining({ paymentId }));
  });
});

describe("database refusals", () => {
  it.each([
    ["Deposit cannot be released", confirmMoveIn, "This deposit can no longer be confirmed."],
    ["Deposit cannot be refunded", requestDepositRefund, "This deposit can no longer be refunded."],
    ["There is no refund request to contest", contestDepositRefund, "The renter has not asked for a refund."],
    ["The time to contest this refund has passed", contestDepositRefund, "The 24 hours to respond have passed."],
    ["Deposit cannot be cancelled", cancelDepositAsOwner, "This deposit can no longer be cancelled."],
  ] as const)("should explain %s", async (message, action, expected) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PT409", message } });
    expect(await action(paymentId)).toEqual({ success: false, error: expected });
  });
});
