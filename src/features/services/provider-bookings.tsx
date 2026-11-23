"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarClock, Check, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatSlotRequest } from "@/features/showings/viewing-availability";
import { PendingGlyph } from "@/lib/motion/primitives";
import { cn } from "@/lib/utils";

import { acceptServiceBooking, cancelServiceBooking, declineServiceBooking, getProviderBookings } from "./booking-actions";
import { bookingPhase, type ProviderBooking } from "./service-booking";

type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; bookings: ProviderBooking[] };
type Response = "accept" | "decline" | "cancel";

const RESPOND = { accept: acceptServiceBooking, decline: declineServiceBooking, cancel: cancelServiceBooking } as const;

/**
 * The provider's booking requests across all their services, soonest first. Pending requests
 * are accepted or declined here; confirmed ones can still be cancelled before they start.
 */
export function ProviderBookings({ className }: { className?: string }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const reads = useRef(0);
  const read = useCallback(() => {
    const current = ++reads.current;
    void getProviderBookings().then(
      result => current === reads.current && setLoad(result.success ? { state: "ready", bookings: result.data.bookings } : { state: "error", message: result.error }),
      () => current === reads.current && setLoad({ state: "error", message: "Bookings could not be loaded. Try again." }),
    );
  }, []);
  useEffect(() => {
    read();
    // Invalidate a read still in flight so it cannot land after unmount.
    const counter = reads;
    return () => { counter.current++; };
  }, [read]);

  const replace = useCallback((next: ProviderBooking) => setLoad(previous => previous.state !== "ready" ? previous : {
    state: "ready",
    bookings: previous.bookings.flatMap(entry => entry.id !== next.id ? [entry] : next.status === "requested" || next.status === "accepted" ? [{ ...entry, ...next }] : []),
  }), []);

  let body;
  if (load.state === "loading") body = <PendingGlyph label="Loading bookings" />;
  else if (load.state === "error") body = <div role="alert" className="space-y-2 text-sm text-destructive">
    <p>{load.message}</p>
    <Button size="sm" variant="outline" onClick={() => { setLoad({ state: "loading" }); read(); }}>Try again</Button>
  </div>;
  else if (load.bookings.length === 0) body = <p className="text-sm text-muted-foreground">
    No booking requests yet. Set booking hours on a service so customers can book an hour of your time.
  </p>;
  else body = <ul className="grid gap-2">
    {load.bookings.map(booking => <BookingRow key={booking.id} booking={booking} onChange={replace} />)}
  </ul>;

  return <section id="bookings" aria-labelledby="provider-bookings-heading" className={cn("scroll-mt-24 space-y-3", className)}>
    <h2 id="provider-bookings-heading" className="text-xl font-semibold">Booking requests</h2>
    {body}
  </section>;
}

function BookingRow({ booking, onChange }: { booking: ProviderBooking; onChange: (booking: ProviderBooking) => void }) {
  const [pending, setPending] = useState<Response | null>(null);
  const [error, setError] = useState<string | null>(null);
  const phase = bookingPhase(booking);
  const at = formatSlotRequest(booking.slot_start);

  async function respond(action: Response) {
    if (pending) return;
    setPending(action);
    setError(null);
    try {
      const result = await RESPOND[action](booking.id);
      if (!result.success) return setError(result.error);
      onChange({ ...booking, ...result.data.booking });
    } catch {
      setError("The booking change could not be confirmed. Reload to check it.");
    } finally {
      setPending(null);
    }
  }

  const glyph = (action: Response, label: string) => pending === action ? <PendingGlyph label={label} /> : null;
  return <li aria-label={`${booking.serviceTitle}, ${at}`} className="space-y-2 rounded-xl border border-border bg-panel p-3">
    <div className="flex flex-wrap items-start gap-2">
      <CalendarClock className="mt-0.5 size-4 shrink-0 text-forest" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{at}</p>
        <p className="text-xs text-muted-foreground">{booking.serviceTitle} · {booking.customer_name ?? "Customer"}</p>
      </div>
      <span className={cn("rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold",
        phase === "requested" ? "bg-warm-surface text-ink" : "bg-accent text-forest")}>
        {phase === "requested" ? "Awaiting you" : phase === "under_way" ? "Now" : <><Check className="mr-1 inline size-3" aria-hidden="true" />Confirmed</>}
      </span>
    </div>
    <p className="whitespace-pre-wrap break-words text-sm text-ink">{booking.note}</p>
    <a href={"tel:" + booking.customer_phone.replace(/[ ()-]/g, "")} aria-label={`Call ${booking.customer_phone}`}
      className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-forest underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Phone className="size-4" aria-hidden="true" />{booking.customer_phone}
    </a>
    {phase === "requested" ? <div className="grid grid-cols-2 gap-2">
      <Button type="button" variant="outline" className="h-11" disabled={Boolean(pending)} onClick={() => void respond("decline")}>{glyph("decline", "Declining booking")}Decline</Button>
      <Button type="button" className="h-11" disabled={Boolean(pending)} onClick={() => void respond("accept")}>{glyph("accept", "Accepting booking")}Accept</Button>
    </div> : phase === "accepted" ? <Button type="button" variant="ghost" size="sm" disabled={Boolean(pending)} onClick={() => void respond("cancel")}>
      {glyph("cancel", "Cancelling booking")}Cancel booking
    </Button> : null}
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
  </li>;
}
