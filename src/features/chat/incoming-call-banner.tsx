"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, PhoneIncoming, PhoneOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/browser";

import { declineCall, endCall, joinCall, type CallSession } from "./call-actions";

/**
 * Ring_Window: the bounded no-answer interval (ms) after which a `ringing`
 * Call_Session is recorded as `missed` (Requirement 4.2). The design does not
 * fix a specific value, so we use a sensible 30s window.
 */
export const RING_WINDOW_MS = 30_000;

type IncomingCallBannerProps = {
  /** Conversation whose `call_sessions` rows this banner listens to. */
  conversationId: string;
  /**
   * Id of the signed-in user. Only the Callee sees the incoming-call invite;
   * the Caller never sees their own ring as an incoming call.
   */
  currentUserId: string;
  /**
   * Optional seed session (e.g. from `getActiveCall`) so the banner reflects an
   * in-flight ring on first render / reconnect.
   */
  initialSession?: CallSession | null;
  /** Optional display name for the Caller, shown in the invite copy. */
  callerName?: string;
  /**
   * Notifies the host (e.g. `ConversationCallProvider`) of the latest session
   * observed over Realtime so it can render the embedded call when `active`.
   */
  onSessionUpdate?: (session: CallSession | null) => void;
};

/**
 * Subscribes to `call_sessions` for a conversation over Supabase Realtime
 * `postgres_changes` (channel `call_${conversationId}`, filtered by
 * `conversation_id`) and renders the incoming-call invite to the Callee while a
 * session is `ringing` (Requirements 2.1, 2.2). Accept joins the call
 * (`joinCall`) and Decline declines it (`declineCall`) (Requirements 2.3, 2.4).
 * While a session rings, a Ring_Window timeout fires `endCall(id, "missed")` on
 * expiry (Requirements 4.2, 6.2).
 *
 * The subscription mirrors the `ChatBox` pattern: a memoised browser client, a
 * single channel opened in an effect, and channel removal on cleanup. RLS
 * guarantees only the Caller/Callee receive events for a given session.
 */
export function IncomingCallBanner({
  conversationId,
  currentUserId,
  initialSession = null,
  callerName,
  onSessionUpdate,
}: IncomingCallBannerProps) {
  const [session, setSession] = useState<CallSession | null>(initialSession);
  const [isJoining, setIsJoining] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  // Keep the latest onSessionUpdate without forcing the subscription effect to
  // re-run (and thus re-open the channel) when the callback identity changes.
  const onSessionUpdateRef = useRef(onSessionUpdate);
  useEffect(() => {
    onSessionUpdateRef.current = onSessionUpdate;
  }, [onSessionUpdate]);

  const applySession = useCallback((next: CallSession | null) => {
    setSession(next);
    onSessionUpdateRef.current?.(next);
  }, []);

  // Realtime subscription on call_sessions for this conversation. Listens to
  // both INSERT (a new ringing call) and UPDATE (status transitions).
  useEffect(() => {
    const channel = supabase
      .channel(`call_${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_sessions",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          applySession(payload.new as CallSession);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "call_sessions",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          applySession(payload.new as CallSession);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, supabase, applySession]);

  const ringingSessionId =
    session && session.status === "ringing" ? session.id : null;

  // Ring_Window no-answer timeout (Req 4.2). Armed only while a session rings;
  // cleared when it leaves `ringing` or on unmount. `endCall(id, "missed")` is
  // idempotent server-side, so a late accept/decline racing the timeout
  // resolves deterministically.
  useEffect(() => {
    if (!ringingSessionId) {
      return;
    }

    const timer = setTimeout(() => {
      void endCall(ringingSessionId, "missed");
    }, RING_WINDOW_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [ringingSessionId]);

  // Only the Callee sees the incoming invite, and only while ringing.
  const showInvite =
    session !== null &&
    session.status === "ringing" &&
    session.callee_id === currentUserId;

  if (!showInvite) {
    return null;
  }

  async function handleAccept() {
    if (!session || isJoining || isDeclining) return;
    setIsJoining(true);
    setError(null);
    const result = await joinCall(session.id);
    if (!result.success) {
      setError(result.error);
    }
    setIsJoining(false);
  }

  async function handleDecline() {
    if (!session || isJoining || isDeclining) return;
    setIsDeclining(true);
    setError(null);
    const result = await declineCall(session.id);
    if (!result.success) {
      setError(result.error);
    }
    setIsDeclining(false);
  }

  const busy = isJoining || isDeclining;
  const callerLabel = callerName ? `${callerName} is calling` : "Incoming video call";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-center gap-3 border-b border-border bg-warm-surface px-4 py-3 sm:px-6"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-forest/10 text-forest">
        <PhoneIncoming className="size-5 animate-pulse" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold tracking-tight text-ink">{callerLabel}</p>
        {error ? (
          <p className="mt-0.5 truncate text-xs font-medium text-destructive">{error}</p>
        ) : (
          <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
            Tap accept to join the video call
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={handleDecline}
          disabled={busy}
          aria-label="Decline call"
        >
          {isDeclining ? <Loader2 className="animate-spin" /> : <PhoneOff />}
          Decline
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleAccept}
          disabled={busy}
          aria-label="Accept call"
          className="bg-forest text-primary-foreground hover:bg-forest/90"
        >
          {isJoining ? <Loader2 className="animate-spin" /> : <PhoneIncoming />}
          Accept
        </Button>
      </div>
    </div>
  );
}
