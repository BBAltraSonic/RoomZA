/**
 * What renters and owners are told about a deposit at each state. Pure, so the
 * journey screen, the applications list and the applicant card share one wording.
 */
import { formatPrice } from "@/lib/utils";

import { estimateCardFeeCents, releaseBreakdown } from "./money";
import type { DepositState } from "./states";

/** A deposit as the renter sees it. `not_started` means the listing takes deposits online but checkout has not begun. */
export type RenterDeposit = {
  paymentId: string | null;
  state: DepositState | "not_started";
  amountCents: number;
  /** What Paystack charged; null until paid, or when Paystack did not report it. */
  providerFeeCents: number | null;
  /** Fixed when a refund starts. */
  cancellationFeeCents: number | null;
};

export type DepositStep = {
  label: string;
  detail: string;
  waitingOn: "renter" | "landlord" | "none";
  action: "pay_deposit" | "message_landlord" | null;
  cta: string | null;
  /** The deposit has gone to the owner, which only happens once the renter is in. */
  movedIn: boolean;
};

/** Rands for display: whole amounts without decimals, part amounts with two. */
export function formatCents(cents: number): string {
  if (cents % 100 === 0) return formatPrice(cents / 100);
  return `R ${new Intl.NumberFormat("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)}`;
}

export function describeRenterDeposit(deposit: RenterDeposit, options: { confirming: boolean }): DepositStep {
  const amount = formatCents(deposit.amountCents);

  switch (deposit.state) {
    case "not_started":
    case "awaiting_payment":
    case "cancelled": {
      if (deposit.state === "awaiting_payment" && options.confirming) {
        return {
          label: "Confirming your payment",
          detail:
            "If you paid, Paystack is confirming it and this page updates by itself, usually within a minute. If you did not finish, return to the payment page.",
          waitingOn: "none",
          action: "pay_deposit",
          cta: "Return to payment",
          movedIn: false,
        };
      }
      const fee = formatCents(estimateCardFeeCents(deposit.amountCents));
      return {
        label: "Pay your deposit",
        detail: `Pay the ${amount} deposit through RoomZA. We hold it until you move in. If you cancel, we keep about ${fee} to cover the card processing fee and return the rest.`,
        waitingOn: "renter",
        action: "pay_deposit",
        cta: deposit.state === "awaiting_payment" ? "Continue to payment" : "Pay deposit",
        movedIn: false,
      };
    }
    case "held":
      return {
        label: "Deposit held by RoomZA",
        detail:
          deposit.providerFeeCents === null
            ? `RoomZA is holding your ${amount} deposit until you move in. If you cancel, you get the full deposit back.`
            : `RoomZA is holding your ${amount} deposit until you move in. If you cancel, we keep ${formatCents(Math.min(deposit.providerFeeCents, deposit.amountCents))} to cover the card processing fee and return the rest.`,
        waitingOn: "none",
        action: "message_landlord",
        cta: "Message landlord",
        movedIn: false,
      };
    case "disputed":
      return {
        label: "Deposit under review",
        detail: "You and the landlord disagree about the move-in. RoomZA is reviewing it and will tell you the decision.",
        waitingOn: "none",
        action: null,
        cta: null,
        movedIn: false,
      };
    case "releasing":
    case "released":
      return {
        label: "Moved in",
        detail: `Your ${amount} deposit has gone to the landlord, who returns it at the end of your lease under its terms. Welcome home.`,
        waitingOn: "none",
        action: null,
        cta: null,
        movedIn: true,
      };
    case "refunding":
    case "refunded": {
      const refund = formatCents(deposit.amountCents - (deposit.cancellationFeeCents ?? 0));
      return deposit.state === "refunding"
        ? { label: "Refund on its way", detail: `We are returning ${refund} to you.`, waitingOn: "none", action: null, cta: null, movedIn: false }
        : { label: "Deposit refunded", detail: `${refund} was returned to you.`, waitingOn: "none", action: null, cta: null, movedIn: false };
    }
  }
}

/** A deposit as the owner sees it. */
export type OwnerDeposit = {
  state: DepositState;
  amountCents: number;
  commissionBps: number;
  releasedAt: string | null;
};

/** Whether this listing can take a deposit through RoomZA. */
export type OwnerDepositSetup =
  | { kind: "ready"; amountCents: number }
  | { kind: "needs_payout_account" }
  | { kind: "off" };

export type OwnerDepositNotice = {
  tone: "success" | "warning" | "info" | "neutral";
  title: string;
  detail: string;
  href?: string;
};

const payoutDate = new Intl.DateTimeFormat("en-ZA", {
  day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Johannesburg",
});

export function describeOwnerDeposit(deposit: OwnerDeposit | null, setup: OwnerDepositSetup): OwnerDepositNotice | null {
  if (!deposit) {
    if (setup.kind === "needs_payout_account") {
      return {
        tone: "warning",
        title: "Add bank details to collect the deposit",
        detail: "Renters can pay this listing's deposit through RoomZA once you add the account we pay you into.",
        href: "/settings/payouts",
      };
    }
    if (setup.kind === "ready") {
      return {
        tone: "info",
        title: "Deposit not paid yet",
        detail: `The renter can now pay the ${formatCents(setup.amountCents)} deposit through RoomZA.`,
      };
    }
    return null;
  }

  const { commissionCents, ownerPayoutCents } = releaseBreakdown({
    amountCents: deposit.amountCents, commissionBps: deposit.commissionBps,
  });
  const payout = formatCents(ownerPayoutCents);
  const rate = `${deposit.commissionBps / 100}%`;

  switch (deposit.state) {
    case "awaiting_payment":
    case "cancelled":
      return {
        tone: "info",
        title: "Deposit not paid yet",
        detail: `The renter has opened the payment page for the ${formatCents(deposit.amountCents)} deposit but not paid yet.`,
      };
    case "held":
      return {
        tone: "success",
        title: "Deposit held by RoomZA",
        detail: `RoomZA holds the ${formatCents(deposit.amountCents)} deposit until move-in. You receive ${payout} after the renter confirms they moved in.`,
      };
    case "disputed":
      return {
        tone: "warning",
        title: "Deposit under review",
        detail: "RoomZA is deciding what happens to the deposit and will tell you both the decision.",
      };
    case "releasing":
      return {
        tone: "success",
        title: `Payout of ${payout} on its way`,
        detail: `RoomZA keeps its ${rate} commission (${formatCents(commissionCents)}) and sends you the rest by bank transfer.`,
      };
    case "released":
      return {
        tone: "success",
        title: `Paid out ${payout}`,
        detail: deposit.releasedAt ? `Sent on ${payoutDate.format(new Date(deposit.releasedAt))}.` : "Sent to your bank account.",
      };
    case "refunding":
      return { tone: "neutral", title: "Deposit being refunded", detail: "The deposit is going back to the renter." };
    case "refunded":
      return { tone: "neutral", title: "Deposit refunded", detail: "The deposit went back to the renter." };
  }
}
