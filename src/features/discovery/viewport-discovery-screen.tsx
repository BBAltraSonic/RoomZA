"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Search, X } from "lucide-react";
import { PinpointHeader, DiscoverySortPills } from "@/components/navigation/pinpoint-header";
import { LocationSelector } from "@/features/map-discovery/location-selector";
import type { DiscoveryPlace } from "@/features/places/place";
import type { ViewportBounds } from "@/features/map-discovery/lib/types";
import { OfferFeedCard } from "@/features/offers/offer-feed-card";
import { EntryFeedCard } from "@/features/entries/entry-feed-card";
import { ServiceFeedCard } from "@/features/services/service-feed-card";
import { serviceTypes } from "@/features/services/schema";
import { DiscoveryShell } from "./discovery-shell";
import { DiscoveryMapLoader } from "./discovery-map-loader";
import { useDiscoverySearchParams } from "./use-discovery-search-params";
import { useDiscoveryControls } from "./url-controls";
import { boundsSchema, formatViewportBbox, parseViewportBbox, type ViewportCategory, type ViewportQuery } from "./viewport-contract";
import { useViewportFeed } from "./use-viewport-feed";

const specialSorts = ["Ending soon", "Latest", "Nearest"] as const;
const serviceSorts = ["Latest", "Nearest"] as const;
export function ViewportDiscoveryScreen({ category, mapApiKey }: { category: ViewportCategory; mapApiKey?: string }) {
  const params = useDiscoverySearchParams(), router = useRouter();
  const urlBounds = parseViewportBbox(params.get("bbox"));
  const area = z.string().uuid().safeParse(params.get("areaId"));
  const areaId = area.success ? area.data : null;
  const invalid = params.has("bbox") ? !urlBounds : params.has("areaId") && !area.success;
  const services = category === "service", label = services ? "Services" : category === "shopping" ? "Specials" : category === "tourism" ? "Tourism Specials" : "Events Specials";
  const controls = useDiscoveryControls(services ? serviceSorts : specialSorts, services ? ["All services", ...serviceTypes] : []);
  const [place, setPlace] = useState<DiscoveryPlace | null>(null);
  const [failedArea, setFailedArea] = useState<string | null>(null);
  const [bounds, setBounds] = useState<ViewportBounds | null>(null);
  const [selected, setSelected] = useState<string>();
  const [placeRetry, setPlaceRetry] = useState(0);
  useEffect(() => {
    if (!areaId) return;
    const controller = new AbortController();
    void fetch("/api/places/" + areaId, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]), cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Location unavailable");
      const next = (await response.json()).data.place as DiscoveryPlace;
      if (next.id !== areaId || !boundsSchema.safeParse(next.bounds).success || !Number.isFinite(next.center?.lat) || !Number.isFinite(next.center?.lng)) throw new Error("Wrong location");
      if (!controller.signal.aborted) { setPlace(next); setFailedArea(null); }
    }).catch(() => { if (!controller.signal.aborted) setFailedArea(areaId); });
    return () => controller.abort();
  }, [areaId, placeRetry]);
  const currentPlace = place?.id === areaId ? place : null;
  const placeError = failedArea !== null && failedArea === areaId;
  const cameraReady = Boolean(urlBounds) || !areaId || Boolean(currentPlace) || placeError;
  const onBoundsChange = useCallback((next: ViewportBounds) => {
    const parsed = boundsSchema.safeParse(next);
    if (!parsed.success) return;
    const value = formatViewportBbox(parsed.data);
    setBounds(previous => previous && formatViewportBbox(previous) === value ? previous : parseViewportBbox(value));
    const url = new URL(window.location.href);
    if (url.searchParams.get("bbox") !== value) {
      url.searchParams.set("bbox", value);
      window.history.replaceState(window.history.state, "", url);
    }
  }, []);
  const query: ViewportQuery | null = bounds && cameraReady && !invalid ? {
    category, bounds, q: controls.query, sort: controls.sort as ViewportQuery["sort"], serviceType: services ? controls.type as ViewportQuery["serviceType"] : "All services",
  } : null;
  const { feed, loading, error, refresh } = useViewportFeed(query);
  const activeFeed = feed?.category === category ? feed : null;
  const points = useMemo(() => (activeFeed?.items ?? []).map(item => ({
    id: "offerId" in item ? item.offerId : "entryId" in item ? item.entryId : item.id,
    title: item.content.title, latitude: item.content.latitude, longitude: item.content.longitude,
  })), [activeFeed]);
  const select = (id: string) => { setSelected(id); document.getElementById("viewport-" + id)?.scrollIntoView({ block: "nearest", behavior: "smooth" }); };
  const choose = (next: DiscoveryPlace) => {
    setPlace(next); setFailedArea(null); setBounds(null);
    const url = new URL(window.location.href); url.searchParams.delete("bbox");
    url.searchParams.set("areaId", next.id); url.searchParams.set("area", next.fullAddress);
    router.push(url.pathname + url.search);
  };
  const categoryHref = (kind: "shopping" | "tourism" | "event") => {
    const next = new URLSearchParams(params);
    next.set("view", "map"); next.delete("page"); next.delete("afterConfirmedAt"); next.delete("afterOfferId");
    if (kind === "shopping") next.delete("kind"); else next.set("kind", kind);
    return "/offers?" + next;
  };
  return <DiscoveryShell resultsLabel={label + " near the map"} header={<PinpointHeader
    category={services ? "services" : "specials"} areaId={areaId} area={currentPlace?.fullAddress} count={!loading && !error ? activeFeed?.totalCount : undefined}
    addHref={services ? "/post/services" : category === "shopping" ? "/post/offers" : "/post/entries/" + category}
    location={<LocationSelector idPrefix="viewport" selectedLocation={currentPlace?.label} onSelect={choose} searchUrl="/api/offers/places" />}
    searchActive={Boolean(controls.query)} searchHint="Filter this map" search={<form role="search" onSubmit={event => event.preventDefault()}>
      <Search size={16} aria-hidden="true" /><input type="search" aria-label={services ? "Search services on this page" : "Search specials on this page"} placeholder={services ? "Search plumbers, cleaners…" : "Search specials or venues"} value={controls.query} onChange={event => controls.setQuery(event.target.value)} className="bg-transparent outline-none" />
      {controls.query ? <button type="button" aria-label="Clear search" className="flex size-11 shrink-0 items-center justify-center" onClick={() => controls.setQuery("")}><X size={16} aria-hidden="true" /></button> : null}
    </form>}
    toolbar={<>{services ? <select aria-label="Service type" value={controls.type} onChange={event => controls.setType(event.target.value)} className="min-h-11 max-w-40 rounded-full border border-border bg-panel px-3"><option>All services</option>{serviceTypes.map(type => <option key={type}>{type}</option>)}</select> : null}<DiscoverySortPills options={services ? serviceSorts : specialSorts} value={controls.sort} onChange={controls.setSort} /></>}
  />} map={cameraReady ? <DiscoveryMapLoader mapApiKey={mapApiKey} place={currentPlace} searchQuery={controls.query} targetBounds={urlBounds ?? currentPlace?.bounds ?? null} onBoundsChange={onBoundsChange} points={points} selectedId={points.some(point => point.id === selected) ? selected : undefined} onSelect={select} categoryLabel={services ? "Services" : "Specials"} /> : <p role="status" className="p-6">Loading map location…</p>}
    results={<div className="space-y-5 px-5 py-6"><header className="space-y-3"><h1 className="text-2xl font-semibold">{label} in this map area</h1><p className="text-muted-foreground">Explore the map to find {services ? "local providers" : "specials"}. Results update as you move.</p></header>
      {!services ? <nav aria-label="Special type" className="flex flex-wrap gap-2">{(["shopping", "tourism", "event"] as const).map(kind => <Link key={kind} prefetch={false} aria-current={kind === category ? "page" : undefined} href={categoryHref(kind)} className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-semibold aria-[current=page]:bg-forest aria-[current=page]:text-primary-foreground">{kind === "shopping" ? "Shopping" : kind === "tourism" ? "Tourism" : "Events"}</Link>)}</nav> : null}
      {invalid ? <p role="alert">This map link is invalid. Choose a location to reposition the map.</p> : null}
      {placeError && !urlBounds ? <p role="alert">The linked location could not be loaded. Showing the default map.</p> : null}
      <p role="status">{loading || !bounds ? "Loading visible listings…" : `${activeFeed?.totalCount ?? 0} listings · ${activeFeed?.items.length ?? 0} shown in this map area`}</p>
      <button type="button" onClick={() => { refresh(); setPlaceRetry(value => value + 1); }} className="min-h-11 rounded-full border border-border bg-panel px-4 text-sm font-semibold">Refresh {services ? "services" : "specials"}</button>
      {error ? <p role="alert">Visible listings could not be refreshed. Previously loaded results remain available. Try again.</p> : null}
      {activeFeed && activeFeed.totalCount > activeFeed.items.length ? <p>Showing up to 250 listings. Zoom in or filter to see more specific results.</p> : null}
      {controls.sort === "Nearest" ? <p className="text-xs text-muted-foreground">Nearest to the visible map’s centre.</p> : null}
      {!loading && !error && activeFeed?.items.length === 0 ? <p>No matching listings in this map area. Move the map or clear your filters.</p> : null}
      <ul className="space-y-4">{activeFeed?.items.map(item => {
        const id = "offerId" in item ? item.offerId : "entryId" in item ? item.entryId : item.id;
        const cardProps = { selected: selected === id, onShowOnMap: () => select(id) };
        return <li id={"viewport-" + id} key={id}>{"offerId" in item ? <OfferFeedCard item={item} {...cardProps} /> : "entryId" in item ? <EntryFeedCard item={item} {...cardProps} /> : <ServiceFeedCard item={item} {...cardProps} />}</li>;
      })}</ul>
    </div>} />;
}
