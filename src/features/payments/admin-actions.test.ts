import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
  sendRefundNow: vi.fn(),
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/features/admin/auth", () => ({ requireAdmin: () => mocks.requireAdmin() }));
vi.mock("@/lib/supabase/admin", () => ({ createUntypedClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/logger", () => ({ logger: mocks.logger }));
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => mocks.revalidatePath(path) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-request-id": "req-1" }) }));
vi.mock("./send-refund", () => ({ sendRefundNow: (paymentId: string) => mocks.sendRefundNow(paymentId) }));

import {
  markPaymentEventReviewed,
  recordManualRefund,
  recordOwnerPayout,
  resolveDepositDispute,
  revealOwnerPayoutAccount,
  takeDepositRefund,
} from "./admin-actions";

const adminId = "10000000-0000-4000-8000-0000000000ad";
const paymentId = "10000000-0000-4000-8000-000000000020";
const eventId = "10000000-0000-4000-8000-000000000030";

function summary(state: string) {
  return { paymentId, state, amountCents: 800_000, currency: "ZAR", reference: "dep_abc", checkoutUrl: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ user: { id: adminId } });
  mocks.sendRefundNow.mockResolvedValue(undefined);
});

describe("resolveDepositDispute", () => {
  const input = { paymentId, resolution: "refund", waiveCancellationFee: true, reason: "Photos show the unit did not match" };

  it("should decide the dispute as the signed-in admin and send a refund straight to Paystack", async () => {
    mocks.rpc.mockResolvedValue({ data: summary("refunding"), error: null });
    await expect(resolveDepositDispute(input)).resolves.toEqual({ success: true, data: { state: "refunding" } });
    expect(mocks.rpc).toHaveBeenCalledWith("pinpoint_deposit_resolve_dispute", {
      actor: adminId, target_payment_id: paymentId, resolution: "refund", waive_cancellation_fee: true,
      action_reason: input.reason, audit_request_id: "req-1",
    });
    expect(mocks.sendRefundNow).toHaveBeenCalledWith(paymentId);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/admin/payments/${paymentId}`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/payments");
  });

  it("should not refund anything when the deposit goes to the owner", async () => {
    mocks.rpc.mockResolvedValue({ data: summary("releasing"), error: null });
    await resolveDepositDispute({ ...input, resolution: "release" });
    expect(mocks.sendRefundNow).not.toHaveBeenCalled();
  });

  it("should never waive the fee on a release", async () => {
    mocks.rpc.mockResolvedValue({ data: summary("releasing"), error: null });
    await resolveDepositDispute({ ...input, resolution: "release", waiveCancellationFee: true });
    expect(mocks.rpc).toHaveBeenCalledWith("pinpoint_deposit_resolve_dispute", expect.objectContaining({ waive_cancellation_fee: false }));
  });

  it("should require a reason before asking the database", async () => {
    expect((await resolveDepositDispute({ ...input, reason: "short" })).success).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("should explain a dispute that was already decided", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PT409", message: "Deposit is not in dispute" } });
    expect(await resolveDepositDispute(input)).toEqual({ success: false, error: "This deposit is no longer in dispute." });
  });
});

describe("revealOwnerPayoutAccount", () => {
  const account = {
    accountHolder: "Plan Owner", bankName: "Test Bank", branchCode: "250655", accountNumber: "62000000001",
    updatedAt: "2026-11-15T10:00:00Z", changedAfterPayment: false, payoutCents: 720_000,
  };

  it("should return the full details for the transfer, audited by the database", async () => {
    mocks.rpc.mockResolvedValue({ data: account, error: null });
    await expect(revealOwnerPayoutAccount(paymentId)).resolves.toEqual({ success: true, data: account });
    expect(mocks.rpc).toHaveBeenCalledWith("pinpoint_owner_payout_account_reveal", {
      actor: adminId, target_payment_id: paymentId, audit_request_id: "req-1",
    });
  });

  it("should never log the account number", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...account, branchCode: 12 }, error: null });
    expect((await revealOwnerPayoutAccount(paymentId)).success).toBe(false);
    const logged = JSON.stringify([mocks.logger.error.mock.calls, mocks.logger.warn.mock.calls, mocks.logger.info.mock.calls]);
    expect(logged).not.toContain("62000000001");
  });

  it("should refuse once the payout is no longer due", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PT409", message: "Deposit is not awaiting an owner payout" } });
    expect(await revealOwnerPayoutAccount(paymentId)).toEqual({
      success: false, error: "This deposit is not waiting for an owner payout.",
    });
  });
});

describe("recordOwnerPayout", () => {
  it("should record the bank reference of the transfer", async () => {
    mocks.rpc.mockResolvedValue({ data: summary("released"), error: null });
    await expect(recordOwnerPayout({ paymentId, bankReference: " EFT-123 " })).resolves.toEqual({ success: true, data: { state: "released" } });
    expect(mocks.rpc).toHaveBeenCalledWith("pinpoint_deposit_record_payout", {
      actor: adminId, target_payment_id: paymentId, bank_reference: "EFT-123", audit_request_id: "req-1",
    });
  });

  it("should require a reference", async () => {
    expect((await recordOwnerPayout({ paymentId, bankReference: "  " })).success).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("refunds by hand", () => {
  it("should take a waiting refund out of the automatic path", async () => {
    mocks.rpc.mockResolvedValue({ data: summary("refunding"), error: null });
    await expect(takeDepositRefund(paymentId)).resolves.toEqual({ success: true, data: { state: "refunding" } });
    expect(mocks.rpc).toHaveBeenCalledWith("pinpoint_deposit_take_refund", {
      actor: adminId, target_payment_id: paymentId, audit_request_id: "req-1",
    });
  });

  it("should explain that Paystack is still sending a claimed refund", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PT409", message: "The refund is being sent to Paystack" } });
    expect(await takeDepositRefund(paymentId)).toMatchObject({ success: false, error: expect.stringMatching(/Paystack/) });
  });

  it("should record the bank transfer of a refund made by hand", async () => {
    mocks.rpc.mockResolvedValue({ data: summary("refunded"), error: null });
    await expect(recordManualRefund({ paymentId, reference: "EFT-9" })).resolves.toEqual({ success: true, data: { state: "refunded" } });
    expect(mocks.rpc).toHaveBeenCalledWith("pinpoint_deposit_record_refund", {
      target_payment_id: paymentId, external_reference: "manual:EFT-9", actor: adminId, audit_request_id: "req-1",
    });
  });

  it("should ask for the take-over before a refund on the automatic path is recorded", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PT409", message: "Refund is not marked for manual handling" } });
    expect(await recordManualRefund({ paymentId, reference: "EFT-9" })).toMatchObject({
      success: false, error: expect.stringMatching(/by hand/),
    });
  });
});

describe("markPaymentEventReviewed", () => {
  it("should record what was done about a charge needing review", async () => {
    mocks.rpc.mockResolvedValue({ data: { eventId, reviewedAt: "2026-12-01T10:00:00Z" }, error: null });
    expect((await markPaymentEventReviewed({ eventId, note: "Refunded on the Paystack dashboard" })).success).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("pinpoint_payment_event_mark_reviewed", {
      actor: adminId, target_event_id: eventId, note: "Refunded on the Paystack dashboard", audit_request_id: "req-1",
    });
  });

  it("should require a note", async () => {
    expect((await markPaymentEventReviewed({ eventId, note: "ok" })).success).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("every admin payment action", () => {
  it.each([
    ["resolveDepositDispute", () => resolveDepositDispute({ paymentId: "nope", resolution: "refund", waiveCancellationFee: false, reason: "A long enough reason" })],
    ["revealOwnerPayoutAccount", () => revealOwnerPayoutAccount("nope")],
    ["recordOwnerPayout", () => recordOwnerPayout({ paymentId: "nope", bankReference: "EFT" })],
    ["takeDepositRefund", () => takeDepositRefund("nope")],
    ["recordManualRefund", () => recordManualRefund({ paymentId: "nope", reference: "EFT" })],
    ["markPaymentEventReviewed", () => markPaymentEventReviewed({ eventId: "nope", note: "A long enough note" })],
  ])("%s should reject an invalid id before reaching the database", async (_name, run) => {
    expect((await run()).success).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("should require an admin before reaching the database", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(takeDepositRefund(paymentId)).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("should fail without detail when the database is unavailable", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });
    const result = await recordOwnerPayout({ paymentId, bankReference: "EFT-1" });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).not.toContain("boom");
  });
});
