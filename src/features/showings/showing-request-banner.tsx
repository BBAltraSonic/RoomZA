"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, MessageSquare, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PendingGlyph } from "@/lib/motion/primitives";
import { createClient } from "@/lib/supabase/browser";

import { acceptShowing, cancelShowing, completeShowing, declineShowing, type ShowingRequest } from "./actions";
import { isExpired, showingStatusLabel } from "./showing-status";

const WINDOW_COPY: Record<ShowingRequest["window_choice"], string> = {
  now: "wants to view now",
  within_15: "can be there within 15 min",
  within_30: "can be there within 30 min",
  today: "wants to view today",
};

type ShowingRequestBannerProps = {
  /** Landlord viewing their inbox; only their own requests are subscribed. */
  landlordId: string;
  /**
   * Optional seed request (e.g. from a server fetch) so the banner reflects an
   * in-flight request on first render / reconnect.
   */
  initialRequest?: ShowingRequest | null;
  /** Optional renter display name for the invite copy. */
  renterName?: string;
};

/**
 * Landlord-facing incoming instant-showing banner (design §3.3). Near-mirror of
 * `IncomingCallBanner`: subscribes to `showing_requests` over Supabase Realtime
 * `postgres_changes` (channel `showings_${landlordId}`, filtered by
 * `landlord_id`) and renders the accept/decline invite while a request is
 * `requested`. RLS guarantees only the two parties receive events, so the
 * landlord filter is safe.
 *
 * Presence is persisted-first; this live subscription is scoped to the landlord
 * dashboard where an actionable, low-latency inbox justifies a single socket —
 * it is not part of the ambient browsing path.
 */
export function ShowingRequestBanner({
  landlordId,
  initialRequest = null,
  renterName,
}: ShowingRequestBannerProps) {
  const [request, setRequest] = useState<ShowingRequest | null>(initialRequest);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const supabase = useMemo(() => createClient(), []);

  const applyRequest = useCallback((next: ShowingRequest | null) => {
    setRequest(next);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`showings_${landlordId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "showing_requests",
          filter: `landlord_id=eq.${landlordId}`,
        },
        (payload) => {
          applyRequest(payload.new as ShowingRequest);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "showing_requests",
          filter: `landlord_id=eq.${landlordId}`,
        },
        (payload) => {
          applyRequest(payload.new as ShowingRequest);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [landlordId, supabase, applyRequest]);

  useEffect(() => {
    if (!request || request.status !== "requested") return;
    const remaining = Math.max(0, new Date(request.expires_at).getTime() - Date.now());
    const timeout = window.setTimeout(() => setNow(Date.now()), remaining + 50);
    return () => window.clearTimeout(timeout);
  }, [request]);

  // Only a still-pending, unexpired request is actionable.
  const pending =
    request &&
    request.status === "requested" &&
    !isExpired({ status: request.status, expiresAtMs: new Date(request.expires_at).getTime() }, now)
      ? request
      : null;

  async function handleAccept() {
    if (!pending || isAccepting || isDeclining) return;
    setIsAccepting(true);
    setError(null);
    const result = await acceptShowing(pending.id);
    if (!result.success) {
      setError(result.error);
    } else {
      setRequest((current) => current ? { ...current, status: "accepted" } : current);
    }
    setIsAccepting(false);
  }

  async function handleDecline() {
    if (!pending || isAccepting || isDeclining) return;
    setIsDeclining(true);
    setError(null);
    const result = await declineShowing(pending.id);
    if (!result.success) {
      setError(result.error);
    } else {
      setRequest((current) => current ? { ...current, status: "declined" } : current);
    }
    setIsDeclining(false);
  }

  const busy = isAccepting || isDeclining;
  const who = renterName ?? "A renter";
  const active = request && (request.status === "accepted" || request.status === "checked_in") ? request : null;

  async function handleActiveAction(action: "cancel" | "complete") {
    if (!active || busy) return;
    setIsAccepting(true);
    setError(null);
    const result = action === "cancel" ? await cancelShowing(active.id) : await completeShowing(active.id);
    if (!result.success) setError(result.error);
    else setRequest((current) => current ? { ...current, status: result.data.status } : current);
    setIsAccepting(false);
  }

  if (active) {
    return (
      <div role="status" aria-live="polite" className="flex flex-wrap items-center gap-3 border-b border-border bg-accent px-4 py-3 sm:px-6">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-forest/10 text-forest">
          <CalendarClock className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">{active.status === "checked_in" ? `${who} has checked in` : `Showing accepted for ${who}`}</p>
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">{error ?? "Keep coordination inside the property conversation."}</p>
        </div>
        {active.conversation_id ? <Button render={<a href={`/messages/${active.conversation_id}`} />} size="sm" variant="outline"><MessageSquare className="size-4" />Message</Button> : null}
        {active.status === "checked_in" ? <Button size="sm" onClick={() => void handleActiveAction("complete")} disabled={busy}>Complete</Button> : null}
        <Button size="sm" variant="ghost" onClick={() => void handleActiveAction("cancel")} disabled={busy}>Cancel</Button>
      </div>
    );
  }

  if (!pending) {
    return null;
  }

  const label = `${who} ${WINDOW_COPY[pending.window_choice]}`;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-center gap-3 border-b border-border bg-warm-surface px-4 py-3 sm:px-6"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-forest/10 text-forest">
        <CalendarClock className="size-5 animate-pulse" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold tracking-tight text-ink">{label}</p>
        {error ? (
          <p className="mt-0.5 truncate text-xs font-medium text-destructive">{error}</p>
        ) : (
          <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
            {showingStatusLabel(pending.status)} · respond to connect now
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
          aria-label="Decline showing request"
        >
          {isDeclining ? <PendingGlyph label="Declining request" /> : <X />}
          Decline
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleAccept}
          disabled={busy}
          aria-label="Accept showing request"
          className="bg-forest text-primary-foreground hover:bg-forest/90"
        >
          {isAccepting ? <PendingGlyph label="Accepting request" /> : <Check />}
          Accept
        </Button>
      </div>
    </div>
  );
}
