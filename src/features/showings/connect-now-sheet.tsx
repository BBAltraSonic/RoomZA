"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Popover } from "@base-ui/react/popover";
import { CalendarClock, Check, MapPinCheck, MessageSquare, Phone, Video, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { requestListingVideoCall, requestListingVoiceCall } from "@/features/chat/actions";
import type { PresenceBadge } from "@/features/presence/presence-status";
import { createClient } from "@/lib/supabase/browser";
import { PendingGlyph } from "@/lib/motion/primitives";
import { cn } from "@/lib/utils";

import {
  cancelShowing,
  checkInShowing,
  completeShowing,
  requestShowing,
  type ShowingRequest,
} from "./actions";
import type { ShowingWindow } from "./showing-status";

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

export function ConnectNowSheet({
  listingId,
  latitude,
  longitude,
  presence,
  compact = false,
  onMessage,
}: {
  listingId: string;
  latitude: number;
  longitude: number;
  presence: PresenceBadge;
  compact?: boolean;
  onMessage: () => Promise<void>;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState<ShowingRequest | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!request || ["declined", "completed", "cancelled", "expired"].includes(request.status)) return;
    const channel = supabase
      .channel(`showing_request_${request.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "showing_requests",
          filter: `id=eq.${request.id}`,
        },
        (payload) => setRequest(payload.new as ShowingRequest),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [request, supabase]);

  function run(label: string, work: () => Promise<{ success: boolean; error?: string }>, done?: () => void) {
    setPendingAction(label);
    startTransition(async () => {
      const result = await work();
      setPendingAction(null);
      if (!result.success) {
        toast.error(result.error ?? "That action could not be completed.");
        return;
      }
      done?.();
    });
  }

  function chooseWindow(window: ShowingWindow) {
    run(
      `showing-${window}`,
      async () => {
        const result = await requestShowing({ listingId, window });
        if (result.success) setRequest(result.data.request);
        return result;
      },
      () => {
        setOpen(false);
        toast.success("Showing request sent");
      },
    );
  }

  function startVideoCall() {
    run("video", async () => {
      const result = await requestListingVideoCall(listingId);
      if (result.success) router.push(`/messages/${result.data.conversationId}`);
      return result;
    });
  }

  function startVoiceCall() {
    run("voice", async () => {
      const result = await requestListingVoiceCall(listingId);
      if (result.success) router.push(`/messages/${result.data.conversationId}`);
      return result;
    });
  }

  function checkIn() {
    if (!navigator.geolocation) {
      toast.error("Location is unavailable on this device.");
      return;
    }
    setPendingAction("check-in");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (distanceMetres(position.coords.latitude, position.coords.longitude, latitude, longitude) > 250) {
          setPendingAction(null);
          toast.error("Move closer to the property before checking in.");
          return;
        }
        run("check-in", () => checkInShowing(request!.id));
      },
      () => {
        setPendingAction(null);
        toast.error("Allow location access to check in.");
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }

  if (request) {
    if (request.status === "accepted") {
      return (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-forest/25 bg-accent p-3">
          <Check className="size-4 text-forest" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm font-semibold text-forest">Accepted. Message the landlord or check in when you arrive.</p>
          {request.conversation_id ? <Button render={<a href={`/messages/${request.conversation_id}`} />} size="sm" variant="outline"><MessageSquare className="size-4" />Message</Button> : null}
          <Button size="sm" onClick={checkIn} disabled={Boolean(pendingAction)}><MapPinCheck className="size-4" />Check in</Button>
          <Button size="sm" variant="ghost" onClick={() => run("cancel", () => cancelShowing(request.id))}>Cancel</Button>
        </div>
      );
    }
    if (request.status === "checked_in") {
      return (
        <div className="flex items-center gap-2 rounded-xl border border-forest/25 bg-accent p-3">
          <MapPinCheck className="size-4 text-forest" />
          <p className="min-w-0 flex-1 text-sm font-semibold text-forest">You are checked in.</p>
          <Button size="sm" onClick={() => run("complete", () => completeShowing(request.id))}>Finish showing</Button>
        </div>
      );
    }
    if (request.status === "requested") {
      return (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-panel p-3" role="status">
          <CalendarClock className="size-4 text-forest" />
          <p className="min-w-0 flex-1 text-sm font-semibold text-ink">Waiting for the landlord to respond.</p>
          <Button size="sm" variant="ghost" onClick={() => run("cancel", () => cancelShowing(request.id))}>Cancel</Button>
        </div>
      );
    }
    return <p className="rounded-xl border border-border bg-panel p-3 text-sm font-semibold text-muted-foreground">This showing request is {request.status.replaceAll("_", " ")}.</p>;
  }

  const online = presence !== "offline";
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger render={<Button className={cn("w-full bg-forest font-semibold text-primary-foreground hover:bg-forest/90", compact ? "h-10" : "h-12")} />}>
        <Zap className="size-4" />
        Connect now
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} className="z-[110]">
          <Popover.Popup className="w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-popover p-3 shadow-[var(--elevation-2)] outline-none">
            <Popover.Title className="text-sm font-semibold text-ink">Choose how to connect</Popover.Title>
            <Popover.Description className="mt-1 text-xs leading-5 text-muted-foreground">Live options appear only while the landlord is reachable.</Popover.Description>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Button variant="outline" className="h-11" onClick={() => void onMessage()} disabled={isPending}><MessageSquare className="size-4" />Chat</Button>
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
            <Popover.Arrow className="size-2 rotate-45 border-b border-r border-border bg-popover" />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
