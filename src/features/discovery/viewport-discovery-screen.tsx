"use client";
import { SpecialDetailsProvider, SpecialDetailSurface, useSpecialDetails } from "@/features/discovery/special-details";
import { DiscoveryClock } from "./discovery-clock";
import { SavedSpecialsProvider } from "./saved-specials-client";
import { formatDealPrice } from "./deal-format";
import { memo, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { RotateCw, Search, X } from "lucide-react";
import dynamic from "next/dynamic";
import { AnimatedNumber } from "@/lib/motion/primitives";
import { cn } from "@/lib/utils";
import { PinpointHeader, DiscoverySortPills } from "@/components/navigation/pinpoint-header";
import { focusDockAssistant, useRegisterDockAssistant } from "@/components/navigation/dock-assistant";
import { LocationSelector } from "@/features/map-discovery/location-selector";
import { useLiveAreaLabel } from "@/features/map-discovery/lib/use-live-area-label";
import type { DiscoveryPlace } from "@/features/places/place";
import type { GeoPoint, ViewportBounds } from "@/features/map-discovery/lib/types";
import { OfferFeedCard } from "@/features/offers/offer-feed-card";
import { EntryFeedCard } from "@/features/entries/entry-feed-card";
import { DiscoveryShell } from "./discovery-shell";
import { DiscoveryResultsSummary } from "./discovery-results-summary";
import { DiscoveryMapLoader } from "./discovery-map-loader";
import { useDiscoverySearchParams } from "./use-discovery-search-params";
import { useDiscoveryControls } from "./url-controls";
import { boundsSchema, formatViewportBbox, parseViewportBbox, viewportResponseSchema, type ViewportCategory, type ViewportQuery } from "./viewport-contract";
import { useViewportFeed } from "./use-viewport-feed";
import { DiscoveryMapSlot } from "./discovery-stage";
import type { DiscoveryMapProps } from "./discovery-map";
import { useWorkspaceNavigation } from "./workspace-navigation";
import { useProgressiveWindow } from "@/lib/hooks/use-progressive-window";
import { specialPinContent, specialPriceCents } from "@/features/map-discovery/lib/pin-content";
import { SectionQuickChips, useSectionQuick } from "./section-quick-chips";
import { SectionFiltersButton, SectionFiltersPanel } from "./section-filters";
import { pikoItemFromFeed } from "@/features/assistant/item-facts";
import type { SectionSearch } from "@/features/assistant/section-intent";
import { countSectionMatches } from "./section-match-count";
import { pikoTip } from "@/features/piko/tips";
import { PikoTipProvider } from "@/features/piko/tips-context";

// Loads only when someone opens it, keeping it out of the first-load bundle.
const SectionAssistantPanel = dynamic(() => import("@/features/assistant/section-assistant-panel").then((module) => module.SectionAssistantPanel), { ssr: false });

const specialSorts = ["Ending soon", "Latest", "Nearest"] as const;
type FeedItem = NonNullable<ReturnType<typeof useViewportFeed>["feed"]>["items"][number];
const feedItemId = (item: FeedItem) => "offerId" in item ? item.offerId : item.entryId;
function toMapPoint(item: FeedItem): DiscoveryMapProps["points"][number] {
  const base = { id: feedItemId(item), title: item.content.title, latitude: item.content.latitude, longitude: item.content.longitude };
  if ("offerId" in item) {
    const { benefit, shopName: identity, priceCents, originalPriceCents, title } = item.content;
    return { ...base, ...specialPinContent({ title, benefit, identity, priceCents, originalPriceCents }), kind: "special", identity, priceLabel: priceCents === undefined ? undefined : formatDealPrice(priceCents), amount: specialPriceCents({ title, benefit, priceCents }), startsAt: item.startsAt, endsAt: item.endsAt };
  }
  const { venueName: identity, priceCents, originalPriceCents, title, startsAt, endsAt } = item.content;
  const kind = item.category === "event" ? "event" : "place";
  return { ...base, ...specialPinContent({ title, identity, priceCents, originalPriceCents }), kind, identity, priceLabel: priceCents === undefined ? undefined : formatDealPrice(priceCents), amount: specialPriceCents({ title, priceCents }), startsAt, endsAt, onNow: kind === "event" && item.state === "live" };
}
type FeedRowProps = { item: FeedItem; id: string; index: number; distance?: string; selected: boolean; previewed: boolean; dimmed: boolean; onShowOnMap: (id: string) => void; onPreviewChange: (id: string | undefined) => void };
/**
 * Memoised so moving the map or selecting a pin re-renders only the rows it changes.
 * Pointing at a row lifts its pin, as on the property list, and the rest step back while one is selected.
 */
const FeedRow = memo(function FeedRow({ item, id, index, distance, selected, previewed, dimmed, onShowOnMap, onPreviewChange }: FeedRowProps) {
  const cardProps = { distance, selected, onShowOnMap: () => onShowOnMap(id) };
  return <li id={"viewport-" + id} data-previewed={previewed ? "true" : "false"}
    onPointerEnter={event => { if (event.pointerType !== "touch") onPreviewChange(id); }}
    onPointerLeave={event => { if (event.pointerType !== "touch") onPreviewChange(undefined); }}
    onFocusCapture={() => onPreviewChange(id)}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) onPreviewChange(undefined); }}
    style={{ "--stagger-index": Math.min(index, 10) } as CSSProperties}
    className={cn("discovery-card-reveal rounded-[16px] transition-[opacity,transform] duration-[220ms] ease-[var(--ease-out-expo)]", previewed && !selected && "ring-2 ring-forest/25", dimmed && !previewed && "opacity-55")}>
    {"offerId" in item ? <OfferFeedCard item={item} {...cardProps} /> : <EntryFeedCard item={item} {...cardProps} />}
  </li>;
});
export function ViewportDiscoveryScreen(props: { category: ViewportCategory; mapApiKey?: string }) {
  return <SpecialDetailsProvider category={props.category}><ViewportDiscoveryContent {...props} /></SpecialDetailsProvider>;
}
function ViewportDiscoveryContent({ category, mapApiKey }: { category: ViewportCategory; mapApiKey?: string }) {
  const details = useSpecialDetails();
  const params = useDiscoverySearchParams(), router = useRouter();
  const urlBounds = parseViewportBbox(params.get("bbox"));
  const area = z.string().uuid().safeParse(params.get("areaId"));
  const areaId = area.success ? area.data : null;
  const invalid = params.has("bbox") ? !urlBounds : params.has("areaId") && !area.success;
  const label = category === "shopping" ? "Specials" : category === "tourism" ? "Places Specials" : "Events Specials";
  const [singular, plural] = category === "shopping" ? ["special", "specials"] : category === "tourism" ? ["place", "places"] : ["event", "events"];
  const controls = useDiscoveryControls(specialSorts);
  const [place, setPlace] = useState<DiscoveryPlace | null>(null);
  const [failedArea, setFailedArea] = useState<string | null>(null);
  const [bounds, setBounds] = useState<ViewportBounds | null>(null);
  const [selected, setSelected] = useState<string>();
  const [previewed, setPreviewed] = useState<string>();
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const toggleAssistant = useCallback(() => setAssistantOpen(open => !open), []);
  useRegisterDockAssistant(assistantOpen, toggleAssistant);
  const [userLocation, setUserLocation] = useState<GeoPoint | null>(null);
  const [initialClock] = useState(() => new Date().toISOString());
  const [placeRetry, setPlaceRetry] = useState(0);
  const liveArea = useLiveAreaLabel(mapApiKey);
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
    category, bounds, q: controls.query, sort: controls.sort as ViewportQuery["sort"],
  } : null;
  const { feed, loading, error, refresh } = useViewportFeed(query);
  const activeFeed = feed?.category === category ? feed : null;
  const allFeedItems = activeFeed?.items;
  const quick = useSectionQuick({ category, quickParam: params.get("quick"), items: allFeedItems, serverNow: activeFeed?.serverNow ?? initialClock });
  const feedItems = quick.filtered;
  const points = useMemo(() => (feedItems ?? []).map(toMapPoint), [feedItems]);
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
  const selectedCard = selectedItem && "offerId" in selectedItem ? <OfferFeedCard item={selectedItem} selected expanded onOpenDetails={details ? () => details.open(selectedItem.offerId) : undefined} onClose={closeSelection} distance={distance(selectedItem.content.latitude, selectedItem.content.longitude)} /> : selectedItem ? <EntryFeedCard item={selectedItem} selected expanded onOpenDetails={details ? () => details.open(selectedItem.entryId) : undefined} onClose={closeSelection} distance={distance(selectedItem.content.latitude, selectedItem.content.longitude)} /> : undefined;
  const mapProps: DiscoveryMapProps = { mapApiKey, place: currentPlace, searchQuery: controls.query, targetBounds: urlBounds ?? currentPlace?.bounds ?? null, onBoundsChange, onCameraChange: liveArea.onCameraChange, onUserLocation: setUserLocation, userLocation, serverNow: activeFeed?.serverNow ?? initialClock, points, selectedId: points.some(point => point.id === selected) ? selected : undefined, previewedId: previewed, onPreviewChange: setPreviewed, onSelect: select, categoryLabel: "Specials", selectedCard: details?.id ? undefined : selectedCard, onCloseSelection: closeSelection };
  // The open special, so "Ask Piko" answers about it from its own fields.
  const openDetailId = details?.id;
  const openFeedItem = openDetailId ? feedItems?.find(item => feedItemId(item) === openDetailId) : undefined;
  // Piko's one tip for the open special (piko/tips.ts).
  const openTip = useMemo(() => {
    if (!openFeedItem) return null;
    const clock = new Date(activeFeed?.serverNow ?? initialClock);
    const now = Number.isFinite(clock.getTime()) ? clock : new Date();
    if ("offerId" in openFeedItem) return pikoTip({ now, endsAt: openFeedItem.endsAt, publishedAt: openFeedItem.confirmedAt });
    return pikoTip({ now, endsAt: openFeedItem.content.endsAt, publishedAt: openFeedItem.approvedAt });
  }, [activeFeed?.serverNow, initialClock, openFeedItem]);
  // Piko's top results, in the list's order. Opening one closes the chat on phones, where the detail needs the screen.
  const assistantPicks = useMemo(() => (feedItems ?? []).slice(0, 3).map(pikoItemFromFeed), [feedItems]);
  // Piko's no-results rescue: what a changed search would find in this map area.
  const feedServerNow = activeFeed?.serverNow ?? initialClock;
  const countAssistantMatches = useCallback((next: SectionSearch) => {
    if (!bounds) return Promise.resolve(null);
    const now = new Date(feedServerNow);
    return countSectionMatches(next, {
      query: controls.query, items: allFeedItems,
      now: Number.isFinite(now.getTime()) ? now : new Date(),
      fetchItems: async q => {
        const key = new URLSearchParams({ category, bbox: formatViewportBbox(bounds), q, sort: controls.sort });
        try {
          const response = await fetch("/api/discovery/viewport?" + key, { cache: "no-store", signal: AbortSignal.timeout(10000) });
          if (!response.ok) return null;
          const fresh = viewportResponseSchema.parse(await response.json());
          return fresh.category === category ? fresh.items : null;
        } catch { return null; }
      },
    });
  }, [allFeedItems, bounds, category, controls.query, controls.sort, feedServerNow]);
  const openFromAssistant = (id: string) => { if (window.matchMedia?.("(max-width: 1023px)").matches) setAssistantOpen(false); details?.open(id); };
  return <PikoTipProvider tip={openTip}><DiscoveryClock serverNow={activeFeed?.serverNow ?? initialClock}><SavedSpecialsProvider>{assistantOpen ? <SectionAssistantPanel category={category} onClose={() => { setAssistantOpen(false); focusDockAssistant(); }} resultCount={!loading && !error && feedItems ? feedItems.length : undefined} openItem={openFeedItem ? pikoItemFromFeed(openFeedItem) : null} topPicks={assistantPicks} onOpenItem={openFromAssistant} countMatches={countAssistantMatches} openItemTip={openTip} /> : null}<DiscoveryShell
    sheetKey={category}
    resultsSummary={<DiscoveryResultsSummary label="Specials" count={activeFeed?.items.length} totalCount={activeFeed?.totalCount}
      loading={loading || !bounds} error={error || invalid || (placeError && !urlBounds)}
      message={invalid ? "This map link is invalid. Choose a location above." : placeError && !urlBounds ? "The linked location could not be loaded." : undefined}
      onRetry={() => { refresh(); setPlaceRetry(value => value + 1); }} />}
    detail={details?.id ? <SpecialDetailSurface /> : undefined} detailLabel="Special details" compactResults resultsLabel={label + " near the map"} header={<PinpointHeader
    category="specials" areaId={areaId} area={currentPlace?.fullAddress} count={!loading && !error ? activeFeed?.totalCount : undefined}
    location={<LocationSelector idPrefix="viewport" selectedLocation={currentPlace?.label} viewingArea={liveArea.label} onSelect={choose} />}
    searchActive={Boolean(controls.query)} search={<form role="search" className="xl:max-w-[520px]" onSubmit={event => event.preventDefault()}>
      <Search size={16} aria-hidden="true" /><input type="search" aria-label="Search specials on this page" placeholder="Search specials or venues" value={controls.query} onChange={event => controls.setQuery(event.target.value)} className="bg-transparent outline-none" />
      {controls.query ? <button type="button" aria-label="Clear search" className="flex size-11 shrink-0 items-center justify-center" onClick={() => controls.setQuery("")}><X size={16} aria-hidden="true" /></button> : null}
    </form>}
    toolbar={<DiscoverySortPills options={specialSorts} value={controls.sort} onChange={controls.setSort} />}
    filters={<SectionFiltersButton open={filtersOpen} activeCount={quick.active.length} onToggle={() => setFiltersOpen(open => !open)} />}
  />} map={cameraReady ? <DiscoveryMapSlot layer={{ kind: "points", environment: category, areaId, props: mapProps }} fallback={<DiscoveryMapLoader {...mapProps} />} /> : <p role="status" className="p-6">Loading map location…</p>}
    results={<div className="space-y-3 px-4 py-4"><header className="sr-only lg:not-sr-only"><h1 className="font-heading text-lg font-semibold leading-tight tracking-tight text-ink">{!loading && !error && activeFeed ? <><AnimatedNumber value={activeFeed.totalCount} /> {activeFeed.totalCount === 1 ? singular : plural} in this map area</> : label + " in this map area"}</h1><p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">{liveArea.label ? "Viewing " + liveArea.label + " on the map. " : ""}Results update as you move the map.</p></header>
      {filtersOpen ? <SectionFiltersPanel onClose={() => setFiltersOpen(false)}>
        <nav aria-label="Special type" className="flex flex-wrap gap-2">{(["shopping", "tourism", "event"] as const).map(kind => <Link key={kind} prefetch={false} aria-current={kind === category ? "page" : undefined} href={categoryHref(kind)} onNavigate={navigation ? event => { event.preventDefault(); navigation.go(categoryHref(kind), kind); } : undefined} className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-semibold aria-[current=page]:bg-selection aria-[current=page]:text-selection-foreground">{kind === "shopping" ? "Shopping" : kind === "tourism" ? "Places" : "Events"}</Link>)}</nav>
        <SectionQuickChips category={category} active={quick.active} onToggle={quick.toggle} />
      </SectionFiltersPanel> : null}
      {invalid ? <p role="alert" className="text-status-warning-text">This map link is invalid. Choose a location to reposition the map.</p> : null}
      {placeError && !urlBounds ? <p role="alert" className="text-status-warning-text">The linked location could not be loaded. Showing the default map.</p> : null}
      <div className="flex items-center justify-between gap-2"><p role="status" className="text-xs text-muted-foreground">{loading || !bounds ? "Loading visible listings…" : quick.active.length ? `${feedItems?.length ?? 0} match your quick filters · ${activeFeed?.items.length ?? 0} in this map area` : `${activeFeed?.totalCount ?? 0} listings · ${activeFeed?.items.length ?? 0} shown in this map area`}</p>
      <button type="button" aria-label="Refresh specials" onClick={() => { refresh(); setPlaceRetry(value => value + 1); }} className="flex size-11 shrink-0 items-center justify-center rounded-full text-forest hover:bg-panel focus-visible:ring-2 focus-visible:ring-ring"><RotateCw size={16} aria-hidden="true" /></button></div>
      {error ? <p role="alert" className="text-status-error-text">Visible listings could not be refreshed. Previously loaded results remain available. Try again.</p> : null}
      {activeFeed && activeFeed.totalCount > activeFeed.items.length ? <p>Showing up to 250 listings. Zoom in or filter to see more specific results.</p> : null}
      {controls.sort === "Nearest" ? <p className="text-xs text-muted-foreground">Nearest to the visible map’s centre.</p> : null}
      {!loading && !error && activeFeed && feedItems?.length === 0 ? <p>{quick.active.length && activeFeed.items.length ? "Nothing in this map area matches your quick filters. Turn one off or move the map." : "No matching listings in this map area. Move the map or clear your filters."}</p> : null}
      <ul className="flex flex-col gap-2.5">{feedItems?.slice(0, listCount).map((item, index) => {
        const id = feedItemId(item);
        const active = selected;
        return <FeedRow key={id} item={item} id={id} index={index} distance={distance(item.content.latitude, item.content.longitude)} selected={selected === id} previewed={previewed === id} dimmed={Boolean(active && active !== id)} onShowOnMap={select} onPreviewChange={setPreviewed} />;
      })}</ul>
      {listHasMore ? <div ref={listSentinel} aria-hidden="true" className="h-px w-full" /> : null}
    </div>} /></SavedSpecialsProvider></DiscoveryClock></PikoTipProvider>;
}
