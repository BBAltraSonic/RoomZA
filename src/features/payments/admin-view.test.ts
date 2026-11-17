import { describe, expect, it } from "vitest";

import {
  adminDepositPanels,
  depositAmounts,
  depositQueueKind,
  heldForOthersCents,
  manualRefundReason,
  providerEventReason,
  type AdminDepositRow,
} from "./admin-view";

const now = new Date("2026-12-01T12:00:00Z");

function row(overrides: Partial<AdminDepositRow> = {}): AdminDepositRow {
  return {
    state: "held", amount_cents: 800_000, commission_bps: 1_000, commission_cents: null,
    cancellation_fee_cents: null, refund_dispatch: null, refund_manual_reason: null,
    refund_started_at: null, ...overrides,
  };
}

describe("depositQueueKind", () => {
  it("should queue disputes, payouts to send and refunds a person must finish", () => {
    expect(depositQueueKind(row({ state: "disputed" }), now)).toBe("dispute");
    expect(depositQueueKind(row({ state: "releasing", commission_cents: 80_000 }), now)).toBe("owner_payout");
    expect(depositQueueKind(row({ state: "refunding", refund_dispatch: "manual" }), now)).toBe("manual_refund");
  });

  it("should queue a refund nothing has sent after 30 minutes, but not one just started", () => {
    expect(depositQueueKind(row({ state: "refunding", refund_started_at: "2026-12-01T11:29:00Z" }), now)).toBe("refund_not_sent");
    expect(depositQueueKind(row({ state: "refunding", refund_started_at: "2026-12-01T11:45:00Z" }), now)).toBeNull();
  });

  it("should leave refunds Paystack is handling and settled deposits out of the queue", () => {
    for (const dispatch of ["claimed", "submitted"] as const) {
      expect(depositQueueKind(row({ state: "refunding", refund_dispatch: dispatch, refund_started_at: "2026-11-01T00:00:00Z" }), now)).toBeNull();
    }
    for (const state of ["awaiting_payment", "held", "released", "refunded", "cancelled"] as const) {
      expect(depositQueueKind(row({ state }), now)).toBeNull();
    }
  });
});

describe("heldForOthersCents", () => {
  it("should match what the ledger says RoomZA still holds at each state", () => {
    expect(heldForOthersCents(row())).toBe(800_000);
    expect(heldForOthersCents(row({ state: "disputed" }))).toBe(800_000);
    expect(heldForOthersCents(row({ state: "releasing", commission_cents: 80_000 }))).toBe(720_000);
    expect(heldForOthersCents(row({ state: "refunding", cancellation_fee_cents: 26_795 }))).toBe(773_205);
    for (const state of ["awaiting_payment", "released", "refunded", "cancelled"] as const) {
      expect(heldForOthersCents(row({ state }))).toBe(0);
    }
  });
});

describe("depositAmounts", () => {
  it("should use the stored commission once taken, and the rate before that", () => {
    expect(depositAmounts(row())).toMatchObject({ commissionCents: 80_000, ownerPayoutCents: 720_000 });
    expect(depositAmounts(row({ state: "releasing", commission_cents: 79_999 }))).toMatchObject({
      commissionCents: 79_999, ownerPayoutCents: 720_001,
    });
  });

  it("should give the renter the deposit less any cancellation fee kept", () => {
    expect(depositAmounts(row({ cancellation_fee_cents: 26_795 }))).toMatchObject({ renterRefundCents: 773_205 });
    expect(depositAmounts(row())).toMatchObject({ renterRefundCents: 800_000 });
  });
});

describe("adminDepositPanels", () => {
  it("should offer each decision only in the state that allows it", () => {
    expect(adminDepositPanels(row({ state: "disputed" }))).toEqual({ dispute: true, payout: false, takeRefund: false, recordRefund: false });
    expect(adminDepositPanels(row({ state: "releasing" }))).toEqual({ dispute: false, payout: true, takeRefund: false, recordRefund: false });
    expect(adminDepositPanels(row({ state: "refunding" }))).toEqual({ dispute: false, payout: false, takeRefund: true, recordRefund: false });
    expect(adminDepositPanels(row({ state: "refunding", refund_dispatch: "manual" })))
      .toEqual({ dispute: false, payout: false, takeRefund: false, recordRefund: true });
  });

  it("should offer nothing while Paystack may be moving the money", () => {
    for (const dispatch of ["claimed", "submitted"] as const) {
      expect(Object.values(adminDepositPanels(row({ state: "refunding", refund_dispatch: dispatch })))).not.toContain(true);
    }
  });
});

describe("reasons", () => {
  it("should explain why a refund needs a person", () => {
    expect(manualRefundReason("claim_expired")).toMatch(/did not finish/);
    expect(manualRefundReason("paystack_rejected_400")).toMatch(/refused/);
    expect(manualRefundReason("paystack_unavailable")).toMatch(/could not be reached/);
    expect(manualRefundReason("refund.failed")).toMatch(/failed/);
    expect(manualRefundReason("admin_takeover")).toMatch(/admin/);
    expect(manualRefundReason("something_new")).toBe("something_new");
    expect(manualRefundReason(null)).toBe("No reason recorded");
  });

  it("should explain why a charge needs review", () => {
    expect(providerEventReason("unknown_reference")).toMatch(/No deposit/);
    expect(providerEventReason("amount_mismatch")).toMatch(/amount/);
    expect(providerEventReason("superseded")).toMatch(/newer deposit/);
    expect(providerEventReason("already_paid")).toMatch(/already paid/);
  });
});
