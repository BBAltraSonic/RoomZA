/**
 * Pure view-state selectors for the conversation call UI.
 *
 * These mirror the render decisions made by `ConversationCallProvider` and
 * `IncomingCallBanner` so the rules can be unit-tested in isolation (the repo
 * tests logic in `node`, not component renders). Both components import these
 * helpers, so the tests exercise the exact predicates the UI uses.
 */

import type { CallStatus } from "./call-state";

/**
 * The embedded call surface is shown — for BOTH caller and callee (Req 2.5) —
 * only while the session is `active`.
 */
export function shouldShowActiveCall(session: { status: CallStatus } | null): boolean {
    return session !== null && session.status === "active";
}

/**
 * The incoming-call invite is shown only to the Callee, and only while the
 * session is `ringing` (Req 2.1, 2.2). The Caller never sees their own ring.
 */
export function shouldShowIncomingInvite(
    session: { status: CallStatus; callee_id: string } | null,
    currentUserId: string,
): boolean {
    return (
        session !== null &&
        session.status === "ringing" &&
        session.callee_id === currentUserId
    );
}

/**
 * Drops the held session when the ended session id matches it; otherwise leaves
 * the current session untouched (a late `onEnded` for a stale session must not
 * clear a newer call).
 */
export function reconcileEndedSession<T extends { id: string }>(
    current: T | null,
    endedSessionId: string,
): T | null {
    return current && current.id === endedSessionId ? null : current;
}
