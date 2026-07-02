"use server";

import { createClient } from "@/lib/supabase/server";
import { actionSuccess, actionFailure, type ActionResult } from "@/lib/action-result";
import { enqueueNotificationEvent } from "@/features/notifications/outbox";
import { callOutcome, type CallStatus } from "@/features/chat/call-state";
import { logger } from "@/lib/logger";
import type { Database } from "@/lib/supabase/types";
import { z } from "zod";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** A single ad-hoc video call attached to a conversation. */
export type CallSession = Database["public"]["Tables"]["call_sessions"]["Row"];

const callActionIdInputSchema = z.string().min(1, "Invalid id.");
const endCallInputSchema = z.object({
    sessionId: z.string().min(1, "Invalid call id."),
    reason: z.enum(["end", "missed"]).optional(),
});

/**
 * Enqueues a single call notification through the existing outbox pattern
 * (Requirements 6.1, 6.2, 6.3): insert a `notification_events` row, then hand
 * its id to `enqueueNotificationEvent`.
 *
 * The whole block is wrapped in try/catch so a notification failure NEVER
 * fails the originating call action (Req 6.4). `enqueueNotificationEvent` is
 * already non-fatal internally; this guards the insert as well.
 */
async function enqueueCallNotification(
    supabase: SupabaseServerClient,
    notification: {
        recipientId: string;
        idempotencyKey: string;
        kind: "incoming" | "missed" | "declined";
        conversationId: string;
        listingId: string;
        message: string;
    },
): Promise<void> {
    try {
        const { data: event } = await supabase
            .from("notification_events")
            .insert({
                recipient_id: notification.recipientId,
                type: "incoming_call" as const,
                idempotency_key: notification.idempotencyKey,
                payload: {
                    kind: notification.kind,
                    conversationId: notification.conversationId,
                    listingId: notification.listingId,
                    message: notification.message,
                },
            })
            .select("id")
            .single();

        if (event?.id) {
            await enqueueNotificationEvent(event.id);
        }
    } catch (error) {
        logger.error("Failed to enqueue call notification", {
            recipientId: notification.recipientId,
            kind: notification.kind,
            error,
        });
    }
}

/** Human-readable transcript copy for a finished call, keyed by `callOutcome`. */
function callOutcomeMessage(outcome: ReturnType<typeof callOutcome>): string {
    switch (outcome) {
        case "completed":
            return "Video call ended.";
        case "missed":
            return "Missed video call.";
        case "declined":
            return "Video call declined.";
        case "cancelled":
            return "Video call cancelled.";
    }
}

/**
 * Side effects to run after a successful terminal transition from
 * `declineCall` / `endCall` (Requirements 4.6, 6.2, 6.3).
 *
 * Fetches the session to resolve caller/conversation/listing context, then:
 * - For `missed`/`declined`, enqueues a notification addressed to the Caller.
 * - For any terminal status, records a system message in `messages` capturing
 *   the outcome via `callOutcome`.
 *
 * Every step is non-fatal: a failure here never fails the call action (Req 6.4).
 */
async function handleTerminalCallSideEffects(
    supabase: SupabaseServerClient,
    sessionId: string,
    status: CallStatus,
): Promise<void> {
    try {
        const { data: session } = await supabase
            .from("call_sessions")
            .select("caller_id, conversation_id, listing_id, status, answered_at")
            .eq("id", sessionId)
            .single();

        if (!session) {
            return;
        }

        // Notify the Caller when the call was missed or declined (Req 6.2, 6.3).
        if (status === "missed" || status === "declined") {
            await enqueueCallNotification(supabase, {
                recipientId: session.caller_id,
                idempotencyKey: `incoming_call:${status}:${sessionId}`,
                kind: status,
                conversationId: session.conversation_id,
                listingId: session.listing_id,
                message:
                    status === "missed"
                        ? "Your video call was missed."
                        : "Your video call was declined.",
            });
        }

        // Record the call outcome in the transcript (Req 4.6). Non-fatal.
        const outcome = callOutcome({
            status: session.status as CallStatus,
            answeredAt: session.answered_at,
        });

        const { error: messageError } = await supabase.from("messages").insert({
            conversation_id: session.conversation_id,
            sender_id: session.caller_id,
            listing_id: session.listing_id,
            content: callOutcomeMessage(outcome),
        });

        if (messageError) {
            logger.error("Failed to record call outcome system message", {
                sessionId,
                error: messageError.message,
            });
        }
    } catch (error) {
        logger.error("Failed to run terminal call side effects", { sessionId, error });
    }
}

/**
 * Shared guarded path for every transition off `ringing`/`active`.
 *
 * Verifies the requester is authenticated, then delegates to the
 * `end_call_session` RPC, which re-checks participation and transition
 * legality (the DB is authoritative; `call-state.ts` mirrors the same rule set
 * for the UI). The RPC `result` is mapped to an `ActionResult`:
 * - `updated` / `noop` → success with the returned `new_status` (idempotent;
 *   a `noop` means the session was already terminal, which is safe to treat as
 *   success for racing decline/end/timeout callers).
 * - `access_denied` → "You are not part of this conversation."
 * - `invalid_transition` → benign error so the client refetches via
 *   `getActiveCall` to resync with the authoritative state.
 */
async function transitionCall(
    sessionId: string,
    action: "join" | "decline" | "end" | "missed",
): Promise<ActionResult<{ status: CallStatus }>> {
    const parsedSessionId = callActionIdInputSchema.safeParse(sessionId);
    if (!parsedSessionId.success) {
        return actionFailure("Invalid call id.");
    }

    const supabase = await createClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
        return actionFailure("You must be signed in to manage a call.");
    }

    const { data, error } = await supabase.rpc("end_call_session", {
        target_session_id: parsedSessionId.data,
        action,
    });

    if (error) {
        return actionFailure(error.message);
    }

    const outcome = data?.[0];
    if (!outcome) {
        return actionFailure("Failed to update the call.");
    }

    switch (outcome.result) {
        case "updated":
        case "noop": {
            if (!outcome.new_status) {
                return actionFailure("Failed to update the call.");
            }
            return actionSuccess({ status: outcome.new_status as CallStatus });
        }
        case "access_denied":
            return actionFailure("You are not part of this conversation.");
        case "invalid_transition":
            return actionFailure("This call is no longer available.");
        default:
            return actionFailure("Failed to update the call.");
    }
}

/**
 * Starts a video call in a conversation (Requirements 1.1, 1.4, 1.5, 1.6, 7.4).
 *
 * Verifies the requester is authenticated, then delegates to the
 * `start_call_session` RPC which performs the participant check first, enforces
 * the single-active-call invariant, mints the room, and inserts the `ringing`
 * row atomically. The RPC `result` is mapped to an `ActionResult`:
 * - `started` → success with the freshly created session
 * - `access_denied` → "You are not part of this conversation."
 * - `call_in_progress` → "A call is already active in this conversation."
 * - `unauthenticated` → auth error
 */
export async function startCall(
    conversationId: string,
): Promise<ActionResult<{ session: CallSession }>> {
    const parsedInput = callActionIdInputSchema.safeParse(conversationId);
    if (!parsedInput.success) {
        return actionFailure("Invalid conversation id.");
    }

    const supabase = await createClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
        return actionFailure("You must be signed in to start a call.");
    }

    const { data, error } = await supabase.rpc("start_call_session", {
        target_conversation_id: parsedInput.data,
    });

    if (error) {
        return actionFailure(error.message);
    }

    const outcome = data?.[0];
    if (!outcome) {
        return actionFailure("Failed to start the call.");
    }

    switch (outcome.result) {
        case "started": {
            if (!outcome.session_id) {
                return actionFailure("Failed to start the call.");
            }

            const { data: session, error: fetchError } = await supabase
                .from("call_sessions")
                .select("*")
                .eq("id", outcome.session_id)
                .single();

            if (fetchError || !session) {
                return actionFailure(fetchError?.message ?? "Failed to load the started call.");
            }

            // Notify the Callee of the incoming call (Req 6.1). Non-fatal (Req 6.4).
            await enqueueCallNotification(supabase, {
                recipientId: session.callee_id,
                idempotencyKey: `incoming_call:ringing:${session.id}`,
                kind: "incoming",
                conversationId: session.conversation_id,
                listingId: session.listing_id,
                message: "You have an incoming video call.",
            });

            return actionSuccess({ session });
        }
        case "access_denied":
            return actionFailure("You are not part of this conversation.");
        case "call_in_progress":
            return actionFailure("A call is already active in this conversation.");
        case "unauthenticated":
            return actionFailure("You must be signed in to start a call.");
        default:
            return actionFailure("Failed to start the call.");
    }
}

/**
 * Returns the current non-terminal (`ringing` or `active`) call session for a
 * conversation, or `null` when there is none (Requirements 3.4).
 *
 * Used to seed the call surface on initial render and to reconcile UI state on
 * a realtime reconnect. RLS restricts visibility to the two participants, so a
 * non-participant simply gets `null`.
 */
export async function getActiveCall(
    conversationId: string,
): Promise<ActionResult<{ session: CallSession | null }>> {
    const parsedInput = callActionIdInputSchema.safeParse(conversationId);
    if (!parsedInput.success) {
        return actionFailure("Invalid conversation id.");
    }

    const supabase = await createClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
        return actionFailure("You must be signed in to view calls.");
    }

    const { data: session, error } = await supabase
        .from("call_sessions")
        .select("*")
        .eq("conversation_id", parsedInput.data)
        .in("status", ["ringing", "active"])
        .maybeSingle();

    if (error) {
        return actionFailure(error.message);
    }

    return actionSuccess({ session: session ?? null });
}

/**
 * Joins an incoming call as the callee, transitioning `ringing → active`
 * (Requirements 2.3, 2.6, 7.5).
 *
 * Thin wrapper over `end_call_session(id, 'join')`. Joining a session that is
 * no longer ringing yields `invalid_transition`, surfaced as a benign error so
 * the client can refetch via `getActiveCall` and resync.
 */
export async function joinCall(sessionId: string): Promise<ActionResult<{ status: CallStatus }>> {
    const parsedInput = callActionIdInputSchema.safeParse(sessionId);
    if (!parsedInput.success) {
        return actionFailure("Invalid call id.");
    }

    return transitionCall(parsedInput.data, "join");
}

/**
 * Declines an incoming call, transitioning `ringing → declined`
 * (Requirements 2.4, 2.7, 7.5).
 *
 * Thin wrapper over `end_call_session(id, 'decline')`. Idempotent: a session
 * that is already terminal returns `noop` and is treated as success so a
 * decline racing a timeout resolves cleanly.
 */
export async function declineCall(sessionId: string): Promise<ActionResult<{ status: CallStatus }>> {
    const parsedInput = callActionIdInputSchema.safeParse(sessionId);
    if (!parsedInput.success) {
        return actionFailure("Invalid call id.");
    }

    const result = await transitionCall(parsedInput.data, "decline");

    if (result.success) {
        const supabase = await createClient();
        await handleTerminalCallSideEffects(supabase, parsedInput.data, result.data.status);
    }

    return result;
}

/**
 * Ends an active or ringing call (Requirements 4.1, 4.2, 4.3, 7.5).
 *
 * Thin wrapper over `end_call_session(id, reason ?? 'end')`. The default `end`
 * transitions any non-terminal session to `ended`; passing `"missed"` serves
 * the ring-timeout no-answer path (`ringing → missed`). Idempotent via the
 * RPC's `noop` result, so a late button press racing the timeout resolves
 * deterministically.
 */
export async function endCall(
    sessionId: string,
    reason?: "end" | "missed",
): Promise<ActionResult<{ status: CallStatus }>> {
    const parsedInput = endCallInputSchema.safeParse({ sessionId, reason });
    if (!parsedInput.success) {
        return actionFailure("Invalid call update.");
    }

    const result = await transitionCall(parsedInput.data.sessionId, parsedInput.data.reason ?? "end");

    if (result.success) {
        const supabase = await createClient();
        await handleTerminalCallSideEffects(supabase, parsedInput.data.sessionId, result.data.status);
    }

    return result;
}
