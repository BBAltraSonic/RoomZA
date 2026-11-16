import { beforeEach, describe, expect, it, vi } from "vitest";

const logs = vi.hoisted(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: logs }));

import { PaystackError } from "./paystack";
import { createRefundStore, dispatchDepositRefunds, type RefundStore } from "./refunds";

const paymentId = "10000000-0000-4000-8000-000000000020";
const claim = { paymentId, reference: "dep_abc", refundCents: 773_205 };

function setup() {
  const paystack = { createRefund: vi.fn(async () => ({ id: 15581137, status: "pending", amountCents: 773_205 })) };
  const store = {
    claimRefunds: vi.fn<RefundStore["claimRefunds"]>(async () => [claim]),
    finishRefund: vi.fn<RefundStore["finishRefund"]>(async () => undefined),
  };
  return { paystack, store };
}

beforeEach(() => vi.clearAllMocks());

describe("dispatchDepositRefunds", () => {
  it("should send each claimed refund to Paystack for the claimed amount and record Paystack's refund id", async () => {
    const { paystack, store } = setup();
    await expect(dispatchDepositRefunds({ paystack, store })).resolves.toEqual({ submitted: 1, manual: 0, failed: 0 });
    expect(store.claimRefunds).toHaveBeenCalledWith({ batchSize: 10, paymentId: null });
    expect(paystack.createRefund).toHaveBeenCalledWith({
      reference: "dep_abc", amountCents: 773_205, merchantNote: "RoomZA deposit refund",
    });
    expect(store.finishRefund).toHaveBeenCalledWith({ paymentId, outcome: "submitted", providerRefundId: "15581137", reason: null });
  });

  it("should claim only the named deposit when one is given", async () => {
    const { paystack, store } = setup();
    await dispatchDepositRefunds({ paystack, store, paymentId });
    expect(store.claimRefunds).toHaveBeenCalledWith({ batchSize: 1, paymentId });
  });

  it("should send a refund Paystack refuses to the manual queue", async () => {
    const { paystack, store } = setup();
    paystack.createRefund.mockRejectedValue(new PaystackError("rejected", "Insufficient balance", 400));
    await expect(dispatchDepositRefunds({ paystack, store })).resolves.toEqual({ submitted: 0, manual: 1, failed: 0 });
    expect(store.finishRefund).toHaveBeenCalledWith({ paymentId, outcome: "manual", providerRefundId: null, reason: "paystack_rejected_400" });
  });

  it("should not resend a refund whose outcome is unknown, because Paystack may have made it", async () => {
    const { paystack, store } = setup();
    paystack.createRefund.mockRejectedValue(new PaystackError("unavailable", "timeout"));
    await expect(dispatchDepositRefunds({ paystack, store })).resolves.toEqual({ submitted: 0, manual: 1, failed: 0 });
    expect(paystack.createRefund).toHaveBeenCalledTimes(1);
    expect(store.finishRefund).toHaveBeenCalledWith({ paymentId, outcome: "manual", providerRefundId: null, reason: "paystack_unavailable" });
  });

  it("should leave the claim for the expiry rule when the outcome cannot be stored", async () => {
    const { paystack, store } = setup();
    store.finishRefund.mockRejectedValue(new Error("db down"));
    await expect(dispatchDepositRefunds({ paystack, store })).resolves.toEqual({ submitted: 0, manual: 0, failed: 1 });
    expect(logs.error).toHaveBeenCalled();
  });

  it("should do nothing when there is nothing to refund", async () => {
    const { paystack, store } = setup();
    store.claimRefunds.mockResolvedValue([]);
    await expect(dispatchDepositRefunds({ paystack, store })).resolves.toEqual({ submitted: 0, manual: 0, failed: 0 });
    expect(paystack.createRefund).not.toHaveBeenCalled();
  });
});

describe("createRefundStore", () => {
  function client(result: { data: unknown; error: unknown }) {
    const rpc = vi.fn(async () => result);
    return { rpc, store: createRefundStore({ rpc } as never) };
  }

  it("should claim through the database and read the claims", async () => {
    const { rpc, store } = client({ data: [claim], error: null });
    await expect(store.claimRefunds({ batchSize: 10, paymentId: null })).resolves.toEqual([claim]);
    expect(rpc).toHaveBeenCalledWith("pinpoint_deposit_claim_refunds", { batch_size: 10, only_payment_id: null });
  });

  it("should record the outcome through the database", async () => {
    const { rpc, store } = client({ data: {}, error: null });
    await store.finishRefund({ paymentId, outcome: "manual", providerRefundId: null, reason: "paystack_unavailable" });
    expect(rpc).toHaveBeenCalledWith("pinpoint_deposit_finish_refund_dispatch", {
      target_payment_id: paymentId, outcome: "manual", refund_id: null, manual_reason: "paystack_unavailable",
    });
  });

  it("should throw when the database fails or returns claims it cannot read", async () => {
    await expect(client({ data: null, error: { code: "XX000" } }).store.claimRefunds({ batchSize: 1, paymentId: null })).rejects.toThrow();
    await expect(client({ data: [{ paymentId }], error: null }).store.claimRefunds({ batchSize: 1, paymentId: null })).rejects.toThrow();
  });
});
