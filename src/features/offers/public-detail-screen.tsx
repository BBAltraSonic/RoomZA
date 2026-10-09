"use client";
import Link from "next/link";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ReportPanel } from "@/features/admin/components/report-panel";
import { publicOfferDetailSchema, publicOfferDirectionsSchema, type PublicOfferDetail } from "./public-contract";

const dateFormat = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
const date = (value: string) => `${dateFormat.format(new Date(value))} SAST`;
function expired(offer: Extract<PublicOfferDetail, { status: "live" }>): PublicOfferDetail {
  return { status: "expired", offerId: offer.offerId, revisionId: offer.revisionId, areaId: offer.areaId, startsAt: offer.startsAt, endsAt: offer.endsAt, confirmedAt: offer.confirmedAt, serverNow: offer.serverNow, content: null, place: null, poster: null };
}

export function PublicOfferDetailScreen(props: Parameters<typeof PublicOfferDetailScreenContent>[0]) {
  return <PublicOfferDetailScreenContent key={props.offerId} {...props} />;
}

function PublicOfferDetailScreenContent({ offerId, initial }: { offerId: string; initial: PublicOfferDetail }) {
  const [offer, setOffer] = useState<PublicOfferDetail | null>(initial);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [retry, setRetry] = useState(0);
  const deadline = useRef(0);
  const action = useRef<AbortController | null>(null);

  useEffect(() => {
    let disposed = false, sequence = 0;
    let request: AbortController | undefined;
    let alarm: ReturnType<typeof setTimeout> | undefined;
    async function refresh() {
      request?.abort();
      const current = ++sequence;
      const controller = new AbortController();
      request = controller;
      setChecking(true);
      action.current?.abort();
      const started = performance.now();
      try {
        const response = await fetch(`/api/offers/${offerId}`, { cache: "no-store", signal: controller.signal });
        if (![200, 404, 410].includes(response.status)) throw new Error("Offer unavailable");
        const fresh = publicOfferDetailSchema.parse(await response.json());
        if (disposed || controller.signal.aborted || current !== sequence) return;
        clearTimeout(alarm);
        // Anchor at request start and use the DB clock, never the device wall clock.
        deadline.current = fresh.status === "live" ? started + Date.parse(fresh.endsAt) - Date.parse(fresh.serverNow) : 0;
        const state = fresh.status === "live" && deadline.current <= performance.now() ? expired(fresh) : fresh;
        setOffer(state);
        setError(null);
        setChecking(false);
        if (state.status === "live" || state.status === "scheduled") {
          const boundary = state.status === "live" ? deadline.current : started + Date.parse(state.startsAt) - Date.parse(state.serverNow);
          alarm = setTimeout(() => {
            // A capped long timer is a refresh wakeup, not the actual end.
            if (state.status === "live" && performance.now() >= boundary) setOffer(expired(state));
            deadline.current = 0;
            void refresh();
          }, Math.max(0, Math.min(boundary - performance.now(), 2_147_483_647)));
        }
      } catch {
        if (disposed || controller.signal.aborted || current !== sequence) return;
        deadline.current = 0;
        setOffer(null);
        setError("Could not check this offer. Try again before travelling.");
        setChecking(false);
      }
    }
    void refresh();
    const poll = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 15_000);
    const visibility = () => { setChecking(true); action.current?.abort(); if (document.visibilityState === "visible") void refresh(); };
    const restored = () => { void refresh(); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pageshow", restored);
    return () => { disposed = true; request?.abort(); action.current?.abort(); clearTimeout(alarm); clearInterval(poll); document.removeEventListener("visibilitychange", visibility); window.removeEventListener("pageshow", restored); };
  }, [offerId, retry]);

  async function directions() {
    if (checking || acting || offer?.status !== "live") return;
    if (performance.now() >= deadline.current) { setOffer(expired(offer)); setRetry((value) => value + 1); return; }
    const controller = new AbortController();
    action.current?.abort();
    action.current = controller;
    setActing(true);
    setError(null);
    const started = performance.now();
    try {
      const response = await fetch(`/api/offers/${offerId}/directions`, { cache: "no-store", headers: { Accept: "application/json" }, signal: controller.signal });
      if (!response.ok) throw new Error("Directions unavailable");
      const destination = publicOfferDirectionsSchema.parse(await response.json());
      if (controller.signal.aborted) return;
      const remaining = Date.parse(destination.endsAt) - Date.parse(destination.serverNow);
      if (remaining <= performance.now() - started || performance.now() >= deadline.current) throw new Error("Offer ended");
      window.location.assign(destination.destination);
    } catch {
      if (!controller.signal.aborted) { setError("Directions are unavailable. Check the offer again."); setRetry((value) => value + 1); }
    } finally { if (action.current === controller) setActing(false); }
  }

  return <main className="mx-auto w-full max-w-3xl space-y-8 px-5 py-8 pb-28 sm:px-8 sm:py-12">
    <Link prefetch={false} href="/" className="inline-flex min-h-11 items-center text-sm text-forest underline underline-offset-4">Return to Pinpoint</Link>
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">Shopping Offers</p>
      <h1 className="break-words text-3xl font-semibold tracking-tight sm:text-4xl">{offer?.status === "live" ? offer.content.title : offer?.status === "scheduled" ? "This offer has not started" : offer?.status === "expired" ? "This offer has ended" : offer?.status === "unavailable" ? "This offer is unavailable" : "Could not load this offer"}</h1>
      <p role="status" className="text-sm text-muted-foreground">{checking ? "Checking current availability…" : offer?.status === "live" ? "Available now" : offer?.status === "scheduled" ? `Starts ${date(offer.startsAt)}` : offer?.status === "expired" ? `Ended ${date(offer.endsAt)}` : offer?.status === "unavailable" ? "It may have been withdrawn or may be awaiting confirmation." : "Availability could not be checked."}</p>
    </div>
    {offer?.status === "live" ? <>
      <p className="whitespace-pre-wrap break-words text-lg leading-relaxed">{offer.content.benefit}</p>
      <section aria-labelledby="offer-shop" className="space-y-3 border-y border-border py-6">
        <h2 id="offer-shop" className="break-words text-xl font-semibold">{offer.content.shopName}</h2>
        <p className="whitespace-pre-wrap break-words">{offer.content.address}</p>
        <p className="text-sm text-muted-foreground">{offer.place.name} · {offer.place.region}</p>
        <p className="text-sm">Ends {date(offer.endsAt)}</p>
        <Button className="min-h-11 w-full sm:w-auto" disabled={checking || acting} onClick={() => void directions()}>{acting ? "Checking directions…" : "Get directions"}</Button>
        <p className="text-xs text-muted-foreground">Opens Google Maps. Check the terms before visiting.</p>
      </section>
      <section aria-labelledby="offer-terms" className="space-y-3"><h2 id="offer-terms" className="text-xl font-semibold">Offer terms</h2><p className="whitespace-pre-wrap break-words leading-relaxed">{offer.content.terms}</p></section>
      <ReportPanel shoppingOfferId={offer.offerId} label="Report this offer" />
      <div className="space-y-1 text-sm text-muted-foreground"><p>Confirmed {date(offer.confirmedAt)}</p>{offer.poster ? <p className="break-words">Posted by {offer.poster.displayName} (@{offer.poster.username})</p> : null}</div>
    </> : <p>{offer?.status === "scheduled" ? "Terms and directions will be available when the offer starts." : "Directions are unavailable for this offer. Check again for its current status."}</p>}
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    <Button variant="outline" className="min-h-11" disabled={checking} onClick={() => setRetry((value) => value + 1)}>Check again</Button>
  </main>;
}

