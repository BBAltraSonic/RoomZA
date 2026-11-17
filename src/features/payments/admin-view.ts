/**
 * How the admin payments pages read a deposit: which queue it belongs in, how
 * much RoomZA still holds for it, and which decisions are open. Pure, so the
 * rules are tested apart from the pages. The database functions still decide
 * what is allowed; this only decides what to offer.
 */
import { commissionCents } from "./money";
import type { DepositState } from "./states";

export type RefundDispatch = "claimed" | "submitted" | "manual";

/** The columns of `payments` these rules read. */
export type AdminDepositRow = {
  state: DepositState;
  amount_cents: number;
  commission_bps: number;
  commission_cents: number | null;
  cancellation_fee_cents: number | null;
  refund_dispatch: RefundDispatch | null;
  refund_manual_reason: string | null;
  refund_started_at: string | null;
};

export type DepositQueueKind = "dispute" | "owner_payout" | "manual_refund" | "refund_not_sent";

/** A refund nothing has sent by now is stuck: the sweep runs every five minutes. */
const REFUND_STUCK_MS = 30 * 60 * 1000;

export function depositQueueKind(row: AdminDepositRow, now: Date): DepositQueueKind | null {
  if (row.state === "disputed") return "dispute";
  if (row.state === "releasing") return "owner_payout";
  if (row.state !== "refunding") return null;
  if (row.refund_dispatch === "manual") return "manual_refund";
  if (row.refund_dispatch === null && row.refund_started_at
    && now.getTime() - new Date(row.refund_started_at).getTime() >= REFUND_STUCK_MS) {
    return "refund_not_sent";
  }
  return null;
}

export const queueTitles: Record<DepositQueueKind, string> = {
  dispute: "Decide the dispute",
  owner_payout: "Pay the owner",
  manual_refund: "Refund by hand",
  refund_not_sent: "Refund not sent",
};

export function depositAmounts(row: AdminDepositRow) {
  const commission = row.commission_cents ?? commissionCents(row.amount_cents, row.commission_bps);
  const fee = row.cancellation_fee_cents ?? 0;
  return {
    commissionCents: commission,
    ownerPayoutCents: row.amount_cents - commission,
    cancellationFeeCents: fee,
    renterRefundCents: row.amount_cents - fee,
  };
}

/** What RoomZA holds for other people on this deposit; equals the sum of its ledger entries. */
export function heldForOthersCents(row: AdminDepositRow): number {
  switch (row.state) {
    case "held":
    case "disputed":
      return row.amount_cents;
    case "releasing":
      return depositAmounts(row).ownerPayoutCents;
    case "refunding":
      return depositAmounts(row).renterRefundCents;
    default:
      return 0;
  }
}

export type AdminDepositPanels = { dispute: boolean; payout: boolean; takeRefund: boolean; recordRefund: boolean };

export function adminDepositPanels(row: AdminDepositRow): AdminDepositPanels {
  const refunding = row.state === "refunding";
  return {
    dispute: row.state === "disputed",
    payout: row.state === "releasing",
    takeRefund: refunding && row.refund_dispatch === null,
    recordRefund: refunding && row.refund_dispatch === "manual",
  };
}

export const depositStateLabels: Record<DepositState, string> = {
  awaiting_payment: "Awaiting payment",
  held: "Held",
  disputed: "Disputed",
  releasing: "Payout due",
  released: "Paid out",
  refunding: "Refunding",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

const manualReasons: Record<string, string> = {
  claim_expired: "Sending it to Paystack did not finish, so it may or may not have reached Paystack",
  paystack_unavailable: "Paystack could not be reached",
  unexpected_error: "An unexpected error stopped it being sent",
  "refund.failed": "Paystack reported the refund failed",
  "refund.needs-attention": "Paystack says the refund needs attention",
  admin_takeover: "An admin took it to refund by bank transfer",
};

export function manualRefundReason(reason: string | null): string {
  if (!reason) return "No reason recorded";
  if (reason.startsWith("paystack_rejected")) {
    const status = reason.split("_")[2];
    return `Paystack refused it${status ? ` (${status})` : ""}, usually because its balance is too small`;
  }
  return manualReasons[reason] ?? reason;
}

const eventReasons: Record<string, string> = {
  unknown_reference: "No deposit has this reference",
  amount_mismatch: "The amount paid differs from the deposit",
  superseded: "Paid after a newer deposit replaced this one",
  already_paid: "The deposit was already paid",
};

export function providerEventReason(reason: string | null): string {
  if (!reason) return "Needs review";
  return eventReasons[reason] ?? reason;
}
