"use client";
import Link from "next/link";
import { useDiscoveryControls } from "@/features/discovery/url-controls";
import { DiscoveryLocationAction } from "@/features/discovery/location-action";
import { ServiceFeedCard } from "@/features/services/service-feed-card";
import { observeDiscoveryRefresh } from "@/features/discovery/refresh";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import {
  discoveryCategoryHref,
  DiscoverySortPills,
  PinpointHeader,
} from "@/components/navigation/pinpoint-header";
import { DiscoveryShell } from "@/features/discovery/discovery-shell";
import { DiscoveryMapLoader } from "@/features/discovery/discovery-map-loader";
import { LocationSelector } from "@/features/map-discovery/location-selector";
import { haversineKm } from "@/features/map-discovery/lib/distance";
import type { DiscoveryPlace } from "@/features/places/place";
import {
  serviceFeedSchema,
  serviceTypes,
  type ServiceFeed,
} from "@/features/services/schema";
export function ServicesDiscovery(props: Parameters<typeof ServicesDiscoveryContent>[0]) {
  return <ServicesDiscoveryContent key={(props.areaId ?? "none") + ":" + (props.page ?? 1) + ":" + String(props.invalid ?? false)} {...props} />;
}

function ServicesDiscoveryContent({
  areaId,
  area,
  mapApiKey,
  page = 1,
  invalid = false,
}: {
  areaId: string | null;
  area: string | null;
  view?: "feed" | "map";
  mapApiKey?: string;
  page?: number;
  invalid?: boolean;
}) {
  const view = "map";
  const router = useRouter();
  const [place, setPlace] = useState<DiscoveryPlace | null>(null);
  const [feed, setFeed] = useState<ServiceFeed | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(Boolean(areaId));
  const [retry, setRetry] = useState(0);
  const { query, setQuery, type, setType, sort, setSort, withControls } = useDiscoveryControls(["Latest", "Nearest"], ["All services", ...serviceTypes]);
  const [selectedId, setSelectedId] = useState<string>();
  useEffect(() => {
    if (!areaId) return;
    let request: AbortController | undefined;
    let disposed = false;
    const refresh = async () => {
      request?.abort();
      request = new AbortController();
      const controller = request;
      setLoading(true);
      try {
        const [placeResponse, response] = await Promise.all([
          fetch("/api/places/" + areaId, { signal: controller.signal }),
          fetch(
            "/api/services?" +
              new URLSearchParams({ areaId, page: String(page) }),
            { cache: "no-store", signal: controller.signal },
          ),
        ]);
        if (!response.ok || !placeResponse.ok)
          throw new Error("Services unavailable");
        const nextPlace = (await placeResponse.json()).data
          .place as DiscoveryPlace;
        const nextFeed = serviceFeedSchema.parse(await response.json());
        if (nextFeed.areaId !== areaId || nextPlace.id !== areaId)
          throw new Error("Wrong services area");
        if (disposed || controller.signal.aborted) return;
        setPlace(nextPlace);
        setFeed(nextFeed);
        setError(false);
        setLoading(false);
      } catch {
        if (disposed || controller.signal.aborted) return;
        setError(true);
        setLoading(false);
      }
    };
    void refresh();
    const stopRefresh = observeDiscoveryRefresh(refresh);
    return () => {
      disposed = true;
      request?.abort();
      stopRefresh();
    };
  }, [areaId, page, retry]);
  const items = useMemo(
    () =>
      (feed?.items ?? [])
        .filter(
          (item) =>
            (type === "All services" || item.content.serviceType === type) &&
            [
              item.content.title,
              item.content.providerName,
              item.content.description,
            ].some((text) =>
              text
                .toLocaleLowerCase()
                .includes(query.trim().toLocaleLowerCase()),
            ),
        )
        .sort((a, b) =>
          sort === "Nearest" && place
            ? haversineKm(place.center, {
                lat: a.content.latitude,
                lng: a.content.longitude,
              }) -
              haversineKm(place.center, {
                lat: b.content.latitude,
                lng: b.content.longitude,
              })
            : Date.parse(b.approved_at) - Date.parse(a.approved_at),
        ),
    [feed, type, query, sort, place],
  );
  const points = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        title: item.content.providerName,
        latitude: item.content.latitude,
        longitude: item.content.longitude,
      })),
    [items],
  );
  const select = (id: string) => {
    setSelectedId(id);
    document
      .getElementById("service-" + id)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  const href = (nextView: "feed" | "map" = view, nextPage = page) =>
    withControls(discoveryCategoryHref(
      "services",
      areaId,
      place?.fullAddress ?? area,
      nextView,
    ) + (nextPage > 1 ? "&page=" + nextPage : ""));
  return (
    <DiscoveryShell
      onboarding={!areaId}
      view={view}
      resultsLabel="Services near the map"
      header={
        <PinpointHeader
          category="services"
          view={view}
          areaId={areaId}
          area={place?.fullAddress ?? area}
          count={!loading && !error ? feed?.totalCount : undefined}
          location={
            <LocationSelector
              idPrefix="services"
              selectedLocation={place?.label ?? area?.split(",")[0]}
              onSelect={(next) =>
                router.push(
                  withControls(discoveryCategoryHref(
                    "services",
                    next.id,
                    next.fullAddress,
                    view,
                  )),
                )
              }
            />
          }
          searchHint="Filter this page"
          searchActive={Boolean(query)}
          search={(
            <form role="search" onSubmit={(event) => event.preventDefault()}>
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                aria-label="Search services on this page"
                placeholder="Search plumbers, cleaners…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="bg-transparent outline-none"
              />
              {query ? (
                <button
                  type="button"
                  aria-label="Clear services search"
                  className="flex size-11 shrink-0 items-center justify-center"
                  onClick={() => setQuery("")}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              ) : null}
            </form>
          )}
          toolbar={(
            <>
              <label className="text-sm">
                <span className="sr-only">Service type</span>
                <select
                  aria-label="Service type"
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  className="min-h-11 max-w-40 rounded-full border border-border bg-panel px-3"
                >
                  <option>All services</option>
                  {serviceTypes.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <DiscoverySortPills
                options={["Latest", "Nearest"]}
                value={sort}
                onChange={setSort}
              />
            </>
          )}
        />
      }
      map={
        <DiscoveryMapLoader
          mapApiKey={mapApiKey}
          place={place}
          points={points}
          onSelect={select}
          selectedId={
            points.some((point) => point.id === selectedId)
              ? selectedId
              : undefined
          }
          categoryLabel="Services"
        />
      }
      results={
        <div className="space-y-5 px-5 py-6">
          <header>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-forest">
              The best of what’s nearby
            </p>
            <h1 className="text-2xl font-semibold">
              Services{place ? " in " + place.label : " nearby"}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Find local providers, see their location and contact them.
            </p>
          </header>
          {!areaId ? (
            <div className="space-y-4"><p className="text-sm text-muted-foreground">
              {invalid
                ? "This location or page link is unavailable. Choose another location."
                : "Choose a location to see local services."}
            </p><DiscoveryLocationAction idPrefix="services" /></div>
          ) : (
            <>
              <p role="status" className="text-sm">
                {loading
                  ? "Checking services…"
                  : error
                    ? "Services could not be checked."
                    : `${feed?.totalCount ?? 0} ${(feed?.totalCount ?? 0) === 1 ? "service" : "services"} · ${items.length} shown on this page`}
              </p>
              <button
                type="button"
                onClick={() => setRetry(retry + 1)}
                disabled={loading}
                className="min-h-11 rounded-full border border-border bg-panel px-4 text-sm font-semibold disabled:opacity-50"
              >
                Refresh services
              </button>
              {error ? (
                <p role="alert">
                  Could not load services. Refresh or choose another location.
                </p>
              ) : feed && !feed.items.length ? (
                <div className="space-y-3"><p className="text-sm text-muted-foreground">
                  {page > 1
                    ? "No more services on this page."
                    : "No local services in this area yet."}
                </p><DiscoveryLocationAction idPrefix="services">Choose another location</DiscoveryLocationAction></div>
              ) : feed ? (
                <>
                  {feed.hasNext || page > 1 ? (
                    <p className="text-xs text-muted-foreground">
                      Search and filters apply to this page.
                    </p>
                  ) : null}
                  {sort === "Nearest" ? (
                    <p className="text-xs text-muted-foreground">
                      Nearest to the selected location’s centre.
                    </p>
                  ) : null}
                  {items.length === 0 ? (
                    <div className="space-y-3"><p role="status">No services match these filters.</p><button type="button" onClick={() => { setQuery(""); setType("All services"); }} className="min-h-11 rounded-full border border-border bg-panel px-4 text-sm font-semibold text-forest">Clear search and service type</button></div>
                  ) : null}
                  <ul className="space-y-4">
                    {items.map((item) => (
                      <li id={"service-" + item.id} key={item.id}>
                        <ServiceFeedCard
                          item={item}
                          selected={selectedId === item.id}
                          onShowOnMap={view === "map" ? () => select(item.id) : undefined}
                        />
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              <nav
                aria-label="Services pages"
                className="flex gap-5 text-sm text-forest"
              >
                {page > 1 ? (
                  <Link
                    href={href(view, page - 1)}
                    className="inline-flex min-h-11 items-center underline"
                  >
                    Previous services
                  </Link>
                ) : null}
                {feed?.hasNext ? (
                  <Link
                    href={href(view, page + 1)}
                    className="inline-flex min-h-11 items-center underline"
                  >
                    Next services
                  </Link>
                ) : null}
              </nav>
            </>
          )}
        </div>
      }
    />
  );
}
