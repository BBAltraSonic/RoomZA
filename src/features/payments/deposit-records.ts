/**
 * Turns payment, listing and payout-account rows into the deposit views the
 * screens show. Pure, so the rules for "can this renter pay online" are tested
 * apart from the queries in deposit-data.ts.
 */
import type { OwnerDeposit, OwnerDepositSetup, RenterDeposit } from "./deposit-view";
import { DEPOSIT_STATES, type DepositState } from "./states";

/** The columns of `payments` the screens read. */
export type PaymentRow = {
  id: string;
  application_id: string | null;
  state: string;
  amount_cents: number;
  commission_bps: number;
  provider_fee_cents: number | null;
  cancellation_fee_cents: number | null;
  released_at: string | null;
  move_in_date: string;
  refund_requested_at: string | null;
  paid_at: string | null;
};

export const PAYMENT_COLUMNS =
  "id, application_id, state, amount_cents, commission_bps, provider_fee_cents, cancellation_fee_cents, released_at, move_in_date, refund_requested_at, paid_at";

type ListingDeposit = { id: string; deposit_amount: number | null; landlord_id: string };

function isDepositState(value: string): value is DepositState {
  return (DEPOSIT_STATES as readonly string[]).includes(value);
}

/** Active deposits by application. A cancelled checkout is not active: a new one can start. */
function activeByApplication(payments: PaymentRow[]) {
  const byApplication = new Map<string, PaymentRow & { state: DepositState }>();
  for (const payment of payments) {
    if (!payment.application_id || payment.state === "cancelled" || !isDepositState(payment.state)) continue;
    byApplication.set(payment.application_id, payment as PaymentRow & { state: DepositState });
  }
  return byApplication;
}

function publishedDepositCents(depositAmount: number | null): number | null {
  return depositAmount !== null && Number.isSafeInteger(depositAmount) && depositAmount > 0 ? depositAmount * 100 : null;
}

/**
 * Deposits for the renter's applications. An application appears only when it
 * has an active deposit, or is approved on a listing that takes deposits online
 * (a published deposit and an owner with bank details). Every other approved
 * application keeps the "message the landlord" step.
 */
export function toRenterDeposits(input: {
  applications: { id: string; status: string; listing_id: string }[];
  payments: PaymentRow[];
  listings: ListingDeposit[];
  payoutOwnerIds: Iterable<string>;
}): Record<string, RenterDeposit> {
  const active = activeByApplication(input.payments);
  const listings = new Map(input.listings.map((listing) => [listing.id, listing]));
  const payoutOwners = new Set(input.payoutOwnerIds);
  const deposits: Record<string, RenterDeposit> = {};

  for (const application of input.applications) {
    const payment = active.get(application.id);
    if (payment) {
      deposits[application.id] = {
        paymentId: payment.id,
        state: payment.state,
        amountCents: payment.amount_cents,
        providerFeeCents: payment.provider_fee_cents,
        cancellationFeeCents: payment.cancellation_fee_cents,
        moveInDate: payment.move_in_date,
        refundRequestedAt: payment.refund_requested_at,
        paidAt: payment.paid_at,
      };
      continue;
    }
    if (application.status !== "approved") continue;
    const listing = listings.get(application.listing_id);
    const amountCents = listing ? publishedDepositCents(listing.deposit_amount) : null;
    if (!listing || amountCents === null || !payoutOwners.has(listing.landlord_id)) continue;
    deposits[application.id] = {
      paymentId: null, state: "not_started", amountCents, providerFeeCents: null, cancellationFeeCents: null,
      moveInDate: null, refundRequestedAt: null, paidAt: null,
    };
  }
  return deposits;
}

export function toOwnerDeposits(payments: PaymentRow[]): Record<string, OwnerDeposit> {
  const deposits: Record<string, OwnerDeposit> = {};
  for (const [applicationId, payment] of activeByApplication(payments)) {
    deposits[applicationId] = {
      paymentId: payment.id,
      state: payment.state,
      amountCents: payment.amount_cents,
      commissionBps: payment.commission_bps,
      releasedAt: payment.released_at,
      moveInDate: payment.move_in_date,
      refundRequestedAt: payment.refund_requested_at,
    };
  }
  return deposits;
}

export function toOwnerDepositSetup(
  listing: { listing_type: string | null; deposit_amount: number | null },
  hasPayoutAccount: boolean,
): OwnerDepositSetup {
  const amountCents = publishedDepositCents(listing.deposit_amount);
  if (listing.listing_type !== "rent" || amountCents === null) return { kind: "off" };
  return hasPayoutAccount ? { kind: "ready", amountCents } : { kind: "needs_payout_account" };
}
