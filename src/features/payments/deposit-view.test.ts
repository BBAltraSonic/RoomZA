import { describe, expect, it } from "vitest";

import { formatPrice } from "@/lib/utils";

import {
  describeOwnerDeposit,
  describeRenterDeposit,
  formatCents,
  type OwnerDeposit,
  type RenterDeposit,
} from "./deposit-view";

const paymentId = "10000000-0000-4000-8000-000000000020";

function renter(overrides: Partial<RenterDeposit> = {}): RenterDeposit {
  return { paymentId, state: "held", amountCents: 800_000, providerFeeCents: 26_795, cancellationFeeCents: null, ...overrides };
}

function owner(overrides: Partial<OwnerDeposit> = {}): OwnerDeposit {
  return { state: "held", amountCents: 800_000, commissionBps: 1_000, releasedAt: null, ...overrides };
}

describe("formatCents", () => {
  it("should show whole rands without decimals and part rands with two", () => {
    expect(formatCents(800_000)).toBe(formatPrice(8_000));
    expect(formatCents(26_795)).toBe(formatPrice(267.95));
    expect(formatCents(26_790)).toBe(`R ${new Intl.NumberFormat("en-ZA", { minimumFractionDigits: 2 }).format(267.9)}`);
  });
});

describe("describeRenterDeposit", () => {
  it("should offer to pay a deposit that has not been started, with the estimated cancellation fee", () => {
    const step = describeRenterDeposit(renter({ paymentId: null, state: "not_started", providerFeeCents: null }), { confirming: false });
    expect(step).toMatchObject({ label: "Pay your deposit", action: "pay_deposit", cta: "Pay deposit", waitingOn: "renter", movedIn: false });
    expect(step.detail).toContain(formatCents(800_000));
    expect(step.detail).toContain(`about ${formatCents(26_795)}`);
  });

  it("should let the renter return to a checkout they opened but did not finish", () => {
    const step = describeRenterDeposit(renter({ state: "awaiting_payment", providerFeeCents: null }), { confirming: false });
    expect(step).toMatchObject({ label: "Pay your deposit", action: "pay_deposit", cta: "Continue to payment" });
  });

  it("should say the payment is being confirmed after Paystack sends the renter back, and still offer the checkout", () => {
    const step = describeRenterDeposit(renter({ state: "awaiting_payment", providerFeeCents: null }), { confirming: true });
    expect(step).toMatchObject({ label: "Confirming your payment", action: "pay_deposit", cta: "Return to payment", waitingOn: "none" });
  });

  it("should show a held deposit with the exact cancellation fee", () => {
    const step = describeRenterDeposit(renter(), { confirming: true });
    expect(step).toMatchObject({ label: "Deposit held by RoomZA", action: "message_landlord", cta: "Message landlord", waitingOn: "none" });
    expect(step.detail).toContain(formatCents(800_000));
    expect(step.detail).toContain(formatCents(26_795));
    expect(step.detail).not.toContain("about");
  });

  it("should promise a full refund on a held deposit whose fee Paystack did not report", () => {
    const step = describeRenterDeposit(renter({ providerFeeCents: null }), { confirming: false });
    expect(step.detail).toContain("the full deposit back");
  });

  it("should tell the renter a disputed deposit is with RoomZA", () => {
    expect(describeRenterDeposit(renter({ state: "disputed" }), { confirming: false }))
      .toMatchObject({ label: "Deposit under review", action: null, waitingOn: "none", movedIn: false });
  });

  it("should treat a deposit going to, or paid to, the owner as moved in", () => {
    for (const state of ["releasing", "released"] as const) {
      expect(describeRenterDeposit(renter({ state }), { confirming: false })).toMatchObject({ label: "Moved in", movedIn: true });
    }
  });

  it("should show the refund amount less the cancellation fee that was kept", () => {
    const refunding = describeRenterDeposit(renter({ state: "refunding", cancellationFeeCents: 26_795 }), { confirming: false });
    expect(refunding.label).toBe("Refund on its way");
    expect(refunding.detail).toContain(formatCents(773_205));
    const refunded = describeRenterDeposit(renter({ state: "refunded", cancellationFeeCents: 0 }), { confirming: false });
    expect(refunded.label).toBe("Deposit refunded");
    expect(refunded.detail).toContain(formatCents(800_000));
  });
});

describe("describeOwnerDeposit", () => {
  it("should ask an owner with no bank details to add them before the deposit can be collected", () => {
    expect(describeOwnerDeposit(null, { kind: "needs_payout_account" })).toMatchObject({
      title: "Add bank details to collect the deposit", href: "/settings/payouts", tone: "warning",
    });
  });

  it("should say nothing when the listing does not take deposits online", () => {
    expect(describeOwnerDeposit(null, { kind: "off" })).toBeNull();
  });

  it("should tell the owner the renter can now pay", () => {
    const view = describeOwnerDeposit(null, { kind: "ready", amountCents: 800_000 });
    expect(view?.title).toBe("Deposit not paid yet");
    expect(view?.detail).toContain(formatCents(800_000));
  });

  it("should show a held deposit with what the owner receives after the 10% commission", () => {
    const view = describeOwnerDeposit(owner(), { kind: "ready", amountCents: 800_000 });
    expect(view).toMatchObject({ title: "Deposit held by RoomZA", tone: "success" });
    expect(view?.detail).toContain(formatCents(720_000));
  });

  it("should show the payout amount and commission while the payout is on its way", () => {
    const view = describeOwnerDeposit(owner({ state: "releasing" }), { kind: "ready", amountCents: 800_000 });
    expect(view?.title).toBe(`Payout of ${formatCents(720_000)} on its way`);
    expect(view?.detail).toContain("10%");
    expect(view?.detail).toContain(formatCents(80_000));
  });

  it("should show the date the payout was sent, in South African time", () => {
    const view = describeOwnerDeposit(owner({ state: "released", releasedAt: "2026-12-01T22:30:00Z" }), { kind: "ready", amountCents: 800_000 });
    expect(view?.title).toBe(`Paid out ${formatCents(720_000)}`);
    expect(view?.detail).toContain("2 Dec 2026");
  });

  it("should describe a deposit going back to the renter", () => {
    expect(describeOwnerDeposit(owner({ state: "refunding" }), { kind: "ready", amountCents: 800_000 })?.title).toBe("Deposit being refunded");
    expect(describeOwnerDeposit(owner({ state: "refunded" }), { kind: "ready", amountCents: 800_000 })?.title).toBe("Deposit refunded");
    expect(describeOwnerDeposit(owner({ state: "disputed" }), { kind: "ready", amountCents: 800_000 })?.title).toBe("Deposit under review");
  });

  it("should show a deposit even after the owner removes their bank details", () => {
    expect(describeOwnerDeposit(owner(), { kind: "needs_payout_account" })?.title).toBe("Deposit held by RoomZA");
  });
});
