"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, Check, ChevronRight, MapPinCheck, MessageSquare, Phone, Video } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { requestListingVideoCall, requestListingVoiceCall } from "@/features/chat/actions";
import { ContactActions } from "@/features/guest-contact/contact-actions";
import { hasPublicContact, type PublicContact } from "@/features/guest-contact/schema";
import type { PresenceBadge } from "@/features/presence/presence-status";
import { actionFailure } from "@/lib/action-result";
import { PendingGlyph } from "@/lib/motion/primitives";
import { cn } from "@/lib/utils";

import { cancelShowing, checkInShowing, completeShowing, getCurrentShowing, requestShowing } from "./actions";
import { isExpired, type ShowingWindow } from "./showing-status";
import { useShowingRequest } from "./use-showing-request";

const WINDOW_OPTIONS: { value: ShowingWindow; label: string }[] = [
  { value: "now", label: "Right now" },
  { value: "within_15", label: "Within 15 minutes" },
  { value: "within_30", label: "Within 30 minutes" },
  { value: "today", label: "Later today" },
];

/** Requests still in progress; the trigger names them so the renter can find their showing again. */
const ACTIVE_SHOWING_LABELS: Partial<Record<string, string>> = {
  requested: "requested", accepted: "accepted", checked_in: "checked in",
};

export type ContactSheetProps = {
  listingId: string;
  title: string;
  kind: "rent" | "sale";
  latitude: number;
  longitude: number;
  presence?: PresenceBadge | null;
  listerName?: string | null;
  authenticated: boolean;
  contact?: PublicContact | null;
  onMessage: () => Promise<void>;
  isMessaging?: boolean;
  /** Open on mount, for `?intent=message` links. */
  initialOpen?: boolean;
  className?: string;
};

/** Everything that only a signed-in renter can do: live calls and in-person showings. */
type ShowingControls = {
  online: boolean;
  available: boolean;
  activeLabel: string | null;
  status: ReactNode;
  readError: string | null;
  isLoading: boolean;
  feedback: ReactNode;
  pendingAction: string | null;
  refresh: () => void;
  chooseWindow: (window: ShowingWindow, done: () => void) => void;
  startCall: (kind: "voice" | "video") => void;
};

/**
 * One Contact entry point per listing. It opens a sheet ordered by what Pinpoint wants first:
 * message in Pinpoint, live calls while the landlord is reachable, an in-person showing, and
 * last, the lister's own WhatsApp / phone / email. With only one option it skips the sheet.
 */
export function ContactSheet(props: ContactSheetProps) {
  const direct = hasPublicContact(props.contact);
  const showings = props.kind === "rent" && props.authenticated;
  if (!showings && !direct) return <SingleContactButton {...props} />;
  if (showings) return <RentalContactSheet key={props.listingId} {...props} />;
  return <ContactSheetView {...props} showing={null} />;
}

const triggerClassName = "h-11 w-full min-w-0 rounded-lg px-2 text-sm font-semibold";

function SingleContactButton({ kind, authenticated, onMessage, isMessaging, className }: ContactSheetProps) {
  const label = !authenticated ? "Sign in to contact" : kind === "sale" ? "Message the seller" : "Message the landlord";
  return <Button type="button" variant="outline" data-emphasis="secondary" disabled={isMessaging} aria-busy={isMessaging}
    onClick={() => void onMessage()} className={cn(triggerClassName, className)}>
    {isMessaging ? <PendingGlyph label="Opening conversation" /> : <MessageSquare className="size-4" aria-hidden="true" />}
    <span className="truncate">{label}</span>
  </Button>;
}

function distanceMetres(aLat: number, aLng: number, bLat: number, bLng: number) {
  const radius = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRadians(bLat - aLat);
  const deltaLng = toRadians(bLng - aLng);
  const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(toRadians(aLat)) * Math.cos(toRadians(bLat)) * Math.sin(deltaLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

function RentalContactSheet(props: ContactSheetProps) {
  const { listingId, latitude, longitude, presence } = props;
  const router = useRouter();
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

  const cancel = request ? () => void run("cancel", () => cancelShowing(request.id)) : undefined;
  const status = request ? (() => {
    if (requestState === "accepted") {
      return <div className="flex flex-wrap items-center gap-2 rounded-xl border border-forest/25 bg-accent p-3">
        <Check className="size-4 text-forest" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-sm font-semibold text-forest">Accepted. Message the landlord or check in when you arrive.</p>
        {request.conversation_id ? <Button render={<a href={`/messages/${request.conversation_id}`} />} size="sm" variant="outline"><MessageSquare className="size-4" />Message</Button> : null}
        <Button size="sm" onClick={checkIn} disabled={isPending}><MapPinCheck className="size-4" />Check in</Button>
        <Button size="sm" variant="ghost" disabled={isPending} onClick={cancel}>Cancel</Button>
      </div>;
    }
    if (requestState === "checked_in") {
      return <div className="flex items-center gap-2 rounded-xl border border-forest/25 bg-accent p-3">
        <MapPinCheck className="size-4 text-forest" />
        <p className="min-w-0 flex-1 text-sm font-semibold text-forest">You are checked in.</p>
        <Button size="sm" disabled={isPending} onClick={() => void run("complete", () => completeShowing(request.id))}>Finish showing</Button>
      </div>;
    }
    if (requestState === "requested") {
      return <div className="flex items-center gap-2 rounded-xl border border-border bg-panel p-3" role="status">
        <CalendarClock className="size-4 text-forest" />
        <p className="min-w-0 flex-1 text-sm font-semibold text-ink">Waiting for the landlord to respond.</p>
        <Button size="sm" variant="ghost" disabled={isPending} onClick={cancel}>Cancel</Button>
      </div>;
    }
    return <div className="space-y-2">
      <p className="rounded-xl border border-border bg-panel p-3 text-sm font-semibold text-muted-foreground">This showing request is {requestState?.replaceAll("_", " ")}.</p>
      <Button size="sm" variant="outline" disabled={isPending} onClick={() => applyRequest(null)}>Request again</Button>
    </div>;
  })() : null;

  const showing: ShowingControls = {
    online: (presence ?? "offline") !== "offline",
    available: presence === "available",
    activeLabel: requestState ? ACTIVE_SHOWING_LABELS[requestState] ?? null : null,
    status,
    readError,
    isLoading,
    feedback: actionError ? <div role="alert" className="space-y-2 text-sm text-destructive"><p>{actionError}</p><Button size="sm" variant="outline" disabled={isPending} onClick={retry}>Try again</Button></div> : null,
    pendingAction,
    refresh: () => void refresh(),
    chooseWindow: (window, done) => run(`showing-${window}`, () => requestShowing({ listingId, window }), () => {
      done();
      toast.success("Showing request sent");
    }),
    startCall: kind => void run(kind, () => (kind === "voice" ? requestListingVoiceCall : requestListingVideoCall)(listingId),
      data => router.push(`/messages/${data.conversationId}`)),
  };
  return <ContactSheetView {...props} showing={showing} />;
}

const rowClassName = "flex min-h-12 w-full items-center gap-3 rounded-xl border border-border bg-panel px-3 text-left text-sm font-semibold text-ink transition-colors hover:bg-warm-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

function ContactSheetView({ kind, title, listerName, authenticated, contact, onMessage, isMessaging, initialOpen = false, className, showing }: ContactSheetProps & { showing: ShowingControls | null }) {
  const [open, setOpen] = useState(initialOpen);
  const [step, setStep] = useState<"options" | "showing-time">("options");
  const messageRef = useRef<HTMLButtonElement>(null);
  const party = kind === "sale" ? "the seller" : "the landlord";
  const messageLabel = authenticated ? `Message ${party}` : "Sign in to message";
  const isPending = Boolean(showing?.pendingAction);
  const triggerLabel = showing?.activeLabel ? `Contact, showing ${showing.activeLabel}` : "Contact";

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) setStep("options");
    if (next) showing?.refresh();
  }

  const liveCalls = showing?.online && !showing.status ? <div className="grid grid-cols-2 gap-2">
    {(["voice", "video"] as const).map(call => <Button key={call} type="button" variant="outline" className="h-11" disabled={isPending} onClick={() => showing.startCall(call)}>
      {showing.pendingAction === call ? <PendingGlyph label={call === "voice" ? "Starting voice call" : "Starting video call"} />
        : call === "voice" ? <Phone className="size-4" aria-hidden="true" /> : <Video className="size-4" aria-hidden="true" />}
      {call === "voice" ? "Call now" : "Video now"}
    </Button>)}
  </div> : null;

  let showingSection: ReactNode = null;
  if (showing?.readError) {
    showingSection = <div role="alert" className="space-y-2 text-sm text-destructive"><p>{showing.readError}</p><Button size="sm" variant="outline" onClick={showing.refresh}>Try again</Button></div>;
  } else if (showing?.isLoading) {
    showingSection = <PendingGlyph label="Checking showing request" />;
  } else if (showing && !showing.status) {
    showingSection = <button type="button" className={rowClassName} disabled={isPending} onClick={() => setStep("showing-time")}>
      <CalendarClock className="size-4 shrink-0 text-forest" aria-hidden="true" />
      <span className="min-w-0 flex-1">Request a showing</span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>;
  }

  const timeStep = showing ? <div className="grid gap-1">
    <p className="px-1 text-sm font-semibold text-ink">When can you be there?</p>
    {/* "Right now" needs a landlord who is available; leave it out rather than grey it. */}
    {WINDOW_OPTIONS.filter(option => option.value !== "now" || showing.available).map(option =>
      <button key={option.value} type="button" disabled={isPending} onClick={() => showing.chooseWindow(option.value, () => changeOpen(false))}
        className="flex min-h-11 items-center rounded-lg px-2 text-left text-sm font-semibold text-ink hover:bg-warm-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40">
        {showing.pendingAction === `showing-${option.value}` ? <PendingGlyph label="Sending showing request" className="mr-2" /> : <CalendarClock className="mr-2 size-4 text-forest" aria-hidden="true" />}
        {option.label}
      </button>)}
    <button type="button" onClick={() => setStep("options")} className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-muted-foreground hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <ArrowLeft className="size-4" aria-hidden="true" />Back
    </button>
  </div> : null;

  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger aria-label={triggerLabel} render={<Button type="button" variant="outline" data-emphasis="secondary" className={cn(triggerClassName, className)} />}>
      <MessageSquare className="size-4" aria-hidden="true" />
      <span>Contact</span>
      {showing?.activeLabel ? <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-selection" /> : null}
    </DialogTrigger>
    <DialogContent initialFocus={messageRef} className="gap-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-md sm:pb-4">
      <div className="pr-8">
        <DialogTitle className="text-base font-semibold text-ink">Contact {listerName?.trim() || party}</DialogTitle>
        <DialogDescription className="mt-1 text-xs leading-5">{title}</DialogDescription>
      </div>
      {step === "showing-time" && timeStep ? timeStep : <>
        {showing?.status ? <section aria-label="Your showing request">{showing.status}</section> : null}
        <button ref={messageRef} type="button" className={rowClassName} disabled={isMessaging} aria-busy={isMessaging} onClick={() => void onMessage()}>
          {isMessaging ? <PendingGlyph label="Opening conversation" /> : <MessageSquare className="size-4 shrink-0 text-forest" aria-hidden="true" />}
          <span className="min-w-0 flex-1">{messageLabel}</span>
          {authenticated ? <span className="rounded-full bg-accent px-2 py-0.5 text-[0.6875rem] font-semibold text-brand-ink">Recommended</span> : null}
        </button>
        {liveCalls}
        {showingSection}
        {hasPublicContact(contact) ? <div className="border-t border-border pt-3">
          <p className="mb-1 text-xs font-semibold text-muted-foreground">Or contact directly</p>
          <ContactActions contact={contact} title={title} compact />
        </div> : null}
      </>}
      {showing?.feedback}
    </DialogContent>
  </Dialog>;
}
