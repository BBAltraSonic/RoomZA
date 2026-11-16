import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RenterDeposit } from "@/features/payments/deposit-view";

import type { RenterApplicationListItem } from "./application-types";
import { deriveJourney } from "./journey";

const paymentId = "10000000-0000-4000-8000-000000000020";

function approved(overrides: Partial<RenterApplicationListItem> = {}): RenterApplicationListItem {
  return {
    id: "10000000-0000-4000-8000-000000000010",
    status: "approved",
    created_at: "2026-11-01T08:00:00Z",
    updated_at: "2026-11-10T08:00:00Z",
    listing_id: "10000000-0000-4000-8000-000000000030",
    listing: { title: "Garden flat", address: "1 Test Street", price: 8_000 },
    documents: [{ id: "doc", type: "id" }],
    conversations: [{ id: "conversation-1" }],
    viewings: [],
    viewing_slot_offers: [],
    ...overrides,
  };
}

function deposit(overrides: Partial<RenterDeposit> = {}): RenterDeposit {
  return {
    paymentId, state: "held", amountCents: 800_000, providerFeeCents: 26_795, cancellationFeeCents: null,
    moveInDate: "2026-12-01", refundRequestedAt: null, ...overrides,
  };
}

// Wording depends on the move-in date, so the clock is fixed before it.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-20T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("deriveJourney deposit states", () => {
  it("should keep the message-the-landlord step when the listing does not take deposits online", () => {
    const journey = deriveJourney(approved());
    expect(journey.nextAction).toMatchObject({ cta: "Message landlord", href: "/messages/conversation-1" });
    expect(journey.nextAction.action).toBeUndefined();
  });

  it("should offer the deposit payment to an approved renter", () => {
    const journey = deriveJourney(approved(), { deposit: deposit({ paymentId: null, state: "not_started", providerFeeCents: null }) });
    expect(journey.nextAction).toMatchObject({ label: "Pay your deposit", action: "pay_deposit", cta: "Pay deposit", href: null });
  });

  it("should show the confirmation state only for the deposit Paystack sent the renter back for", () => {
    const awaiting = deposit({ state: "awaiting_payment", providerFeeCents: null });
    expect(deriveJourney(approved(), { deposit: awaiting, confirmingPaymentId: paymentId }).nextAction.label)
      .toBe("Confirming your payment");
    expect(deriveJourney(approved(), { deposit: awaiting, confirmingPaymentId: "10000000-0000-4000-8000-000000000099" }).nextAction.label)
      .toBe("Pay your deposit");
  });

  it("should link a renter with a held deposit to their conversation with the landlord", () => {
    const journey = deriveJourney(approved(), { deposit: deposit() });
    expect(journey.nextAction).toMatchObject({ label: "Deposit held by RoomZA", href: "/messages/conversation-1", cta: "Message landlord" });
    expect(journey.nextAction.action).toBeUndefined();
    expect(journey.steps.find((step) => step.id === "move_in")?.state).not.toBe("complete");
  });

  it("should carry the renter's deposit choices onto the journey", () => {
    const journey = deriveJourney(approved(), { deposit: deposit(), now: new Date("2026-12-01T08:00:00Z") });
    expect(journey.nextAction.depositChoices?.paymentId).toBe(paymentId);
    expect(journey.nextAction.depositChoices?.choices.map((choice) => choice.kind)).toEqual(["confirm_move_in", "request_refund"]);
  });

  it("should complete the move-in step once the deposit goes to the landlord", () => {
    const journey = deriveJourney(approved(), { deposit: deposit({ state: "released" }) });
    expect(journey.steps.find((step) => step.id === "move_in")?.state).toBe("complete");
    expect(journey.achievements.map((achievement) => achievement.id)).toContain("moved_in");
  });

  it("should ignore deposit details on an application that is no longer approved", () => {
    const journey = deriveJourney(approved({ status: "withdrawn" }), { deposit: deposit() });
    expect(journey.nextAction.label).toBe("Withdrawn");
  });
});
