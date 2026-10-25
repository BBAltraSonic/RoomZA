"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Check, MessageSquare, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PendingGlyph } from "@/lib/motion/primitives";

import { acceptShowing, cancelShowing, completeShowing, declineShowing, getLandlordShowingState, type ShowingRequest } from "./actions";
import { isExpired, showingStatusLabel } from "./showing-status";
import { useShowingRequest } from "./use-showing-request";

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
export function ShowingRequestBanner(props: ShowingRequestBannerProps) {
  return <ShowingRequestBannerInstance key={props.landlordId} {...props} />;
}

function ShowingRequestBannerInstance({
  landlordId,
  initialRequest = null,
  renterName,
}: ShowingRequestBannerProps) {
  const [now, setNow] = useState(() => Date.now());
  const read = useCallback(() => getLandlordShowingState(), []);
  const { request, readError, actionError, pendingAction, run, refresh, retry } = useShowingRequest({ read, filter: `landlord_id=eq.${landlordId}`, initialRequest, watchNewRequests: true });
  const isAccepting = pendingAction === "accept", isDeclining = pendingAction === "decline";
  const error = actionError ?? readError;

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

  function handleAccept() {
    if (pending) void run("accept", () => acceptShowing(pending.id));
  }

  function handleDecline() {
    if (pending) void run("decline", () => declineShowing(pending.id));
  }

  const busy = Boolean(pendingAction);
  const who = renterName ?? "A renter";
  const active = request && (request.status === "accepted" || request.status === "checked_in") ? request : null;

  function handleActiveAction(action: "cancel" | "complete") {
    if (active) void run(action, () => action === "cancel" ? cancelShowing(active.id) : completeShowing(active.id));
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
          {error ? <Button size="sm" variant="outline" className="mt-2" disabled={busy} onClick={() => actionError ? retry() : void refresh()}>Try again</Button> : null}
        </div>
        {active.conversation_id ? <Button render={<a href={`/messages/${active.conversation_id}`} />} size="sm" variant="outline"><MessageSquare className="size-4" />Message</Button> : null}
        {active.status === "checked_in" ? <Button size="sm" onClick={() => void handleActiveAction("complete")} disabled={busy}>Complete</Button> : null}
        <Button size="sm" variant="ghost" onClick={() => void handleActiveAction("cancel")} disabled={busy}>Cancel</Button>
      </div>
    );
  }

  if (!pending) {
    return error ? <div role="alert" className="space-y-2 border-b border-border bg-panel px-4 py-3 text-sm text-destructive"><p>{error}</p><Button size="sm" variant="outline" disabled={busy} onClick={() => actionError ? retry() : void refresh()}>Try again</Button></div> : null;
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
          <div className="mt-0.5 space-y-2 text-xs font-medium text-destructive"><p>{error}</p><Button size="sm" variant="outline" disabled={busy} onClick={() => actionError ? retry() : void refresh()}>Try again</Button></div>
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
