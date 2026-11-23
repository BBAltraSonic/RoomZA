"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarCheck, CalendarClock, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { directContactLinks } from "@/features/guest-contact/contact-actions";
import { DirectContactSheet, QuoteRequestButton } from "@/features/guest-contact/direct-contact-sheet";
import { servicePublicContact } from "@/features/guest-contact/schema";
import { formatSlotRequest, formatSlotTime } from "@/features/showings/viewing-availability";
import { ViewingCalendar } from "@/features/showings/viewing-calendar";
import { PendingGlyph } from "@/lib/motion/primitives";
import { cn } from "@/lib/utils";

import { cancelServiceBooking, getServiceBookingState, requestServiceBooking } from "./booking-actions";
import type { PublicService } from "./schema";
import { bookingPhase, parseBookingRequest, SERVICE_SLOT_MINUTES, type ServiceBooking, type ServiceBookingState } from "./service-booking";

const triggerClassName = "h-11 w-full min-w-0 rounded-lg px-2 text-sm font-semibold";
const fieldClassName = "w-full min-w-0 rounded-lg border border-input bg-warm-surface px-3 py-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:text-sm";

type Load = { state: "loading" } | { state: "error" } | { state: "ready"; data: ServiceBookingState };

/** Loads once per service; `update` keeps local changes (a new or cancelled booking) without a refetch. */
function useServiceBooking(serviceId: string) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const reads = useRef(0);
  const read = useCallback(() => {
    const current = ++reads.current;
    void getServiceBookingState(serviceId).then(
      result => current === reads.current && setLoad(result.success ? { state: "ready", data: result.data } : { state: "error" }),
      () => current === reads.current && setLoad({ state: "error" }),
    );
  }, [serviceId]);
  useEffect(() => {
    read();
    // Invalidate a read still in flight so it cannot land after unmount.
    const counter = reads;
    return () => { counter.current++; };
  }, [read]);
  const update = useCallback((change: (data: ServiceBookingState) => ServiceBookingState) =>
    setLoad(previous => previous.state === "ready" ? { state: "ready", data: change(previous.data) } : previous), []);
  return { load, reload: read, update };
}

/** Where to come back to after signing in: this service's details, wherever the visitor was browsing. */
function signInHref(serviceId: string) {
  if (typeof window === "undefined") return "/auth";
  const url = new URL(window.location.href);
  url.searchParams.set("detailId", serviceId);
  return "/auth?redirect=" + encodeURIComponent(url.pathname + url.search);
}

/**
 * The service's action bar, laid out as a home's: Contact beside one primary step. When the
 * provider keeps booking hours that step is booking a time; otherwise it is asking for a quote.
 */
export function ServiceActionBar({ item }: { item: PublicService }) {
  const { title, providerName } = item.content;
  const contact = servicePublicContact(item.content);
  // With one channel the quote button already uses it, so a separate Contact button would repeat it.
  const singleChannel = directContactLinks(contact, title).length === 1;
  const { load, reload, update } = useServiceBooking(item.id);
  const data = load.state === "ready" ? load.data : null;

  let primary: ReactNode;
  let quote = false;
  if (load.state === "loading") {
    primary = <Button type="button" disabled className={triggerClassName}><PendingGlyph label="Checking booking times" /></Button>;
  } else if (data?.own) {
    primary = <Button render={<a href={data.hasHours ? "/post/services#bookings" : "/post/services/" + item.id} />} data-emphasis="primary" className={triggerClassName}>
      <CalendarClock className="size-4" aria-hidden="true" />{data.hasHours ? "Manage bookings" : "Set booking hours"}
    </Button>;
  } else if (data?.hasHours && !data.signedIn) {
    primary = <Button render={<a href={signInHref(item.id)} />} data-emphasis="primary" className={triggerClassName}>
      <CalendarClock className="size-4" aria-hidden="true" />Sign in to book
    </Button>;
  } else if (data?.hasHours) {
    primary = <ServiceBookingSheet serviceId={item.id} title={title} providerName={providerName} data={data} update={update} reload={reload} />;
  } else {
    quote = true;
    primary = <QuoteRequestButton contact={contact} title={title} />;
  }
  const showContact = !(singleChannel && (quote || load.state === "loading"));

  return <div role="group" aria-label="Service actions" className="grid grid-cols-2 gap-2">
    {showContact ? <DirectContactSheet contact={contact} title={title} name={providerName} className={contact ? undefined : "col-span-2"} /> : null}
    <div className={cn("min-w-0", !showContact && "col-span-2")}>{primary}</div>
  </div>;
}

type SheetProps = {
  serviceId: string;
  title: string;
  providerName: string;
  data: ServiceBookingState;
  update: (change: (data: ServiceBookingState) => ServiceBookingState) => void;
  reload: () => void;
};

function ServiceBookingSheet({ serviceId, title, providerName, data, update, reload }: SheetProps) {
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [phone, setPhone] = useState(data.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"request" | "cancel" | null>(null);
  const phase = data.booking ? bookingPhase(data.booking) : null;
  const live = phase === "requested" || phase === "accepted" || phase === "under_way";
  const triggerLabel = phase === "requested" ? "Booking requested" : live ? "Booked" : "Book a time";

  function changeOpen(next: boolean) {
    setOpen(next);
    setError(null);
    if (!next) setSlot(null);
  }

  async function send() {
    if (!slot || pending) return;
    const parsed = parseBookingRequest({ serviceId, slotStart: slot, note, phone });
    if (!parsed.ok) return setError(parsed.error);
    setPending("request");
    setError(null);
    try {
      const result = await requestServiceBooking(parsed.value);
      if (!result.success) {
        setError(result.error);
        if (result.error.startsWith("That time was just taken")) { setSlot(null); reload(); }
        return;
      }
      update(current => ({ ...current, booking: result.data.booking }));
      toast.success(`Booking requested for ${formatSlotRequest(result.data.booking.slot_start)}`);
      changeOpen(false);
    } catch {
      setError("The booking could not be confirmed. Reopen the service to check it.");
    } finally {
      setPending(null);
    }
  }

  async function cancel(booking: ServiceBooking) {
    if (pending) return;
    setPending("cancel");
    setError(null);
    try {
      const result = await cancelServiceBooking(booking.id);
      if (!result.success) return setError(result.error);
      // The freed hour is bookable again if it is still far enough ahead.
      const reopened = Date.parse(booking.slot_start) >= Date.now() + 60 * 60_000;
      update(current => ({
        ...current, booking: null,
        slots: reopened && !current.slots.some(entry => entry.start === booking.slot_start)
          ? [...current.slots, { start: booking.slot_start, end: new Date(Date.parse(booking.slot_start) + SERVICE_SLOT_MINUTES * 60_000).toISOString() }]
            .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
          : current.slots,
      }));
      toast.success("Booking cancelled");
    } catch {
      setError("The cancellation could not be confirmed. Reopen the service to check it.");
    } finally {
      setPending(null);
    }
  }

  let body: ReactNode;
  if (data.booking && live) {
    const booking = data.booking;
    const at = formatSlotRequest(booking.slot_start);
    const copy = phase === "requested" ? `Requested ${at}. Waiting for ${providerName} to confirm.`
      : phase === "accepted" ? `${providerName} confirmed ${at}.`
        : `${providerName} is booked with you now, until ${formatSlotTime(new Date(Date.parse(booking.slot_start) + SERVICE_SLOT_MINUTES * 60_000).toISOString())}.`;
    body = <div className="space-y-3">
      <div role="status" className={cn("flex items-start gap-2 rounded-xl border p-3", phase === "requested" ? "border-border bg-panel" : "border-forest/25 bg-accent")}>
        {phase === "requested" ? <CalendarClock className="mt-0.5 size-4 shrink-0 text-forest" aria-hidden="true" /> : <Check className="mt-0.5 size-4 shrink-0 text-forest" aria-hidden="true" />}
        <div className="min-w-0 text-sm">
          <p className="font-semibold text-ink">{copy}</p>
          <p className="mt-1 text-xs text-muted-foreground">They will reach you on {booking.customer_phone}. Your note: {booking.note}</p>
        </div>
      </div>
      {phase !== "under_way" ? <Button type="button" variant="outline" className="h-11 w-full" disabled={Boolean(pending)} onClick={() => void cancel(booking)}>
        {pending === "cancel" ? <PendingGlyph label="Cancelling booking" /> : null}Cancel booking
      </Button> : null}
    </div>;
  } else if (slot) {
    body = <form className="grid gap-3" noValidate onSubmit={event => { event.preventDefault(); void send(); }}>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-warm-surface p-3">
        <CalendarCheck className="size-4 shrink-0 text-forest" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-sm font-semibold text-ink">{formatSlotRequest(slot)}</p>
        <Button type="button" size="sm" variant="ghost" disabled={Boolean(pending)} onClick={() => { setSlot(null); setError(null); }}>Change</Button>
      </div>
      <label className="grid gap-1.5 text-sm font-medium text-ink">
        What do you need done, and where?
        <textarea className={cn(fieldClassName, "min-h-24")} maxLength={500} value={note} disabled={Boolean(pending)}
          placeholder="For example: kitchen tap leaking, 4 Oak Road, Rondebosch" onChange={event => setNote(event.target.value)} />
      </label>
      <div className="grid gap-1.5">
        <label className="grid gap-1.5 text-sm font-medium text-ink">
          Your phone number
          <input className={cn(fieldClassName, "min-h-11")} type="tel" autoComplete="tel" maxLength={24} value={phone} disabled={Boolean(pending)}
            aria-describedby={`${serviceId}-phone-hint`} onChange={event => setPhone(event.target.value)} />
        </label>
        <p id={`${serviceId}-phone-hint`} className="text-xs text-muted-foreground">Shared only with {providerName} so they can confirm and reach you.</p>
      </div>
      <Button type="submit" className="h-11 w-full" disabled={Boolean(pending)}>
        {pending === "request" ? <PendingGlyph label="Sending booking request" /> : null}Send booking request
      </Button>
    </form>;
  } else if (data.slots.length === 0) {
    body = <p className="text-sm text-muted-foreground">No open times in the next two weeks. Contact {providerName} to agree a time.</p>;
  } else {
    body = <ViewingCalendar slots={data.slots} disabled={Boolean(pending)} pending={false} onRequest={setSlot}
      label="Booking calendar" actionLabel={at => `Continue with ${at}`}
      footnote={`Times are South African time. Each booking is one hour; ${providerName} confirms before the visit.`} />;
  }

  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger aria-label={triggerLabel} render={<Button type="button" data-emphasis="primary" className={triggerClassName} />}>
      <CalendarClock className="size-4" aria-hidden="true" />
      <span className="truncate">{triggerLabel}</span>
    </DialogTrigger>
    <DialogContent className="gap-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-md sm:pb-4">
      <div className="pr-8">
        <DialogTitle className="text-base font-semibold text-ink">Book {providerName}</DialogTitle>
        <DialogDescription className="mt-1 text-xs leading-5">{title}</DialogDescription>
      </div>
      <div className="-mx-1 grid max-h-[min(72dvh,36rem)] gap-3 overflow-y-auto overscroll-contain px-1">
        {body}
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      </div>
    </DialogContent>
  </Dialog>;
}
