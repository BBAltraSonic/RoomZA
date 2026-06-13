"use client";

import { useCallback, useEffect, useState } from "react";

import { getActiveCall, type CallSession } from "./call-actions";
import { ConversationCall } from "./conversation-call";
import { IncomingCallBanner } from "./incoming-call-banner";

type ConversationCallProviderProps = {
  /** Conversation whose call state this provider owns. */
  conversationId: string;
  /** Id of the signed-in user (used to scope the incoming-call invite). */
  currentUserId: string;
  /**
   * Active call seeded server-side from `getActiveCall` by the conversation
   * route (task 8.1) so the call surface reflects an in-flight call on first
   * render / reconnect (Req 3.4).
   */
  initialSession?: CallSession | null;
  /** Optional display name for the Caller, forwarded to the incoming invite. */
  callerName?: string;
  /** The chat surface (e.g. `ChatBox`) rendered beneath the call UI. */
  children: React.ReactNode;
};

/**
 * Hosts the conversation's call UI around the chat surface (Requirements 2.5,
 * 3.4).
 *
 * Holds the authoritative active-session state, seeded from `initialSession`.
 * It mounts `IncomingCallBanner` — which owns the Realtime subscription on
 * `call_sessions` — and forwards every observed session through
 * `onSessionUpdate` into local state. When the held session is `active`, the
 * embedded `ConversationCall` is rendered for BOTH the caller and the callee
 * (Req 2.5); when the session reaches a terminal status or becomes null the
 * call surface is dropped.
 *
 * Because the banner owns the subscription, reconciliation on reconnect is
 * handled pragmatically: the provider calls `getActiveCall` once on mount to
 * resync the seeded state against the authoritative DB row, and relies on
 * `onSessionUpdate` from the banner's Realtime events thereafter (Req 3.4).
 */
export function ConversationCallProvider({
  conversationId,
  currentUserId,
  initialSession = null,
  callerName,
  children,
}: ConversationCallProviderProps) {
  const [session, setSession] = useState<CallSession | null>(initialSession);

  // Reconcile the seeded state with the authoritative active call on mount
  // (Req 3.4). Realtime events from the banner drive subsequent updates.
  useEffect(() => {
    let cancelled = false;

    void getActiveCall(conversationId).then((result) => {
      if (cancelled || !result.success) {
        return;
      }
      setSession(result.data.session);
    });

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const handleSessionUpdate = useCallback((next: CallSession | null) => {
    setSession(next);
  }, []);

  const handleEnded = useCallback((endedSessionId: string) => {
    setSession((current) =>
      current && current.id === endedSessionId ? null : current,
    );
  }, []);

  const showCall = session !== null && session.status === "active";

  return (
    <div className="flex h-full flex-col">
      <IncomingCallBanner
        conversationId={conversationId}
        currentUserId={currentUserId}
        initialSession={session}
        callerName={callerName}
        onSessionUpdate={handleSessionUpdate}
      />

      {showCall ? (
        <div className="border-b border-border bg-ink p-4 sm:p-6">
          <ConversationCall session={session} onEnded={handleEnded} />
        </div>
      ) : null}

      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
