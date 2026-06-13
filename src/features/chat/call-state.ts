/**
 * Pure call-state transition rules for ad-hoc conversation video calls.
 *
 * This module mirrors the authoritative transition rules enforced by the
 * `start_call_session` / `end_call_session` Postgres RPCs so the UI can gate
 * controls and tests can assert the rule set in isolation. The database
 * remains the source of truth; this module is a pure, I/O-free reflection of
 * the same logic.
 */

export type CallStatus = "ringing" | "active" | "ended" | "declined" | "missed";
export type CallAction = "join" | "decline" | "missed" | "end";

/** Statuses from which a call may still transition. */
export const NON_TERMINAL: CallStatus[] = ["ringing", "active"];

/** Statuses that absorb all further actions. */
export const TERMINAL: CallStatus[] = ["ended", "declined", "missed"];

/** Returns true when the status is terminal (no legal move remains). */
export function isTerminal(status: CallStatus): boolean {
    return TERMINAL.includes(status);
}

/**
 * Returns the resulting status for a legal `(status, action)` move, or `null`
 * if the move is illegal.
 *
 * Rules (identical to the `end_call_session` RPC):
 * - Terminal statuses are absorbing: any action returns `null`.
 * - `join` is legal only from `ringing` → `active`.
 * - `decline` is legal only from `ringing` → `declined`.
 * - `missed` is legal only from `ringing` → `missed`.
 * - `end` is legal from any non-terminal status → `ended`.
 */
export function nextStatus(status: CallStatus, action: CallAction): CallStatus | null {
    if (isTerminal(status)) {
        return null;
    }

    switch (action) {
        case "join":
            return status === "ringing" ? "active" : null;
        case "decline":
            return status === "ringing" ? "declined" : null;
        case "missed":
            return status === "ringing" ? "missed" : null;
        case "end":
            return "ended";
        default:
            return null;
    }
}

/**
 * Classifies a finished session for history/notification copy.
 *
 * Returns `"completed"` if and only if the call was ever answered
 * (`answeredAt` is set). When it was never answered, the outcome is derived
 * from the terminal status: `missed`, `declined`, or `cancelled` (the latter
 * covers an `ended` session that was never answered, i.e. the caller hung up
 * before the callee picked up).
 */
export function callOutcome(session: {
    status: CallStatus;
    answeredAt: string | null;
}): "completed" | "missed" | "declined" | "cancelled" {
    if (session.answeredAt !== null) {
        return "completed";
    }

    switch (session.status) {
        case "missed":
            return "missed";
        case "declined":
            return "declined";
        default:
            return "cancelled";
    }
}
