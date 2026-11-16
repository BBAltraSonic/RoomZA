/**
 * What renters and owners are told about a deposit at each state. Pure, so the
 * journey screen, the applications list and the applicant card share one wording.
 */
import { formatPrice } from "@/lib/utils";

import { estimateCardFeeCents, releaseBreakdown } from "./money";
import { autoReleaseAt, contestDeadline, moveInStart, type DepositState } from "./states";

/** A deposit as the renter sees it. `not_started` means the listing takes deposits online but checkout has not begun. */
export type RenterDeposit = {
  paymentId: string | null;
  state: DepositState | "not_started";
  amountCents: number;
  /** What Paystack charged; null until paid, or when Paystack did not report it. */
  providerFeeCents: number | null;
  /** Fixed when a refund starts. */
  cancellationFeeCents: number | null;
  /** `YYYY-MM-DD`; null until a deposit is started. */
  moveInDate: string | null;
  /** When the renter said they are not satisfied on or after the move-in date. */
  refundRequestedAt: string | null;
};

/** Something the renter can do with a held deposit, with what to tell them before they do it. */
export type DepositChoice = {
  kind: "confirm_move_in" | "request_refund";
  label: string;
  confirm: string;
};

export type DepositStep = {
  label: string;
  detail: string;
  waitingOn: "renter" | "landlord" | "none";
  action: "pay_deposit" | "message_landlord" | null;
  cta: string | null;
  /** The deposit has gone to the owner, which only happens once the renter is in. */
  movedIn: boolean;
  choices: DepositChoice[];
};

/** Rands for display: whole amounts without decimals, part amounts with two. */
export function formatCents(cents: number): string {
  if (cents % 100 === 0) return formatPrice(cents / 100);
  return `R ${new Intl.NumberFormat("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)}`;
}

const longDate = new Intl.DateTimeFormat("en-ZA", {
  day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Johannesburg",
});
const dateTime = new Intl.DateTimeFormat("en-ZA", {
  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg",
});

function feeKept(deposit: { amountCents: number; providerFeeCents: number | null }): number {
  return deposit.providerFeeCents === null ? 0 : Math.min(deposit.providerFeeCents, deposit.amountCents);
}

function describeHeld(deposit: RenterDeposit, amount: string, now: Date): DepositStep {
  const fee = feeKept(deposit);
  const back = formatCents(deposit.amountCents - fee);
  const feeLine = fee === 0
    ? "If you cancel, you get the full deposit back."
    : `If you cancel, we keep ${formatCents(fee)} to cover the card processing fee and return the rest.`;
  const base = { action: "message_landlord" as const, cta: "Message landlord", movedIn: false };

  if (deposit.refundRequestedAt) {
    const deadline = dateTime.format(contestDeadline(new Date(deposit.refundRequestedAt)));
    return {
      ...base,
      label: "Refund requested",
      detail: `The landlord has until ${deadline} to say you moved in. If they don't, ${back} comes back to you. If they do, RoomZA reviews what happened.`,
      waitingOn: "landlord",
      choices: [],
    };
  }

  if (!deposit.moveInDate || now.getTime() < moveInStart(deposit.moveInDate).getTime()) {
    return {
      ...base,
      label: "Deposit held by RoomZA",
      detail: `RoomZA is holding your ${amount} deposit until you move in. ${feeLine}`,
      waitingOn: "none",
      choices: [{
        kind: "request_refund",
        label: "Cancel and get a refund",
        confirm: `You won't move in, and ${back} goes back to the card you paid with. This can't be undone.`,
      }],
    };
  }

  const releaseOn = longDate.format(autoReleaseAt(deposit.moveInDate));
  return {
    ...base,
    label: "Did you move in?",
    detail: `Tell us so we can pay the landlord, or say you're not satisfied. If you do neither, the deposit goes to the landlord on ${releaseOn}.`,
    waitingOn: "renter",
    choices: [
      {
        kind: "confirm_move_in",
        label: "I've moved in",
        confirm: `RoomZA pays your ${amount} deposit to the landlord, who returns it at the end of your lease under its terms.`,
      },
      {
        kind: "request_refund",
        label: "I'm not satisfied",
        confirm: `The landlord has 24 hours to say you moved in. If they don't, ${back} goes back to the card you paid with. If they do, RoomZA reviews what happened.`,
      },
    ],
  };
}

export function describeRenterDeposit(
  deposit: RenterDeposit,
  options: { confirming: boolean; now?: Date },
): DepositStep {
  const amount = formatCents(deposit.amountCents);
  const none = { choices: [] as DepositChoice[] };

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
          ...none,
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
        ...none,
      };
    }
    case "held":
      return describeHeld(deposit, amount, options.now ?? new Date());
    case "disputed":
      return {
        label: "Deposit under review",
        detail: "You and the landlord disagree about the move-in. RoomZA is reviewing it and will tell you the decision.",
        waitingOn: "none",
        action: null,
        cta: null,
        movedIn: false,
        ...none,
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
        ...none,
      };
    case "refunding":
    case "refunded": {
      const refund = formatCents(deposit.amountCents - (deposit.cancellationFeeCents ?? 0));
      return deposit.state === "refunding"
        ? { label: "Refund on its way", detail: `We are returning ${refund} to you.`, waitingOn: "none", action: null, cta: null, movedIn: false, ...none }
        : { label: "Deposit refunded", detail: `${refund} was returned to you.`, waitingOn: "none", action: null, cta: null, movedIn: false, ...none };
    }
  }
}

/** A deposit as the owner sees it. */
export type OwnerDeposit = {
  paymentId: string;
  state: DepositState;
  amountCents: number;
  commissionBps: number;
  releasedAt: string | null;
  moveInDate: string;
  refundRequestedAt: string | null;
};

/** What the owner can do: contest a refund request, or cancel and refund in full. */
export type OwnerDepositAction = "contest" | "cancel";

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
  actions: OwnerDepositAction[];
};

export function describeOwnerDeposit(
  deposit: OwnerDeposit | null,
  setup: OwnerDepositSetup,
  options: { now?: Date } = {},
): OwnerDepositNotice | null {
  const none: OwnerDepositAction[] = [];
  if (!deposit) {
    if (setup.kind === "needs_payout_account") {
      return {
        tone: "warning",
        title: "Add bank details to collect the deposit",
        detail: "Renters can pay this listing's deposit through RoomZA once you add the account we pay you into.",
        href: "/settings/payouts",
        actions: none,
      };
    }
    if (setup.kind === "ready") {
      return {
        tone: "info",
        title: "Deposit not paid yet",
        detail: `The renter can now pay the ${formatCents(setup.amountCents)} deposit through RoomZA.`,
        actions: none,
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
        actions: ["cancel"],
      };
    case "held": {
      if (deposit.refundRequestedAt) {
        const deadline = contestDeadline(new Date(deposit.refundRequestedAt));
        if ((options.now ?? new Date()).getTime() < deadline.getTime()) {
          return {
            tone: "warning",
            title: "The renter says they are not satisfied",
            detail: `If they moved in, tell us by ${dateTime.format(deadline)} and RoomZA will review it. Otherwise their refund starts then.`,
            actions: ["contest", "cancel"],
          };
        }
        return {
          tone: "neutral",
          title: "The renter's refund is starting",
          detail: "You did not respond within 24 hours, so the deposit goes back to the renter.",
          actions: none,
        };
      }
      return {
        tone: "success",
        title: "Deposit held by RoomZA",
        detail: `RoomZA holds the ${formatCents(deposit.amountCents)} deposit until move-in. You receive ${payout} after the renter confirms they moved in.`,
        actions: ["cancel"],
      };
    }
    case "disputed":
      return {
        tone: "warning",
        title: "Deposit under review",
        detail: "RoomZA is deciding what happens to the deposit and will tell you both the decision.",
        actions: none,
      };
    case "releasing":
      return {
        tone: "success",
        title: `Payout of ${payout} on its way`,
        detail: `RoomZA keeps its ${rate} commission (${formatCents(commissionCents)}) and sends you the rest by bank transfer.`,
        actions: none,
      };
    case "released":
      return {
        tone: "success",
        title: `Paid out ${payout}`,
        detail: deposit.releasedAt ? `Sent on ${longDate.format(new Date(deposit.releasedAt))}.` : "Sent to your bank account.",
        actions: none,
      };
    case "refunding":
      return { tone: "neutral", title: "Deposit being refunded", detail: "The deposit is going back to the renter.", actions: none };
    case "refunded":
      return { tone: "neutral", title: "Deposit refunded", detail: "The deposit went back to the renter.", actions: none };
  }
}
