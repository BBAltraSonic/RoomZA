"use client";
import { SpecialDetailsProvider, SpecialDetailSurface, useSpecialDetails } from "@/features/discovery/special-details";
import { DiscoveryClock } from "@/features/discovery/discovery-clock";
import { SavedSpecialsProvider } from "@/features/discovery/saved-specials-client";
import Link from "next/link";
import { useDiscoveryControls } from "@/features/discovery/url-controls";
import { DiscoveryLocationAction } from "@/features/discovery/location-action";
import { OfferFeedCard } from "./offer-feed-card";
import { observeDiscoveryRefresh } from "@/features/discovery/refresh";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { discoveryCategoryHref, PinpointHeader, DiscoverySortPills } from "@/components/navigation/pinpoint-header";
import { DiscoveryShell } from "@/features/discovery/discovery-shell";
import { DiscoveryResultsSummary } from "@/features/discovery/discovery-results-summary";
import { DiscoveryMapLoader } from "@/features/discovery/discovery-map-loader";
import { haversineKm } from "@/features/map-discovery/lib/distance";
import { Button } from "@/components/ui/button";
import { LocationSelector } from "@/features/map-discovery/location-selector";
import type { DiscoveryPlace } from "@/features/places/place";
import { publicOfferFeedSchema, type PublicOfferCursor } from "./public-contract";
import type { z } from "zod";

type Feed = z.infer<typeof publicOfferFeedSchema>;
const format = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
function feedUrl(areaId: string, cursor?: PublicOfferCursor | null, view: "feed" | "map" = "map", area?: string) {
  const params = new URLSearchParams({ areaId, view });
  if (area) params.set("area", area);
  if (cursor) { params.set("afterConfirmedAt", cursor.confirmedAt); params.set("afterOfferId", cursor.offerId); }
  return `/offers?${params}`;
}
export function PublicOfferFeedScreen(props: Parameters<typeof PublicOfferFeedScreenContent>[0]) {
  return <SpecialDetailsProvider category="shopping"><PublicOfferFeedScreenContent key={(props.areaId ?? "none") + ":" + (props.cursor?.offerId ?? "first") + ":" + String(props.invalid ?? false)} {...props} /></SpecialDetailsProvider>;
}

function PublicOfferFeedScreenContent({ areaId, place: initialPlace, initial, cursor, invalid = false, mapApiKey, initialFailure = false }: { areaId: string | null; place: DiscoveryPlace | null; initial: Feed | null; cursor: PublicOfferCursor | null; invalid?: boolean; view?: "feed" | "map"; mapApiKey?: string; initialFailure?: boolean }) {
  const details = useSpecialDetails();
  const view = "map";
  const router = useRouter();
  const [place, setPlace] = useState(initialPlace);
  const [feed, setFeed] = useState<Feed | null>(initial);
  const [checking, setChecking] = useState(Boolean(areaId && place));
  const [error, setError] = useState(initialFailure);
  const [selectedId, setSelectedId] = useState<string>();
  const kind = "Shopping";
  const [retry, setRetry] = useState(0);
  const [nextTransition, setNextTransition] = useState<number | null>(() => initial?.items.length
    ? performance.now() + Math.min(...initial.items.map(item => Date.parse(item.endsAt) - Date.parse(initial.serverNow))) : null);
  const { query, setQuery, sort, setSort, withControls } = useDiscoveryControls(["Ending soon", "Latest", "Nearest"]);
  useEffect(() => {
    if (nextTransition === null) return;
    const timer = setTimeout(() => { setFeed(null); setRetry(value => value + 1); }, Math.max(0, Math.min(nextTransition - performance.now(), 2_147_483_647)));
    return () => clearTimeout(timer);
  }, [nextTransition]);
  useEffect(() => {
    if (!areaId || place || invalid) return;
    const controller = new AbortController();
    void fetch("/api/places/" + areaId, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("Location unavailable");
      const location = (await response.json()).data.place as DiscoveryPlace;
      if (location.id !== areaId) throw new Error("Wrong location");
      if (!controller.signal.aborted) setPlace(location);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [areaId, place, invalid, retry]);
  useEffect(() => {
    if (!areaId || !place || invalid) return;
    let disposed = false, sequence = 0;
    let request: AbortController | undefined;
    let alarm: ReturnType<typeof setTimeout> | undefined;
    async function refresh() {
      request?.abort();
      const controller = new AbortController(); request = controller;
      const current = ++sequence, started = performance.now();
      setChecking(true);
      try {
        const params = new URLSearchParams({ areaId: areaId! });
        if (cursor) { params.set("afterConfirmedAt", cursor.confirmedAt); params.set("afterOfferId", cursor.offerId); }
        const response = await fetch(`/api/offers?${params}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Feed unavailable");
        const fresh = publicOfferFeedSchema.parse(await response.json());
        if (fresh.areaId !== areaId) throw new Error("Wrong offer area");
        if (disposed || controller.signal.aborted || current !== sequence) return;
        clearTimeout(alarm);
        const ends = fresh.items.map((item) => started + Date.parse(item.endsAt) - Date.parse(fresh.serverNow));
        const nextEnd = ends.length ? Math.min(...ends) : null;
        if (nextEnd !== null && nextEnd <= performance.now()) {
          setFeed(null); setError(false);
          alarm = setTimeout(() => { void refresh(); }, 100);
          return;
        }
        setFeed(fresh); setChecking(false); setError(false);
        setNextTransition(nextEnd);
      } catch {
        if (disposed || controller.signal.aborted || current !== sequence) return;
        setChecking(false); setError(true);
      }
    }
    void refresh();
    const stopRefresh = observeDiscoveryRefresh(refresh);
    return () => { disposed = true; request?.abort(); clearTimeout(alarm); stopRefresh(); };
  }, [areaId, place, invalid, cursor, retry]);

  const choose = (location: DiscoveryPlace) => router.push(withControls(feedUrl(location.id, null, view, location.fullAddress)));
  const visibleOffers = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return (feed?.items ?? []).filter((item) => [item.content.title, item.content.benefit, item.content.shopName, item.content.address].some((text) => text.toLocaleLowerCase().includes(term))).sort((a, b) => {
      if (sort === "Latest") return Date.parse(b.confirmedAt) - Date.parse(a.confirmedAt);
      if (sort === "Nearest" && place) return haversineKm(place.center, { lat: a.content.latitude, lng: a.content.longitude }) - haversineKm(place.center, { lat: b.content.latitude, lng: b.content.longitude });
      return Date.parse(a.endsAt) - Date.parse(b.endsAt);
    });
  }, [feed, query, sort, place]);
  const points = useMemo(() => visibleOffers.map((item) => ({ id: item.offerId, title: item.content.title, latitude: item.content.latitude, longitude: item.content.longitude })), [visibleOffers]);
  const select = (id: string) => { setSelectedId(id); if (details?.id) details.open(id); document.getElementById("special-" + id)?.scrollIntoView({ block: "nearest", behavior: "smooth" }); };
  const selectedItem = visibleOffers.find(item => item.offerId === selectedId);
  const selectedCard = selectedItem && !details?.id ? <OfferFeedCard item={selectedItem} selected expanded onClose={() => setSelectedId(undefined)} /> : undefined;
  const header = <PinpointHeader category="specials" addHref="/post/offers" view={view} areaId={areaId} area={place?.fullAddress} count={!checking && !error ? feed?.totalCount : undefined}
      location={<LocationSelector idPrefix="offer-feed" selectedLocation={place?.label} onSelect={choose} searchUrl="/api/offers/places" />}
      searchActive={Boolean(query)} searchHint="Filter this page" search={<form role="search" onSubmit={(event) => event.preventDefault()}><Search size={16} aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search specials on this page" placeholder="Search specials or shops" className="bg-transparent outline-none" />{query ? <button type="button" aria-label="Clear specials search" onClick={() => setQuery("")} className="flex size-11 shrink-0 items-center justify-center"><X size={16} aria-hidden="true" /></button> : null}</form>}
      toolbar={<DiscoverySortPills options={["Ending soon", "Latest", "Nearest"]} value={sort} onChange={setSort} />}
    />;
  const results = <div className="space-y-5 px-5 py-6">
    <header className="space-y-3"><p className="text-xs font-semibold uppercase tracking-widest text-forest">The best of what’s nearby</p><h1 className="text-2xl font-semibold tracking-tight">Specials{place ? " in " + place.label : " nearby"}</h1><p className="text-muted-foreground">Find confirmed specials, read the terms and see where to go.</p>{place ? <p className="break-words text-sm text-muted-foreground">{place.fullAddress}</p> : null}</header>
    <div aria-label="Special type" className="flex flex-wrap gap-2">{["Shopping", "Places", "Events"].map((option) => <button key={option} type="button" aria-pressed={kind === option} onClick={() => { if(option === "Shopping")return; const params=new URLSearchParams({kind:option==="Places"?"tourism":"event",view});if(areaId)params.set("areaId",areaId);if(place)params.set("area",place.fullAddress);router.push(withControls("/offers?"+params)); }} className={"min-h-11 rounded-full border border-border px-4 text-sm font-semibold " + (kind === option ? "bg-forest text-primary-foreground" : "bg-panel text-ink")}>{option}</button>)}</div>
    {initialFailure && !place ? <div role="alert"><p>This location could not be loaded. Try again or choose another location.</p><Button onClick={() => setRetry((value) => value + 1)}>Try again</Button></div> : invalid ? <p role="alert" className="text-status-error-text">This location link is unavailable. Choose another location.</p> : !place ? <div className="space-y-4"><p>Choose a location to see offers. You can search by suburb, town or city.</p><DiscoveryLocationAction idPrefix="offer-feed" /></div> : <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-3"><p role="status" className="text-sm">{checking ? "Checking offers…" : error ? "Offers could not be checked." : feed ? `${feed.totalCount} ${feed.totalCount === 1 ? "offer" : "offers"} · ${visibleOffers.length} shown on this page · Checked ${format.format(new Date(feed.serverNow))} SAST` : "Loading offers…"}</p><Button variant="outline" className="min-h-11" disabled={checking} onClick={() => setRetry((value) => value + 1)}>Refresh offers</Button></div>
      {error ? <p role="alert" className="text-status-error-text">Could not load offers. Previously loaded results remain available. Refresh or choose another location.</p> : null}{feed && feed.items.length === 0 ? <div className="space-y-3"><h2 className="text-xl font-semibold">{cursor && feed.totalCount > 0 ? "No more offers on this page" : `No current offers in ${place.label}`}</h2><p className="text-muted-foreground">Offers will appear here once confirmed and available. You can choose another location.</p><DiscoveryLocationAction idPrefix="offer-feed">Choose another location</DiscoveryLocationAction>{cursor ? <Link href={feedUrl(place.id, null, view, place.fullAddress)} prefetch={false} className="inline-flex min-h-11 items-center text-forest underline">Back to first offers</Link> : null}</div> : feed ? <div>{cursor || feed.nextCursor ? <p className="text-sm text-muted-foreground">Search and sorting apply to this page. Nearest uses the selected location’s centre.</p> : sort === "Nearest" ? <p className="text-sm text-muted-foreground">Nearest to the selected location’s centre.</p> : null}{visibleOffers.length === 0 ? <p role="status" className="py-6 text-muted-foreground">No specials match your search on this page. Try another shop or clear your search.</p> : null}<ul className="space-y-4">{visibleOffers.map((item) => <li id={"special-" + item.offerId} key={item.offerId}><OfferFeedCard item={item} selected={selectedId === item.offerId} onShowOnMap={view === "map" ? () => select(item.offerId) : undefined} /></li>)}</ul></div> : null}
      <nav aria-label="Offer and Property navigation" className="flex flex-wrap gap-x-6 gap-y-3">
        {feed?.nextCursor ? <Link href={withControls(feedUrl(place.id, feed.nextCursor, view, place.fullAddress))} prefetch={false} className="inline-flex min-h-11 items-center text-forest underline">Next offers</Link> : null}
        <Link href={discoveryCategoryHref("property", place.id, place.fullAddress, view)} prefetch={false} className="inline-flex min-h-11 items-center text-sm text-forest underline">Browse Property in this area</Link>
      </nav>
    </>}
    </div>;
  return <DiscoveryClock serverNow={feed?.serverNow ?? "2026-01-01T00:00:00Z"}><SavedSpecialsProvider><DiscoveryShell sheetKey="shopping" resultCount={!checking && !error && feed ? visibleOffers.length : undefined}
    resultsSummary={<DiscoveryResultsSummary label="Specials" count={visibleOffers.length} totalCount={feed?.totalCount} loading={checking || Boolean(areaId && !place)} error={error || invalid}
      message={invalid ? "This location link is unavailable. Choose another location." : !areaId ? "Choose a location to see shopping specials." : undefined}
      action={!areaId || invalid ? <DiscoveryLocationAction idPrefix="offer-feed" /> : undefined} onRetry={() => setRetry(value => value + 1)} />} detail={details?.id ? <SpecialDetailSurface /> : undefined} onboarding={!areaId} header={header} results={results} view={view} resultsLabel="Specials near the map" map={<DiscoveryMapLoader mapApiKey={mapApiKey} place={place} points={points} selectedId={points.some((point) => point.id === selectedId) ? selectedId : undefined} onSelect={select} selectedCard={selectedCard} onCloseSelection={() => setSelectedId(undefined)} categoryLabel="Specials" />} /></SavedSpecialsProvider></DiscoveryClock>;
}
