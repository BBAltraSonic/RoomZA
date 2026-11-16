import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const logs = vi.hoisted(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: logs }));

import { PaystackError, type VerifiedTransaction } from "./paystack";
import { createDepositWebhookStore, handlePaystackWebhook, type DepositWebhookStore } from "./webhook";

const secretKey = "sk_test_0123456789abcdef";

function signed(payload: unknown) {
  const rawBody = JSON.stringify(payload);
  return { rawBody, signature: createHmac("sha512", secretKey).update(rawBody).digest("hex") };
}

const verified: VerifiedTransaction = {
  id: 302961, status: "success", reference: "dep_abc", amountCents: 800_000, currency: "ZAR",
  feeCents: 26_795, channel: "card", paidAt: "2026-11-15T10:00:00.000Z",
};

const chargeEvent = { event: "charge.success", data: { id: 302961, reference: "dep_abc", customer: { email: "renter@example.com" } } };
const refundEvent = {
  event: "refund.processed",
  data: { status: "processed", transaction_reference: "dep_abc", refund_reference: "132013318360", amount: 773_205 },
};

function setup() {
  const paystack = { verifyTransaction: vi.fn(async (reference: string) => { void reference; return verified; }) };
  const store: { [K in keyof DepositWebhookStore]: ReturnType<typeof vi.fn> } = {
    recordCharge: vi.fn(async () => ({ outcome: "applied", reason: null, duplicate: false })),
    recordProviderRefund: vi.fn(async () => "recorded"),
    flagRefund: vi.fn(async () => true),
  };
  const run = (input: { rawBody: string; signature: string | null }, options: { configured?: boolean } = {}) =>
    handlePaystackWebhook(input, {
      secretKey: options.configured === false ? undefined : secretKey,
      paystack,
      store: store as unknown as DepositWebhookStore,
    });
  return { paystack, store, run };
}

beforeEach(() => vi.clearAllMocks());

describe("handlePaystackWebhook", () => {
  it("should refuse every event while Paystack is not configured", async () => {
    const { run, store } = setup();
    await expect(run(signed(chargeEvent), { configured: false })).resolves.toMatchObject({ status: 503 });
    expect(store.recordCharge).not.toHaveBeenCalled();
  });

  it("should reject an event whose signature does not match, before reading it", async () => {
    const { run, paystack, store } = setup();
    const { rawBody } = signed(chargeEvent);
    await expect(run({ rawBody, signature: "0".repeat(128) })).resolves.toMatchObject({ status: 401 });
    expect(paystack.verifyTransaction).not.toHaveBeenCalled();
    expect(store.recordCharge).not.toHaveBeenCalled();
  });

  it("should reject a signed body it cannot read", async () => {
    const { run } = setup();
    await expect(run(signed({ nothing: true }))).resolves.toMatchObject({ status: 400 });
  });

  it("should acknowledge charges that are not RoomZA deposits without touching them", async () => {
    const { run, paystack, store } = setup();
    const result = await run(signed({ event: "charge.success", data: { reference: "T2154954_other" } }));
    expect(result).toEqual({ status: 200, outcome: "ignored" });
    expect(paystack.verifyTransaction).not.toHaveBeenCalled();
    expect(store.recordCharge).not.toHaveBeenCalled();
  });

  it("should verify a charge with Paystack and record what Paystack reports, not what the event says", async () => {
    const { run, paystack, store } = setup();
    const result = await run(signed(chargeEvent));

    expect(result).toEqual({ status: 200, outcome: "applied" });
    expect(paystack.verifyTransaction).toHaveBeenCalledWith("dep_abc");
    expect(store.recordCharge).toHaveBeenCalledWith({
      reference: "dep_abc", eventKey: "charge:302961", amountCents: 800_000, currency: "ZAR", feeCents: 26_795,
      payload: { id: 302961, reference: "dep_abc", status: "success", amount: 800_000, currency: "ZAR",
        fees: 26_795, channel: "card", paidAt: "2026-11-15T10:00:00.000Z" },
    });
  });

  it("should not store the renter's email or card details from the event", async () => {
    const { run, store } = setup();
    await run(signed(chargeEvent));
    expect(JSON.stringify(store.recordCharge.mock.calls)).not.toContain("renter@example.com");
  });

  it("should ask Paystack to retry when verification is unavailable", async () => {
    const { run, paystack, store } = setup();
    paystack.verifyTransaction.mockRejectedValue(new PaystackError("unavailable", "timeout"));
    await expect(run(signed(chargeEvent))).resolves.toMatchObject({ status: 502 });
    expect(store.recordCharge).not.toHaveBeenCalled();
  });

  it("should not hold a deposit when verification says the charge did not succeed", async () => {
    const { run, paystack, store } = setup();
    paystack.verifyTransaction.mockResolvedValue({ ...verified, status: "failed" });
    await expect(run(signed(chargeEvent))).resolves.toEqual({ status: 200, outcome: "ignored" });
    expect(store.recordCharge).not.toHaveBeenCalled();
  });

  it("should not hold a deposit when verification returns a different transaction", async () => {
    const { run, paystack, store } = setup();
    paystack.verifyTransaction.mockResolvedValue({ ...verified, reference: "dep_other" });
    await expect(run(signed(chargeEvent))).resolves.toEqual({ status: 200, outcome: "ignored" });
    expect(store.recordCharge).not.toHaveBeenCalled();
    expect(logs.error).toHaveBeenCalled();
  });

  it("should record a charge whose fee Paystack did not report, with the fee unknown", async () => {
    const { run, paystack, store } = setup();
    paystack.verifyTransaction.mockResolvedValue({ ...verified, feeCents: null });
    await run(signed(chargeEvent));
    expect(store.recordCharge).toHaveBeenCalledWith(expect.objectContaining({ feeCents: null }));
    expect(logs.warn).toHaveBeenCalled();
  });

  it("should flag a charge the database could not apply", async () => {
    const { run, store } = setup();
    store.recordCharge.mockResolvedValue({ outcome: "needs_review", reason: "amount_mismatch", duplicate: false });
    await expect(run(signed(chargeEvent))).resolves.toEqual({ status: 200, outcome: "needs_review" });
    expect(logs.warn).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ reason: "amount_mismatch" }));
  });

  it("should ask Paystack to retry when the database is unavailable", async () => {
    const { run, store } = setup();
    store.recordCharge.mockRejectedValue(new Error("connection reset"));
    await expect(run(signed(chargeEvent))).resolves.toMatchObject({ status: 500 });
  });

  it("should record a processed refund against the deposit", async () => {
    const { run, store } = setup();
    await expect(run(signed(refundEvent))).resolves.toEqual({ status: 200, outcome: "recorded" });
    expect(store.recordProviderRefund).toHaveBeenCalledWith({ transactionReference: "dep_abc", refundReference: "132013318360" });
  });

  it("should acknowledge a refund for a deposit that was not awaiting one, and flag it", async () => {
    const { run, store } = setup();
    store.recordProviderRefund.mockResolvedValue("not_awaiting");
    await expect(run(signed(refundEvent))).resolves.toEqual({ status: 200, outcome: "not_awaiting" });
    expect(logs.warn).toHaveBeenCalled();
  });

  it("should send a refund Paystack could not complete to the manual queue", async () => {
    const { run, store } = setup();
    const event = { event: "refund.needs-attention", data: { transaction_reference: "dep_abc", refund_reference: "1", amount: 5 } };
    await expect(run(signed(event))).resolves.toEqual({ status: 200, outcome: "flagged" });
    expect(store.flagRefund).toHaveBeenCalledWith({ transactionReference: "dep_abc", reason: "refund.needs-attention" });
  });

  it("should acknowledge a refund problem for a deposit it does not know, and log it", async () => {
    const { run, store } = setup();
    store.flagRefund.mockResolvedValue(false);
    const event = { event: "refund.failed", data: { transaction_reference: "dep_abc" } };
    await expect(run(signed(event))).resolves.toEqual({ status: 200, outcome: "unknown_reference" });
    expect(logs.warn).toHaveBeenCalled();
  });

  it("should ask Paystack to retry a refund problem the database could not store", async () => {
    const { run, store } = setup();
    store.flagRefund.mockRejectedValue(new Error("db down"));
    const event = { event: "refund.failed", data: { transaction_reference: "dep_abc" } };
    await expect(run(signed(event))).resolves.toMatchObject({ status: 500 });
  });

  it("should acknowledge other events without acting on them", async () => {
    const { run, store, paystack } = setup();
    await expect(run(signed({ event: "transfer.success", data: {} }))).resolves.toEqual({ status: 200, outcome: "ignored" });
    expect(paystack.verifyTransaction).not.toHaveBeenCalled();
    expect(store.recordProviderRefund).not.toHaveBeenCalled();
  });
});

describe("createDepositWebhookStore flagRefund", () => {
  it("should flag the refund through the database and report whether a deposit matched", async () => {
    const rpc = vi.fn(async () => ({ data: { flagged: true }, error: null }));
    const store = createDepositWebhookStore({ rpc } as never);
    await expect(store.flagRefund({ transactionReference: "dep_abc", reason: "refund.failed" })).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith("pinpoint_deposit_flag_refund", { target_reference: "dep_abc", flag_reason: "refund.failed" });
  });

  it("should throw when the database fails, so Paystack retries", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { code: "XX000" } }));
    await expect(createDepositWebhookStore({ rpc } as never).flagRefund({ transactionReference: "dep_abc", reason: "refund.failed" })).rejects.toThrow();
  });
});

describe("createDepositWebhookStore", () => {
  function fakeClient({ rpc, payment }: { rpc: ReturnType<typeof vi.fn>; payment?: { id: string } | null }) {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      maybeSingle: vi.fn(async () => ({ data: payment ?? null, error: null })),
    };
    return { client: { rpc, from: vi.fn(() => query) }, query };
  }

  it("should call the charge function with the verified values", async () => {
    const rpc = vi.fn(async () => ({ data: { outcome: "applied", reason: null, duplicate: false, paymentId: "p1" }, error: null }));
    const { client } = fakeClient({ rpc });
    const store = createDepositWebhookStore(client as never);

    await expect(store.recordCharge({
      reference: "dep_abc", eventKey: "charge:1", amountCents: 800_000, currency: "ZAR", feeCents: null, payload: { id: 1 },
    })).resolves.toEqual({ outcome: "applied", reason: null, duplicate: false });
    expect(rpc).toHaveBeenCalledWith("pinpoint_deposit_record_charge", {
      target_reference: "dep_abc", charge_event_key: "charge:1", paid_amount_cents: 800_000,
      paid_currency: "ZAR", fee_cents: null, event_payload: { id: 1 },
    });
  });

  it("should throw when the charge function fails, so the webhook is retried", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { code: "08006", message: "down" } }));
    const store = createDepositWebhookStore(fakeClient({ rpc }).client as never);
    await expect(store.recordCharge({
      reference: "dep_abc", eventKey: "charge:1", amountCents: 1, currency: "ZAR", feeCents: 0, payload: {},
    })).rejects.toThrow();
  });

  it("should find the deposit by reference and record the refund with Paystack's refund reference", async () => {
    const rpc = vi.fn(async () => ({ data: { state: "refunded" }, error: null }));
    const { client, query } = fakeClient({ rpc, payment: { id: "p1" } });
    const store = createDepositWebhookStore(client as never);

    await expect(store.recordProviderRefund({ transactionReference: "dep_abc", refundReference: "1320" })).resolves.toBe("recorded");
    expect(client.from).toHaveBeenCalledWith("payments");
    expect(query.eq).toHaveBeenCalledWith("provider_reference", "dep_abc");
    expect(rpc).toHaveBeenCalledWith("pinpoint_deposit_record_refund", {
      target_payment_id: "p1", external_reference: "paystack:1320",
    });
  });

  it("should report an unknown deposit without calling the refund function", async () => {
    const rpc = vi.fn();
    const store = createDepositWebhookStore(fakeClient({ rpc, payment: null }).client as never);
    await expect(store.recordProviderRefund({ transactionReference: "dep_x", refundReference: "1" })).resolves.toBe("unknown_reference");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("should report a deposit that was not awaiting a refund", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { code: "PT409", message: "Deposit is not awaiting a refund" } }));
    const store = createDepositWebhookStore(fakeClient({ rpc, payment: { id: "p1" } }).client as never);
    await expect(store.recordProviderRefund({ transactionReference: "dep_abc", refundReference: "1" })).resolves.toBe("not_awaiting");
  });
});
