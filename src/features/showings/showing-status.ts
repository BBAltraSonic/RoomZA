/**
 * Pure state-machine mirror for Instant Connect showing requests.
 *
 * Mirrors the authoritative transition rules enforced by the `request_showing`
 * / `respond_showing` Postgres RPCs (design §3.3) so the UI can gate controls
 * and tests can assert the rule set in isolation. The database remains the
 * source of truth; this module is a pure, I/O-free reflection — no imports, no
 * side effects — matching `call-state.ts`.
 */

export type ShowingStatus =
  | "requested"
  | "accepted"
  | "checked_in"
  | "declined"
  | "completed"
  | "cancelled"
  | "expired";

export type ShowingWindow = "now" | "within_15" | "within_30" | "today";

/**
 * Actions off a live request. `accept`/`decline` are landlord-only, `check_in`
 * is renter-only, `complete`/`cancel` are either party — role is enforced by
 * the RPC, not this pure move table.
 */
export type ShowingAction = "accept" | "decline" | "check_in" | "complete" | "cancel";

/** Statuses from which a request may still transition. */
export const NON_TERMINAL: ShowingStatus[] = ["requested", "accepted", "checked_in"];

/** Absorbing statuses. */
export const TERMINAL: ShowingStatus[] = ["declined", "completed", "cancelled", "expired"];

/** True when the status is terminal (no legal move remains). */
export function isTerminal(status: ShowingStatus): boolean {
  return TERMINAL.includes(status);
}

/** True when a request is live (occupies the single-live-per-pair slot). */
export function isLive(status: ShowingStatus): boolean {
  return NON_TERMINAL.includes(status);
}

/**
 * Returns the resulting status for a legal `(status, action)` move, or `null`
 * if illegal. Identical to the `respond_showing` RPC:
 * - Terminal statuses absorb every action → `null`.
 * - `accept`   : requested → accepted.
 * - `decline`  : requested → declined.
 * - `check_in` : accepted  → checked_in.
 * - `complete` : checked_in → completed.
 * - `cancel`   : any non-terminal → cancelled.
 */
export function nextStatus(status: ShowingStatus, action: ShowingAction): ShowingStatus | null {
  if (isTerminal(status)) {
    return null;
  }

  switch (action) {
    case "accept":
      return status === "requested" ? "accepted" : null;
    case "decline":
      return status === "requested" ? "declined" : null;
    case "check_in":
      return status === "accepted" ? "checked_in" : null;
    case "complete":
      return status === "checked_in" ? "completed" : null;
    case "cancel":
      return "cancelled";
    default:
      return null;
  }
}

/** Grace/validity window in minutes for each urgency choice (mirrors the RPC). */
export const WINDOW_MINUTES: Record<ShowingWindow, number> = {
  now: 15,
  within_15: 15,
  within_30: 30,
  today: 12 * 60,
};

/**
 * Computes the `expires_at` epoch-ms for a request created at `requestedAtMs`.
 * Mirrors `showing_window_expiry()`; kept pure for client countdowns.
 */
export function expiryFor(window: ShowingWindow, requestedAtMs: number): number {
  return requestedAtMs + WINDOW_MINUTES[window] * 60_000;
}

/** True when a still-`requested` row has passed its window at `nowMs`. */
export function isExpired(
  request: { status: ShowingStatus; expiresAtMs: number },
  nowMs: number,
): boolean {
  return request.status === "requested" && request.expiresAtMs < nowMs;
}

/** Short human label for a status, for banners/history copy. */
export function showingStatusLabel(status: ShowingStatus): string {
  switch (status) {
    case "requested":
      return "Awaiting response";
    case "accepted":
      return "Accepted";
    case "checked_in":
      return "Checked in";
    case "declined":
      return "Declined";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "expired":
      return "Expired";
  }
}
