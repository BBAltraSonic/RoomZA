"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Popover } from "@base-ui/react/popover";
import { CalendarClock, Check, MapPinCheck, MessageSquare, Phone, Video, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { requestListingVideoCall, requestListingVoiceCall } from "@/features/chat/actions";
import type { PresenceBadge } from "@/features/presence/presence-status";
import { PendingGlyph } from "@/lib/motion/primitives";
import { cn } from "@/lib/utils";

import {
  cancelShowing,
  checkInShowing,
  completeShowing,
  requestShowing,
  getCurrentShowing,
} from "./actions";
import { isExpired, type ShowingWindow } from "./showing-status";
import { useShowingRequest } from "./use-showing-request";
import { actionFailure } from "@/lib/action-result";

const WINDOW_OPTIONS: { value: ShowingWindow; label: string }[] = [
  { value: "now", label: "Right now" },
  { value: "within_15", label: "Within 15 minutes" },
  { value: "within_30", label: "Within 30 minutes" },
  { value: "today", label: "Later today" },
];

function distanceMetres(aLat: number, aLng: number, bLat: number, bLng: number) {
  const radius = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRadians(bLat - aLat);
  const deltaLng = toRadians(bLng - aLng);
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(aLat)) * Math.cos(toRadians(bLat)) * Math.sin(deltaLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

type ConnectNowSheetProps = {
  listingId: string;
  latitude: number;
  longitude: number;
  presence: PresenceBadge;
  compact?: boolean;
  inline?: boolean;
  onMessage: () => Promise<void>;
};

export function ConnectNowSheet(props: ConnectNowSheetProps) {
  return <ConnectNowSheetInstance key={props.listingId} {...props} />;
}

function ConnectNowSheetInstance({
  listingId,
  latitude,
  longitude,
  presence,
  compact = false,
  inline = false,
  onMessage,
}: ConnectNowSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const read = useCallback(() => getCurrentShowing(listingId), [listingId]);
  const { request, applyRequest, refresh, readError, actionError, isLoading, pendingAction, run, retry } = useShowingRequest({
    read, filter: `listing_id=eq.${listingId}`, onActionError: toast.error,
  });
  const isPending = Boolean(pendingAction);
  useEffect(() => {
    if (request?.status !== "requested") return;
    const delay = Math.max(0, Date.parse(request.expires_at) - Date.now());
    const timer = window.setTimeout(() => setNow(Date.now()), delay + 50);
    return () => window.clearTimeout(timer);
  }, [request]);
  const requestState = request && isExpired({ status: request.status, expiresAtMs: Date.parse(request.expires_at) }, now) ? "expired" : request?.status;

  function chooseWindow(window: ShowingWindow) {
    run(
      `showing-${window}`,
      () => requestShowing({ listingId, window }),
      () => {
        setOpen(false);
        toast.success("Showing request sent");
      },
    );
  }

  function startVideoCall() {
    void run("video", () => requestListingVideoCall(listingId), data => router.push(`/messages/${data.conversationId}`));
  }

  function startVoiceCall() {
    void run("voice", () => requestListingVoiceCall(listingId), data => router.push(`/messages/${data.conversationId}`));
  }

  function checkIn() {
    if (!request) return;
    void run("check-in", async isCurrent => {
      if (!navigator.geolocation || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return actionFailure("Location is unavailable on this device.");
      const position = await new Promise<GeolocationPosition | null>(resolve => navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 }));
      if (!isCurrent()) return actionFailure("The showing request changed.");
      if (!position) return actionFailure("Allow location access to check in.");
      if (!Number.isFinite(position.coords.latitude) || !Number.isFinite(position.coords.longitude)) return actionFailure("Your location could not be confirmed. Try again.");
      if (distanceMetres(position.coords.latitude, position.coords.longitude, latitude, longitude) > 250) return actionFailure("Move closer to the property before checking in.");
      return checkInShowing(request.id);
    });
  }

  const requestStatus = request ? (() => {
    if (requestState === "accepted") {
      return (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-forest/25 bg-accent p-3">
          <Check className="size-4 text-forest" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm font-semibold text-forest">Accepted. Message the landlord or check in when you arrive.</p>
          {request.conversation_id ? <Button render={<a href={`/messages/${request.conversation_id}`} />} size="sm" variant="outline"><MessageSquare className="size-4" />Message</Button> : null}
          <Button size="sm" onClick={checkIn} disabled={Boolean(pendingAction)}><MapPinCheck className="size-4" />Check in</Button>
          <Button size="sm" variant="ghost" disabled={isPending} onClick={() => void run("cancel", () => cancelShowing(request.id))}>Cancel</Button>
        </div>
      );
    }
    if (requestState === "checked_in") {
      return (
        <div className="flex items-center gap-2 rounded-xl border border-forest/25 bg-accent p-3">
          <MapPinCheck className="size-4 text-forest" />
          <p className="min-w-0 flex-1 text-sm font-semibold text-forest">You are checked in.</p>
          <Button size="sm" disabled={isPending} onClick={() => void run("complete", () => completeShowing(request.id))}>Finish showing</Button>
        </div>
      );
    }
    if (requestState === "requested") {
      return (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-panel p-3" role="status">
          <CalendarClock className="size-4 text-forest" />
          <p className="min-w-0 flex-1 text-sm font-semibold text-ink">Waiting for the landlord to respond.</p>
          <Button size="sm" variant="ghost" disabled={isPending} onClick={() => void run("cancel", () => cancelShowing(request.id))}>Cancel</Button>
        </div>
      );
    }
    return <div className="space-y-2"><p className="rounded-xl border border-border bg-panel p-3 text-sm font-semibold text-muted-foreground">This showing request is {requestState?.replaceAll("_", " ")}.</p><Button size="sm" variant="outline" disabled={isPending} onClick={() => applyRequest(null)}>Request again</Button></div>;
  })() : null;

  const feedback = actionError ? <div role="alert" className="space-y-2 text-sm text-destructive"><p>{actionError}</p><Button size="sm" variant="outline" disabled={isPending} onClick={retry}>Try again</Button></div> : null;
  if (requestStatus && !inline) return <div className="space-y-2">{requestStatus}{feedback}</div>;

  const online = presence !== "offline";
  const inlineLabel = requestState === "requested" ? "Requested"
    : requestState === "accepted" ? "Accepted"
    : requestState === "checked_in" ? "Checked in"
    : requestStatus ? "Showing" : "Connect";
  return (
    <Popover.Root open={open} onOpenChange={next => { setOpen(next); if (next) void refresh(); }}>
      <Popover.Trigger aria-label={inline && requestStatus ? "View showing request" : "Connect now"} render={<Button variant={inline ? "outline" : "default"} className={cn("w-full font-semibold", inline ? "h-11 min-w-0 rounded-lg px-2 text-sm text-forest sm:h-11" : "bg-forest text-primary-foreground hover:bg-forest/90", !inline && (compact ? "h-10" : "h-12"))} />}>
        {!inline ? <Zap className="size-4" /> : null}
        {inline ? inlineLabel : "Connect now"}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} className="z-[110]">
          <Popover.Popup className="w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-popover p-3 shadow-[var(--elevation-2)] outline-none">
            <Popover.Title className="text-sm font-semibold text-ink">{requestStatus ? "Your showing request" : "Choose how to connect"}</Popover.Title>
            {readError ? <div role="alert" className="mt-3 space-y-2 text-sm text-destructive"><p>{readError}</p><Button size="sm" variant="outline" onClick={() => void refresh()}>Try again</Button></div> : isLoading ? <div className="mt-3"><PendingGlyph label="Checking showing request" /></div> : requestStatus ? <div className="mt-3">{requestStatus}</div> : <>
            <Popover.Description className="mt-1 text-xs leading-5 text-muted-foreground">Live options appear only while the landlord is reachable.</Popover.Description>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Button variant="outline" className="h-11" onClick={() => void run("message", async () => { await onMessage(); return { success: true, data: undefined }; })} disabled={isPending}><MessageSquare className="size-4" />Chat</Button>
              <Button variant="outline" className="h-11" onClick={startVoiceCall} disabled={!online || isPending}>{pendingAction === "voice" ? <PendingGlyph label="Starting voice call" /> : <Phone className="size-4" />}Voice</Button>
              <Button variant="outline" className="h-11" onClick={startVideoCall} disabled={!online || isPending}>{pendingAction === "video" ? <PendingGlyph label="Starting video call" /> : <Video className="size-4" />}Video</Button>
            </div>
            <div className="mt-3 border-t border-border pt-3">
              <p className="px-1 text-xs font-semibold text-muted-foreground">Request an in-person showing</p>
              <div className="mt-1 grid gap-1">
                {WINDOW_OPTIONS.map((option) => (
                  <button key={option.value} type="button" disabled={isPending || (option.value === "now" && presence !== "available")} onClick={() => chooseWindow(option.value)} className="flex min-h-11 items-center rounded-lg px-2 text-left text-sm font-semibold text-ink hover:bg-warm-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40">
                    {pendingAction === `showing-${option.value}` ? <PendingGlyph label="Sending showing request" className="mr-2" /> : <CalendarClock className="mr-2 size-4 text-forest" />}
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            </>}
            {feedback ? <div className="mt-3">{feedback}</div> : null}
            <Popover.Arrow className="size-2 rotate-45 border-b border-r border-border bg-popover" />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
