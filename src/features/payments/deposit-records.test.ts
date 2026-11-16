import { describe, expect, it } from "vitest";

import { toOwnerDepositSetup, toOwnerDeposits, toRenterDeposits, type PaymentRow } from "./deposit-records";

const ownerId = "10000000-0000-4000-8000-000000000001";
const otherOwner = "10000000-0000-4000-8000-000000000002";
const appPaid = "10000000-0000-4000-8000-000000000010";
const appApproved = "10000000-0000-4000-8000-000000000011";
const appNoPayout = "10000000-0000-4000-8000-000000000012";
const appNoDeposit = "10000000-0000-4000-8000-000000000013";
const appShortlisted = "10000000-0000-4000-8000-000000000014";
const listingA = "10000000-0000-4000-8000-000000000030";
const listingB = "10000000-0000-4000-8000-000000000031";
const listingC = "10000000-0000-4000-8000-000000000032";

function payment(overrides: Partial<PaymentRow> = {}): PaymentRow {
  return {
    id: "10000000-0000-4000-8000-000000000020", application_id: appPaid, state: "held",
    amount_cents: 800_000, commission_bps: 1_000, provider_fee_cents: 26_795,
    cancellation_fee_cents: null, released_at: null, ...overrides,
  };
}

describe("toRenterDeposits", () => {
  const listings = [
    { id: listingA, deposit_amount: 8_000, landlord_id: ownerId },
    { id: listingB, deposit_amount: 6_000, landlord_id: otherOwner },
    { id: listingC, deposit_amount: null, landlord_id: ownerId },
  ];

  it("should describe started deposits from the payment and offer unstarted ones only where the listing takes them", () => {
    const deposits = toRenterDeposits({
      applications: [
        { id: appPaid, status: "approved", listing_id: listingA },
        { id: appApproved, status: "approved", listing_id: listingA },
        { id: appNoPayout, status: "approved", listing_id: listingB },
        { id: appNoDeposit, status: "approved", listing_id: listingC },
        { id: appShortlisted, status: "shortlisted", listing_id: listingA },
      ],
      payments: [payment()],
      listings,
      payoutOwnerIds: [ownerId],
    });

    expect(deposits).toEqual({
      [appPaid]: { paymentId: payment().id, state: "held", amountCents: 800_000, providerFeeCents: 26_795, cancellationFeeCents: null },
      [appApproved]: { paymentId: null, state: "not_started", amountCents: 800_000, providerFeeCents: null, cancellationFeeCents: null },
    });
  });

  it("should offer a new deposit once the earlier checkout was cancelled", () => {
    const deposits = toRenterDeposits({
      applications: [{ id: appPaid, status: "approved", listing_id: listingA }],
      payments: [payment({ state: "cancelled" })],
      listings,
      payoutOwnerIds: [ownerId],
    });
    expect(deposits[appPaid]?.state).toBe("not_started");
  });

  it("should keep showing a paid deposit after the owner removes the deposit from the listing", () => {
    const deposits = toRenterDeposits({
      applications: [{ id: appPaid, status: "approved", listing_id: listingC }],
      payments: [payment()],
      listings,
      payoutOwnerIds: [],
    });
    expect(deposits[appPaid]?.state).toBe("held");
  });
});

describe("toOwnerDeposits", () => {
  it("should map each active deposit to its application and leave cancelled checkouts out", () => {
    expect(toOwnerDeposits([
      payment({ state: "released", released_at: "2026-12-01T10:00:00Z" }),
      payment({ id: "x", application_id: appApproved, state: "cancelled" }),
      payment({ id: "y", application_id: null }),
    ])).toEqual({
      [appPaid]: { state: "released", amountCents: 800_000, commissionBps: 1_000, releasedAt: "2026-12-01T10:00:00Z" },
    });
  });
});

describe("toOwnerDepositSetup", () => {
  it("should be ready only for a rental with a published deposit and an owner with bank details", () => {
    expect(toOwnerDepositSetup({ listing_type: "rent", deposit_amount: 8_000 }, true)).toEqual({ kind: "ready", amountCents: 800_000 });
    expect(toOwnerDepositSetup({ listing_type: "rent", deposit_amount: 8_000 }, false)).toEqual({ kind: "needs_payout_account" });
    expect(toOwnerDepositSetup({ listing_type: "rent", deposit_amount: null }, true)).toEqual({ kind: "off" });
    expect(toOwnerDepositSetup({ listing_type: "rent", deposit_amount: 0 }, true)).toEqual({ kind: "off" });
    expect(toOwnerDepositSetup({ listing_type: "sale", deposit_amount: 8_000 }, true)).toEqual({ kind: "off" });
  });
});
