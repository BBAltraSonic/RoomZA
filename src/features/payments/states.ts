/**
 * Deposit states and the timing rules that decide how a held deposit leaves
 * RoomZA. The database functions in the deposit payments migration enforce the
 * same table; keep the two in step.
 */

export const DEPOSIT_STATES = [
  "awaiting_payment",
  "held",
  "disputed",
  "releasing",
  "released",
  "refunding",
  "refunded",
  "cancelled",
] as const;

export type DepositState = (typeof DEPOSIT_STATES)[number];

const transitions: Record<DepositState, readonly DepositState[]> = {
  awaiting_payment: ["held", "cancelled"],
  held: ["releasing", "refunding", "disputed"],
  disputed: ["releasing", "refunding"],
  releasing: ["released"],
  released: [],
  refunding: ["refunded"],
  refunded: [],
  cancelled: [],
};

export function permittedDepositTransitions(current: DepositState): readonly DepositState[] {
  return transitions[current];
}

export function isTerminalDepositState(state: DepositState): boolean {
  return transitions[state].length === 0;
}

export function isPermittedDepositTransition(from: DepositState, to: DepositState): boolean {
  return transitions[from].includes(to);
}

const HOUR_MS = 60 * 60 * 1000;
/** South Africa keeps UTC+2 all year, so no time-zone database is needed. */
const SAST_OFFSET_HOURS = 2;
/** The renter has the whole move-in day plus 48 hours to respond. */
const AUTO_RELEASE_HOURS_AFTER_MOVE_IN_START = 72;
const OWNER_CONTEST_HOURS = 24;

/** Midnight South African time at the start of a `YYYY-MM-DD` move-in date. */
export function moveInStart(moveInDate: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(moveInDate);
  if (!match) throw new RangeError("Move-in date must be a YYYY-MM-DD calendar date");
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const utcMidnight = new Date(Date.UTC(year, month - 1, day));
  // Date.UTC rolls impossible dates over (30 February becomes 2 March); reject those.
  if (utcMidnight.getUTCMonth() !== month - 1 || utcMidnight.getUTCDate() !== day) {
    throw new RangeError("Move-in date must be a YYYY-MM-DD calendar date");
  }
  return new Date(utcMidnight.getTime() - SAST_OFFSET_HOURS * HOUR_MS);
}

/**
 * When a held deposit releases to the owner if the renter never responds: 72
 * hours after the move-in date starts, or after the payment when the renter
 * paid later than that. Matches private.deposit_answer_from in the database.
 */
export function autoReleaseAt(moveInDate: string, paidAt?: Date | null): Date {
  const answerFrom = Math.max(moveInStart(moveInDate).getTime(), paidAt?.getTime() ?? Number.NEGATIVE_INFINITY);
  return new Date(answerFrom + AUTO_RELEASE_HOURS_AFTER_MOVE_IN_START * HOUR_MS);
}

export type RenterCancellationOutcome = "refund_now" | "owner_contest_window";

/**
 * Before the move-in date the renter cannot have moved in, so the refund
 * starts at once. From the move-in date onwards the owner may contest.
 */
export function renterCancellationOutcome(moveInDate: string, now: Date): RenterCancellationOutcome {
  return now.getTime() < moveInStart(moveInDate).getTime() ? "refund_now" : "owner_contest_window";
}

/** The owner's last moment to contest a refund the renter asked for at `requestedAt`. */
export function contestDeadline(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + OWNER_CONTEST_HOURS * HOUR_MS);
}
