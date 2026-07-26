"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Video } from "lucide-react";

import { getActiveCall, type CallSession } from "./call-actions";
import { reconcileEndedSession, shouldShowActiveCall } from "./call-view-state";
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
  /** Conversation header rendered inside the shared call-state boundary. */
  header?: React.ReactNode;
  /** The chat surface (e.g. `ChatBox`) rendered beneath the call UI. */
  children: React.ReactNode;
};

type ConversationCallController = {
  session: CallSession | null;
  setSession: (session: CallSession | null) => void;
};

const ConversationCallContext = createContext<ConversationCallController | null>(null);

export function useConversationCallController(): ConversationCallController | null {
  return useContext(ConversationCallContext);
}

const ConversationCall = dynamic(
  () => import("./conversation-call").then((module) => module.ConversationCall),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-white/10 bg-ink text-primary-foreground">
        <Video className="size-5 text-accent" />
        <p className="mt-3 text-sm font-semibold">Loading call</p>
      </div>
    ),
  },
);

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
  header,
  children,
}: ConversationCallProviderProps) {
  const [session, setSession] = useState<CallSession | null>(initialSession);

  const applySession = useCallback((next: CallSession | null) => {
    setSession(
      next && (next.status === "ringing" || next.status === "active")
        ? next
        : null,
    );
  }, []);

  // Reconcile the seeded state with the authoritative active call on mount
  // (Req 3.4). Realtime events from the banner drive subsequent updates.
  useEffect(() => {
    let cancelled = false;

    void getActiveCall(conversationId).then((result) => {
      if (cancelled || !result.success) {
        return;
      }
      applySession(result.data.session);
    });

    return () => {
      cancelled = true;
    };
  }, [conversationId, applySession]);

  const handleSessionUpdate = useCallback((next: CallSession | null) => {
    applySession(next);
  }, [applySession]);

  const handleEnded = useCallback((endedSessionId: string) => {
    setSession((current) => reconcileEndedSession(current, endedSessionId));

    // Re-read the database after a terminal action. If Realtime missed an
    // update, or a newer call won a race with the ended session, the shared
    // page state still converges on the authoritative non-terminal row.
    void getActiveCall(conversationId).then((result) => {
      if (!result.success) return;
      setSession((current) => {
        if (current && current.id !== endedSessionId) return current;
        return result.data.session;
      });
    });
  }, [conversationId]);

  const controller = useMemo(
    () => ({ session, setSession: applySession }),
    [session, applySession],
  );

  return (
    <ConversationCallContext.Provider value={controller}>
      <div className="flex h-full flex-col">
        {header}

        <IncomingCallBanner
          conversationId={conversationId}
          currentUserId={currentUserId}
          initialSession={session}
          callerName={callerName}
          onSessionUpdate={handleSessionUpdate}
        />

        {session && shouldShowActiveCall(session) ? (
          <div className="border-b border-border bg-ink p-4 sm:p-6">
            <ConversationCall session={session} onEnded={handleEnded} />
          </div>
        ) : null}

        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </ConversationCallContext.Provider>
  );
}
