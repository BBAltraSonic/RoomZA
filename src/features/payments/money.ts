/**
 * Money rules for deposits held by RoomZA. Every amount is whole cents.
 * The database functions in the deposit payments migration apply the same
 * arithmetic; keep the two in step.
 */

const BPS_DENOMINATOR = 10_000;

function assertPositiveCents(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive whole number of cents`);
  }
}

function assertNonNegativeCents(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative whole number of cents`);
  }
}

/** Listings publish deposits in whole rands; payments store cents. */
export function randsToCents(rands: number): number {
  if (!Number.isSafeInteger(rands) || rands <= 0) {
    throw new RangeError("Deposit must be a positive whole number of rands");
  }
  return rands * 100;
}

/** Commission on a deposit, with half a cent rounded up. The rate is in basis points (1000 = 10%). */
export function commissionCents(amountCents: number, commissionBps: number): number {
  assertPositiveCents(amountCents, "Deposit amount");
  if (!Number.isInteger(commissionBps) || commissionBps < 0 || commissionBps > BPS_DENOMINATOR) {
    throw new RangeError("Commission rate must be between 0 and 10000 basis points");
  }
  return Math.floor((amountCents * commissionBps + BPS_DENOMINATOR / 2) / BPS_DENOMINATOR);
}

export interface ReleaseBreakdown {
  commissionCents: number;
  ownerPayoutCents: number;
}

/** The renter moved in: RoomZA keeps its commission and the owner gets the rest. */
export function releaseBreakdown(input: { amountCents: number; commissionBps: number }): ReleaseBreakdown {
  const commission = commissionCents(input.amountCents, input.commissionBps);
  return { commissionCents: commission, ownerPayoutCents: input.amountCents - commission };
}

export interface RefundBreakdown {
  cancellationFeeCents: number;
  renterRefundCents: number;
}

/**
 * The deposit goes back to the renter. When the renter is the one cancelling,
 * RoomZA keeps a cancellation fee equal to the processing fee the provider
 * charged, capped at the deposit itself.
 */
export function refundBreakdown(input: {
  amountCents: number;
  providerFeeCents: number;
  cancellationFeeApplies: boolean;
}): RefundBreakdown {
  assertPositiveCents(input.amountCents, "Deposit amount");
  assertNonNegativeCents(input.providerFeeCents, "Processing fee");
  const fee = input.cancellationFeeApplies ? Math.min(input.providerFeeCents, input.amountCents) : 0;
  return { cancellationFeeCents: fee, renterRefundCents: input.amountCents - fee };
}
