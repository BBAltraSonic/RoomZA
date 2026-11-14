"use client";
import { SpecialDetailsProvider, SpecialDetailSurface, useSpecialDetails } from "@/features/discovery/special-details";
import { DiscoveryClock } from "./discovery-clock";
import { SavedSpecialsProvider } from "./saved-specials-client";
import { formatDealPrice } from "./deal-schema";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { RotateCw, Search, X } from "lucide-react";
import { PinpointHeader, DiscoverySortPills } from "@/components/navigation/pinpoint-header";
import { LocationSelector } from "@/features/map-discovery/location-selector";
import type { DiscoveryPlace } from "@/features/places/place";
import type { GeoPoint, ViewportBounds } from "@/features/map-discovery/lib/types";
import { OfferFeedCard } from "@/features/offers/offer-feed-card";
import { EntryFeedCard } from "@/features/entries/entry-feed-card";
import { ServiceFeedCard } from "@/features/services/service-feed-card";
import { ServiceDetailsProvider, ServiceDetailSurface, useServiceDetails } from "@/features/services/service-details";
import { serviceTypes } from "@/features/services/schema";
import { DiscoveryShell } from "./discovery-shell";
import { DiscoveryResultsSummary } from "./discovery-results-summary";
import { DiscoveryMapLoader } from "./discovery-map-loader";
import { useDiscoverySearchParams } from "./use-discovery-search-params";
import { useDiscoveryControls } from "./url-controls";
import { boundsSchema, formatViewportBbox, parseViewportBbox, type ViewportCategory, type ViewportQuery } from "./viewport-contract";
import { useViewportFeed } from "./use-viewport-feed";
import { DiscoveryMapSlot } from "./discovery-stage";
import type { DiscoveryMapProps } from "./discovery-map";
import { useWorkspaceNavigation } from "./workspace-navigation";
import { useProgressiveWindow } from "@/lib/hooks/use-progressive-window";
import { isNewListing } from "@/features/listings/listing-freshness";
import { belowNearbyPercents, servicePinContent, specialPinContent, specialPriceCents } from "@/features/map-discovery/lib/pin-content";

const specialSorts = ["Ending soon", "Latest", "Nearest"] as const;
const serviceSorts = ["Latest", "Nearest"] as const;
type FeedItem = NonNullable<ReturnType<typeof useViewportFeed>["feed"]>["items"][number];
const feedItemId = (item: FeedItem) => "offerId" in item ? item.offerId : "entryId" in item ? item.entryId : item.id;
function toMapPoint(item: FeedItem, belowNearby: ReadonlyMap<string, number>): DiscoveryMapProps["points"][number] {
  const base = { id: feedItemId(item), title: item.content.title, latitude: item.content.latitude, longitude: item.content.longitude };
  if ("offerId" in item) {
    const { benefit, shopName: identity, priceCents, originalPriceCents, title } = item.content;
    return { ...base, ...specialPinContent({ title, benefit, identity, priceCents, originalPriceCents }), kind: "special", identity, priceLabel: priceCents === undefined ? undefined : formatDealPrice(priceCents), amount: specialPriceCents({ title, benefit, priceCents }), startsAt: item.startsAt, endsAt: item.endsAt };
  }
  if ("entryId" in item) {
    const { venueName: identity, priceCents, originalPriceCents, title, startsAt, endsAt } = item.content;
    const kind = item.category === "event" ? "event" : "place";
    return { ...base, ...specialPinContent({ title, identity, priceCents, originalPriceCents }), kind, identity, priceLabel: priceCents === undefined ? undefined : formatDealPrice(priceCents), amount: specialPriceCents({ title, priceCents }), startsAt, endsAt, onNow: kind === "event" && item.state === "live" };
  }
  const percent = belowNearby.get(item.id);
  return { ...base, ...servicePinContent(item.content), kind: "service", serviceType: item.content.serviceType, amount: item.content.priceFromCents, tag: percent ? percent + "% below nearby" : undefined, isNew: isNewListing(item.approved_at) };
}
/** Memoised so moving the map or selecting a pin re-renders only the rows it changes. */
const FeedRow = memo(function FeedRow({ item, id, distance, selected, onShowOnMap }: { item: FeedItem; id: string; distance?: string; selected: boolean; onShowOnMap: (id: string) => void }) {
  const cardProps = { distance, selected, onShowOnMap: () => onShowOnMap(id) };
  return <li id={"viewport-" + id}>{"offerId" in item ? <OfferFeedCard item={item} {...cardProps} /> : "entryId" in item ? <EntryFeedCard item={item} {...cardProps} /> : <ServiceFeedCard item={item} {...cardProps} />}</li>;
});
export function ViewportDiscoveryScreen(props: { category: ViewportCategory; mapApiKey?: string }) {
  return props.category === "service" ? <ServiceDetailsProvider><ViewportDiscoveryContent {...props} /></ServiceDetailsProvider> : <SpecialDetailsProvider category={props.category}><ViewportDiscoveryContent {...props} /></SpecialDetailsProvider>;
}
function ViewportDiscoveryContent({ category, mapApiKey }: { category: ViewportCategory; mapApiKey?: string }) {
  const details = useSpecialDetails();
  const serviceDetails = useServiceDetails();
  const params = useDiscoverySearchParams(), router = useRouter();
  const urlBounds = parseViewportBbox(params.get("bbox"));
  const area = z.string().uuid().safeParse(params.get("areaId"));
  const areaId = area.success ? area.data : null;
  const invalid = params.has("bbox") ? !urlBounds : params.has("areaId") && !area.success;
  const services = category === "service", label = services ? "Services" : category === "shopping" ? "Specials" : category === "tourism" ? "Places Specials" : "Events Specials";
  const controls = useDiscoveryControls(services ? serviceSorts : specialSorts, services ? ["All services", ...serviceTypes] : []);
  const [place, setPlace] = useState<DiscoveryPlace | null>(null);
  const [failedArea, setFailedArea] = useState<string | null>(null);
  const [bounds, setBounds] = useState<ViewportBounds | null>(null);
  const [selected, setSelected] = useState<string>();
  const [userLocation, setUserLocation] = useState<GeoPoint | null>(null);
  const [initialClock] = useState(() => new Date().toISOString());
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
  const feedItems = activeFeed?.items;
  const points = useMemo(() => {
    const items = feedItems ?? [];
    const belowNearby = belowNearbyPercents(items.flatMap(item => "offerId" in item || "entryId" in item ? [] : [item]), {
      group: item => item.content.serviceType + ":" + item.content.priceUnit,
      price: item => item.content.priceFromCents,
    });
    return items.map(item => toMapPoint(item, belowNearby));
  }, [feedItems]);
  const detailId = details?.id, openDetail = details?.open;
  const select = useCallback((id: string) => { setSelected(id); if (detailId) openDetail?.(id); document.getElementById("viewport-" + id)?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [detailId, openDetail]);
  const closeSelection = useCallback(() => setSelected(undefined), []);
  const selectedIndex = selected && feedItems ? feedItems.findIndex(item => feedItemId(item) === selected) : -1;
  const { count: listCount, hasMore: listHasMore, sentinelRef: listSentinel } = useProgressiveWindow({ total: feedItems?.length ?? 0, resetKey: `${feedItems?.length ?? 0}:${feedItems?.[0] ? feedItemId(feedItems[0]) : ""}:${feedItems?.at(-1) ? feedItemId(feedItems.at(-1)!) : ""}`, minCount: selectedIndex + 1 });
  const navigation = useWorkspaceNavigation();
  const choose = (next: DiscoveryPlace) => {
    setPlace(next); setFailedArea(null); setBounds(null);
    const url = new URL(window.location.href); url.searchParams.delete("bbox");
    url.searchParams.set("areaId", next.id); url.searchParams.set("area", next.fullAddress);
    router.push(url.pathname + url.search);
  };
  const categoryHref = (kind: "shopping" | "tourism" | "event") => {
    const next = new URLSearchParams(params);
    next.delete("detailId"); next.set("view", "map"); next.delete("page"); next.delete("afterConfirmedAt"); next.delete("afterOfferId");
    if (kind === "shopping") next.delete("kind"); else next.set("kind", kind);
    return "/offers?" + next;
  };
  const selectedItem = feedItems?.find(item => feedItemId(item) === selected);
  const distance = (lat: number, lng: number) => {
    if (!bounds) return undefined;
    const centerLat = userLocation?.lat ?? (bounds.north + bounds.south) / 2, centerLng = userLocation?.lng ?? (bounds.east + bounds.west) / 2, radians = Math.PI / 180;
    const a = Math.sin((lat - centerLat) * radians / 2) ** 2 + Math.cos(lat * radians) * Math.cos(centerLat * radians) * Math.sin((lng - centerLng) * radians / 2) ** 2;
    return (6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)))).toFixed(1) + (userLocation ? " km away" : " km from map centre");
  };
  const selectedCard = selectedItem && "offerId" in selectedItem ? <OfferFeedCard item={selectedItem} selected expanded onClose={closeSelection} distance={distance(selectedItem.content.latitude, selectedItem.content.longitude)} /> : selectedItem && "entryId" in selectedItem ? <EntryFeedCard item={selectedItem} selected expanded onClose={closeSelection} distance={distance(selectedItem.content.latitude, selectedItem.content.longitude)} /> : undefined;
  const mapProps: DiscoveryMapProps = { mapApiKey, place: currentPlace, searchQuery: controls.query, targetBounds: urlBounds ?? currentPlace?.bounds ?? null, onBoundsChange, onUserLocation: setUserLocation, userLocation, serverNow: activeFeed?.serverNow ?? initialClock, points, selectedId: points.some(point => point.id === (serviceDetails?.id ?? selected)) ? (serviceDetails?.id ?? selected) : undefined, onSelect: select, categoryLabel: services ? "Services" : "Specials", selectedCard: details?.id ? undefined : selectedCard, onCloseSelection: closeSelection };
  return <DiscoveryClock serverNow={activeFeed?.serverNow ?? initialClock}><SavedSpecialsProvider><DiscoveryShell
    sheetKey={category} resultCount={!loading && !error && activeFeed ? activeFeed.items.length : undefined}
    resultsSummary={<DiscoveryResultsSummary label={services ? "Services" : "Specials"} count={activeFeed?.items.length} totalCount={activeFeed?.totalCount}
      loading={loading || !bounds} error={error || invalid || (placeError && !urlBounds)}
      message={invalid ? "This map link is invalid. Choose a location above." : placeError && !urlBounds ? "The linked location could not be loaded." : undefined}
      onRetry={() => { refresh(); setPlaceRetry(value => value + 1); }} />}
    detail={services ? (serviceDetails?.id ? <ServiceDetailSurface /> : undefined) : details?.id ? <SpecialDetailSurface /> : undefined} detailLabel={services ? "Service details" : "Special details"} compactResults={!services} resultsLabel={label + " near the map"} header={<PinpointHeader
    category={services ? "services" : "specials"} areaId={areaId} area={currentPlace?.fullAddress} count={!loading && !error ? activeFeed?.totalCount : undefined}
    addHref={services ? "/post/services" : category === "shopping" ? "/post/offers" : "/post/entries/" + category}
    location={<LocationSelector idPrefix="viewport" selectedLocation={currentPlace?.label} onSelect={choose} />}
    searchActive={Boolean(controls.query)} search={<form role="search" className="xl:max-w-[520px]" onSubmit={event => event.preventDefault()}>
      <Search size={16} aria-hidden="true" /><input type="search" aria-label={services ? "Search services on this page" : "Search specials on this page"} placeholder={services ? "Search plumbers, cleaners…" : "Search specials or venues"} value={controls.query} onChange={event => controls.setQuery(event.target.value)} className="bg-transparent outline-none" />
      {controls.query ? <button type="button" aria-label="Clear search" className="flex size-11 shrink-0 items-center justify-center" onClick={() => controls.setQuery("")}><X size={16} aria-hidden="true" /></button> : null}
    </form>}
    toolbar={<>{services ? <select aria-label="Service type" value={controls.type} onChange={event => controls.setType(event.target.value)} className="min-h-11 max-w-40 rounded-full border border-border bg-panel px-3"><option>All services</option>{serviceTypes.map(type => <option key={type}>{type}</option>)}</select> : null}<DiscoverySortPills options={services ? serviceSorts : specialSorts} value={controls.sort} onChange={controls.setSort} /></>}
  />} map={cameraReady ? <DiscoveryMapSlot layer={{ kind: "points", props: mapProps }} fallback={<DiscoveryMapLoader {...mapProps} />} /> : <p role="status" className="p-6">Loading map location…</p>}
    results={<div className={services ? "space-y-4 px-4 py-4" : "space-y-3 px-4 py-4"}><header className="sr-only lg:not-sr-only"><h1 className="font-heading text-xl font-semibold tracking-tight">{label} in this map area</h1></header>
      {!services ? <nav aria-label="Special type" className="flex flex-wrap gap-2">{(["shopping", "tourism", "event"] as const).map(kind => <Link key={kind} prefetch={false} aria-current={kind === category ? "page" : undefined} href={categoryHref(kind)} onNavigate={navigation ? event => { event.preventDefault(); navigation.go(categoryHref(kind), kind); } : undefined} className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-semibold aria-[current=page]:bg-selection aria-[current=page]:text-selection-foreground">{kind === "shopping" ? "Shopping" : kind === "tourism" ? "Places" : "Events"}</Link>)}</nav> : null}
      {invalid ? <p role="alert" className="text-status-warning-text">This map link is invalid. Choose a location to reposition the map.</p> : null}
      {placeError && !urlBounds ? <p role="alert" className="text-status-warning-text">The linked location could not be loaded. Showing the default map.</p> : null}
      <div className="flex items-center justify-between gap-2"><p role="status" className="text-xs text-muted-foreground">{loading || !bounds ? "Loading visible listings…" : `${activeFeed?.totalCount ?? 0} listings · ${activeFeed?.items.length ?? 0} shown in this map area`}</p>
      <button type="button" aria-label={"Refresh " + (services ? "services" : "specials")} onClick={() => { refresh(); setPlaceRetry(value => value + 1); }} className={services ? "min-h-11 rounded-full border border-border bg-panel px-4 text-sm font-semibold" : "flex size-11 shrink-0 items-center justify-center rounded-full text-forest hover:bg-panel focus-visible:ring-2 focus-visible:ring-ring"}>{services ? "Refresh services" : <RotateCw size={16} aria-hidden="true" />}</button></div>
      {error ? <p role="alert" className="text-status-error-text">Visible listings could not be refreshed. Previously loaded results remain available. Try again.</p> : null}
      {activeFeed && activeFeed.totalCount > activeFeed.items.length ? <p>Showing up to 250 listings. Zoom in or filter to see more specific results.</p> : null}
      {controls.sort === "Nearest" ? <p className="text-xs text-muted-foreground">Nearest to the visible map’s centre.</p> : null}
      {!loading && !error && activeFeed?.items.length === 0 ? <p>No matching listings in this map area. Move the map or clear your filters.</p> : null}
      <ul className={services ? "space-y-4" : "space-y-3"}>{feedItems?.slice(0, listCount).map(item => {
        const id = feedItemId(item);
        return <FeedRow key={id} item={item} id={id} distance={distance(item.content.latitude, item.content.longitude)} selected={selected === id} onShowOnMap={select} />;
      })}</ul>
      {listHasMore ? <div ref={listSentinel} aria-hidden="true" className="h-px w-full" /> : null}
    </div>} /></SavedSpecialsProvider></DiscoveryClock>;
}
