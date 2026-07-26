"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { MarkerClusterer, SuperClusterAlgorithm, type Renderer } from "@googlemaps/markerclusterer";
import {
  APIProvider,
  APILoadingStatus,
  Map,
  AdvancedMarker,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { MapLoadingSkeleton } from "./discovery-loading";
import { Circle } from "./circle"; // Let's quickly create this wrapper or use Google Maps API directly.
import { ListingMarker } from "./mobile/listing-marker";
import { buildPlacePredictionRequest, type PlaceSuggestion } from "./search-suggestions";
import { buildQuickFilterCameraPlan } from "./lib/quick-filter-camera";
import {
  buildPlaceRecenterRequest,
  shouldRequestInitialUserLocation,
} from "./lib/search-recenter";
import { cn } from "@/lib/utils";
import type { PresenceBadge } from "@/features/presence/presence-status";
import {
  markerDisplayMode,
  resolveViewportContext,
  type MarkerDisplayMode,
  type ViewportContext,
} from "./lib/viewport-context";

type ListingPin = {
  id: string;
  title: string;
  area: string;
  price: string;
  fullPrice?: string;
  coordinates: { lat: number; lng: number };
  /** Optional thumbnail used by the rounded ListingMarker (Req 3.3). */
  imageUrl?: string | null;
  imageUrls?: string[] | null;
  bedrooms?: number | string | null;
  bathrooms?: number | string | null;
  createdAt?: string | null;
  availabilityDate?: string | null;
  landlordPresence?: PresenceBadge;
  liveTourId?: string | null;
  hasInstantViewing?: boolean;
};

type ViewportBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type ClusterPreviewPayload = {
  listingIds: string[];
  count: number;
  bounds: ViewportBounds;
};

type RecenterTarget = {
  lat: number;
  lng: number;
  /** Monotonic counter so repeated locate clicks to the same coords still trigger a recenter. */
  nonce: number;
};

export type MapViewProps = {
  apiKey?: string;
  mapId?: string;
  listings: ListingPin[];
  selectedListingId?: string;
  previewedListingId?: string;
  onSelectListing?: (listingId: string) => void;
  onPreviewListingChange?: (listingId?: string) => void;
  onViewListing?: (listingId: string) => void;
  onBoundsChange?: (bounds: ViewportBounds) => void;
  initialCenter?: { lat: number; lng: number };
  searchQuery?: string;
  searchPlaceId?: string;
  suggestionQuery?: string;
  mobileBottomPadding?: number;
  onViewportContextChange?: (context: ViewportContext) => void;
  onClusterPreview?: (preview: ClusterPreviewPayload) => void;
  onPlaceSuggestionsChange?: (suggestions: PlaceSuggestion[]) => void;
  children?: React.ReactNode;
  recenterTarget?: RecenterTarget | null;
  fitListingsRequest?: { nonce: number } | null;
  clusterFitRequest?: { bounds: ViewportBounds; nonce: number } | null;
  /**
   * When the full listing detail panel is open the map's InfoWindow becomes
   * pure duplication, so we suppress it to keep the map readable.
   */
  detailOpen?: boolean;
  /** Signals a structural desktop rail resize so the map can preserve its camera. */
  detailPanelExpanded?: boolean;
};

const defaultCenter = { lat: -26.2041, lng: 28.0473 };
const MAP_INSTANCE_ID = "roomza-discovery-map";
const FALLBACK_MAP_ID = "DEMO_MAP_ID";
const USER_CITY_ZOOM = 11;
const RECENTER_ZOOM = 14;

const clusterRenderer: Renderer = {
  render({ count, position }) {
    const content = document.createElement("button");
    content.type = "button";
    content.className = "pinpoint-map-cluster";
    content.textContent = String(count);
    content.setAttribute("aria-label", `Preview ${count} homes`);
    return new google.maps.marker.AdvancedMarkerElement({
      position,
      content,
      zIndex: 1_000 + count,
    });
  },
};

const ListingMarkerLayer = memo(function ListingMarkerLayer({
  listings,
  selectedListingId,
  previewedListingId,
  displayMode,
  onActivate,
  onPreviewChange,
  registerMarker,
}: {
  listings: ListingPin[];
  selectedListingId?: string;
  previewedListingId?: string;
  displayMode: MarkerDisplayMode;
  onActivate: (listingId: string) => void;
  onPreviewChange: (listingId?: string) => void;
  registerMarker: (listingId: string, marker: google.maps.marker.AdvancedMarkerElement | null) => void;
}) {
  type RenderedListing = { listing: ListingPin; phase: "entering" | "visible" | "exiting" };
  const [renderedListings, setRenderedListings] = useState<RenderedListing[]>(() => listings.map((listing) => ({ listing, phase: "entering" })));

  useEffect(() => {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let exitTimeoutId: number | undefined;
    let visibilityFrameId: number | undefined;
    const frameId = window.requestAnimationFrame(() => {
      if (reducedMotion) {
        setRenderedListings(listings.map((listing) => ({ listing, phase: "visible" as const })));
        return;
      }
      const nextIds = new Set(listings.map((listing) => listing.id));
      setRenderedListings((current) => {
        const currentIds = new Set(current.filter((entry) => entry.phase !== "exiting").map((entry) => entry.listing.id));
        return [
          ...listings.map((listing) => ({ listing, phase: currentIds.has(listing.id) ? "visible" as const : "entering" as const })),
          ...current.filter((entry) => !nextIds.has(entry.listing.id)).map((entry) => ({ ...entry, phase: "exiting" as const })),
        ];
      });
      visibilityFrameId = window.requestAnimationFrame(() => {
        setRenderedListings((current) => current.map((entry) => entry.phase === "entering" ? { ...entry, phase: "visible" } : entry));
      });
      exitTimeoutId = window.setTimeout(() => {
        setRenderedListings((current) => current.filter((entry) => entry.phase !== "exiting"));
      }, 280);
    });
    return () => {
      window.cancelAnimationFrame(frameId);
      if (visibilityFrameId !== undefined) window.cancelAnimationFrame(visibilityFrameId);
      if (exitTimeoutId !== undefined) window.clearTimeout(exitTimeoutId);
    };
  }, [listings]);

  return renderedListings.map(({ listing, phase }) => (
    <AdvancedMarker
      key={listing.id}
      ref={(marker) => registerMarker(listing.id, marker)}
      position={listing.coordinates}
    >
      <div className={cn("transition-[opacity,transform] duration-[280ms] ease-[var(--ease-out-expo)]", phase === "visible" ? "scale-100 opacity-100" : "scale-75 opacity-0", phase === "exiting" && "pointer-events-none")}>
        <ListingMarker
          title={listing.title}
          area={listing.area}
          price={listing.price}
          imageUrl={listing.imageUrl}
          selected={phase !== "exiting" && listing.id === selectedListingId}
          previewed={phase !== "exiting" && listing.id === previewedListingId}
          dimmed={Boolean(selectedListingId && listing.id !== selectedListingId)}
          displayMode={displayMode === "density" ? "dot" : "price"}
          liveState={
            listing.liveTourId
              ? "live-tour"
              : listing.hasInstantViewing
                ? "instant-viewing"
                : listing.landlordPresence === "available"
                  ? "available"
                  : "default"
          }
          onActivate={() => { if (phase !== "exiting") onActivate(listing.id); }}
          onPreviewChange={(previewed) => {
            if (phase !== "exiting") onPreviewChange(previewed ? listing.id : undefined);
          }}
        />
      </div>
    </AdvancedMarker>
  ));
});

function MapApiBoundary({ children }: { children: React.ReactNode }) {
  const status = useApiLoadingStatus();

  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div role="alert" className="flex h-full min-h-[520px] items-center justify-center bg-muted p-6">
        <div className="max-w-sm rounded-lg border border-status-error-border bg-status-error-surface p-4 text-sm text-status-error-text shadow-[var(--elevation-1)]">
          <p className="font-semibold">The map could not be loaded.</p>
          <p className="mt-1">Check your connection and refresh to try again.</p>
        </div>
      </div>
    );
  }

  if (status !== APILoadingStatus.LOADED) {
    return <MapLoadingSkeleton />;
  }

  return children;
}

function MapContent({
  mapId,
  listings,
  selectedListingId,
  previewedListingId,
  onSelectListing,
  onPreviewListingChange,
  onBoundsChange,
  initialCenter,
  searchQuery,
  searchPlaceId,
  suggestionQuery,
  mobileBottomPadding = 0,
  onViewportContextChange,
  onClusterPreview,
  onPlaceSuggestionsChange,
  recenterTarget,
  fitListingsRequest,
  clusterFitRequest,
  detailPanelExpanded,
}: Omit<MapViewProps, "apiKey">) {
  const map = useMap(MAP_INSTANCE_ID);
  const geocodingLib = useMapsLibrary("geocoding");
  const placesLib = useMapsLibrary("places");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const geocodeSequenceRef = useRef(0);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const markerInstancesRef = useRef(new globalThis.Map<string, google.maps.marker.AdvancedMarkerElement>());
  const markerListingIdsRef = useRef(new WeakMap<object, string>());
  const clusterFrameRef = useRef<number | null>(null);
  const mobileBottomPaddingRef = useRef(mobileBottomPadding);
  const hasEvaluatedInitialUserCenterRef = useRef(false);
  const [displayMode, setDisplayMode] = useState<MarkerDisplayMode>("density");
  useEffect(() => {
    mobileBottomPaddingRef.current = mobileBottomPadding;
  }, [mobileBottomPadding]);

  useEffect(() => {
    if (!map) return;

    const center = map.getCenter();
    const frame = window.requestAnimationFrame(() => {
      google.maps.event.trigger(map, "resize");
      if (center) map.setCenter(center);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [detailPanelExpanded, map]);
  const isDesktop = useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia("(min-width: 1024px)");
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => true,
  );

  const handleActivateListing = useCallback(
    (listingId: string) => {
      onSelectListing?.(listingId);
    },
    [onSelectListing],
  );
  const handlePreviewListing = useCallback(
    (listingId?: string) => onPreviewListingChange?.(listingId),
    [onPreviewListingChange],
  );
  const geocoder = useMemo(
    () => geocodingLib ? new geocodingLib.Geocoder() : null,
    [geocodingLib],
  );

  const scheduleClusterRender = useCallback(() => {
    if (clusterFrameRef.current !== null) return;
    clusterFrameRef.current = window.requestAnimationFrame(() => {
      clusterFrameRef.current = null;
      clustererRef.current?.render();
    });
  }, []);

  const registerMarker = useCallback((listingId: string, marker: google.maps.marker.AdvancedMarkerElement | null) => {
    const previous = markerInstancesRef.current.get(listingId);
    if (previous === marker) return;
    if (previous) {
      clustererRef.current?.removeMarker(previous, true);
      markerInstancesRef.current.delete(listingId);
    }
    if (marker) {
      markerInstancesRef.current.set(listingId, marker);
      markerListingIdsRef.current.set(marker, listingId);
      clustererRef.current?.addMarker(marker, true);
    }
    scheduleClusterRender();
  }, [scheduleClusterRender]);

  useEffect(() => {
    if (!map) return;
    if (displayMode === "prices") {
      // At street-level zooms the map is intentionally unclustered. The
      // clusterer removes individual markers from the map while grouping, so
      // explicitly restore each Advanced Marker when crossing into price mode.
      markerInstancesRef.current.forEach((marker) => {
        marker.map = map;
      });
      return;
    }

    const clusterer = new MarkerClusterer({
      map,
      markers: [...markerInstancesRef.current.values()],
      algorithm: new SuperClusterAlgorithm({ radius: 72, maxZoom: 20 }),
      renderer: clusterRenderer,
      onClusterClick: (_event, cluster, activeMap) => {
        if (!cluster.bounds) return;
        onSelectListing?.("");
        const listingIds = cluster.markers
          .map((marker) => markerListingIdsRef.current.get(marker as object))
          .filter((listingId): listingId is string => Boolean(listingId));
        const northEast = cluster.bounds.getNorthEast();
        const southWest = cluster.bounds.getSouthWest();
        const bounds = {
          west: southWest.lng(),
          south: southWest.lat(),
          east: northEast.lng(),
          north: northEast.lat(),
        };
        if (onClusterPreview) {
          onClusterPreview({
            listingIds,
            count: cluster.count,
            bounds,
          });
          return;
        }
        activeMap.fitBounds(cluster.bounds, isDesktop
          ? { top: 64, right: 56, bottom: 64, left: 500 }
          : { top: 120, right: 40, bottom: Math.max(240, mobileBottomPaddingRef.current + 32), left: 40 });
      },
    });
    clustererRef.current = clusterer;
    return () => {
      if (clusterFrameRef.current !== null) window.cancelAnimationFrame(clusterFrameRef.current);
      clusterer.clearMarkers();
      clusterer.setMap(null);
      clustererRef.current = null;
    };
  }, [displayMode, isDesktop, map, onClusterPreview, onSelectListing]);

  const center = useMemo(
    () => initialCenter ?? defaultCenter,
    [initialCenter],
  );

  const handleCameraChanged = useCallback(
    (event: { detail: { bounds: { south: number; west: number; north: number; east: number }, center: { lat: number; lng: number }, zoom?: number } }) => {
      const zoom = Math.round(event.detail.zoom ?? map?.getZoom() ?? 11);
      // Invalidate an outstanding geocoder response as soon as the camera
      // moves, not only when the next debounced request begins.
      const sequence = ++geocodeSequenceRef.current;
      setDisplayMode((current) => {
        const next = markerDisplayMode(zoom);
        return current === next ? current : next;
      });
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        const b = event.detail.bounds;
        onBoundsChange?.({
          west: b.west,
          south: b.south,
          east: b.east,
          north: b.north,
        });

        if (onViewportContextChange && geocoder && event.detail.center) {
          const c = event.detail.center;
          geocoder.geocode({ location: { lat: c.lat, lng: c.lng } }, (results, status) => {
            if (sequence !== geocodeSequenceRef.current) return;
            if (status === "OK" && results?.[0]) {
              onViewportContextChange(resolveViewportContext(zoom, results[0].address_components));
              return;
            }
            onViewportContextChange(resolveViewportContext(zoom, []));
          });
        } else {
          onViewportContextChange?.(resolveViewportContext(zoom, []));
        }
      }, 250);
    },
    [geocoder, map, onBoundsChange, onViewportContextChange],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      geocodeSequenceRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const request = buildPlaceRecenterRequest(searchPlaceId);
    if (!geocoder || !map || !request) return;

    geocoder.geocode(request, (results, status) => {
      if (status === "OK" && results?.[0]) {
        map.fitBounds(results[0].geometry.viewport);
      }
    });
  }, [geocoder, map, searchPlaceId]);

  useEffect(() => {
    const query = suggestionQuery?.trim() ?? "";
    if (!onPlaceSuggestionsChange) return;
    if (!placesLib || query.length < 2) {
      onPlaceSuggestionsChange([]);
      return;
    }

    let active = true;
    const timeoutId = window.setTimeout(() => {
      const sessionToken = new placesLib.AutocompleteSessionToken();
      placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        ...buildPlacePredictionRequest(query, map?.getBounds()),
        sessionToken,
      })
        .then(({ suggestions }) => {
          if (!active) return;
          onPlaceSuggestionsChange(
            suggestions.flatMap((suggestion) => {
              const prediction = suggestion.placePrediction;
              if (!prediction) return [];
              return [{
                placeId: prediction.placeId,
                label: prediction.mainText?.toString() || prediction.text.toString(),
                secondaryLabel: prediction.secondaryText?.toString() || undefined,
              }];
            }).slice(0, 6),
          );
        })
        .catch(() => {
          if (active) onPlaceSuggestionsChange([]);
        });
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [map, onPlaceSuggestionsChange, placesLib, suggestionQuery]);

  useEffect(() => {
    if (
      !map ||
      hasEvaluatedInitialUserCenterRef.current
    ) {
      return;
    }

    hasEvaluatedInitialUserCenterRef.current = true;
    if (
      !shouldRequestInitialUserLocation({ initialCenter, searchQuery, selectedListingId }) ||
      typeof navigator === "undefined" ||
      !("geolocation" in navigator)
    ) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        map.panTo({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        map.setZoom(USER_CITY_ZOOM);
      },
      () => {
        // Keep the default South Africa view when location access is unavailable.
      },
      {
        enableHighAccuracy: false,
        maximumAge: 10 * 60 * 1000,
        timeout: 6000,
      },
    );
  }, [initialCenter, map, searchQuery, selectedListingId]);

  useEffect(() => {
    if (!map || !selectedListingId) return;

    const selected = listings.find((l) => l.id === selectedListingId);
    if (!selected) return;

    map.panTo(selected.coordinates);
    const currentZoom = map.getZoom() ?? 11;
    if (currentZoom < 12) {
      map.setZoom(12);
    }
    if (!isDesktop && mobileBottomPaddingRef.current > 0) {
      window.requestAnimationFrame(() => map.panBy(0, Math.min(180, mobileBottomPaddingRef.current * 0.35)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop, map, selectedListingId]);

  // Recenter the map on an explicit target (e.g. the Locate_Button result).
  // Keyed on the nonce so repeated requests to the same coords still pan.
  useEffect(() => {
    if (!map || !recenterTarget) return;

    map.panTo({ lat: recenterTarget.lat, lng: recenterTarget.lng });
    map.setZoom(RECENTER_ZOOM);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, recenterTarget?.nonce]);

  useEffect(() => {
    if (!map || !fitListingsRequest) return;
    const plan = buildQuickFilterCameraPlan(listings, isDesktop, mobileBottomPaddingRef.current);
    if (plan.kind === "none") return;
    if (plan.kind === "single") {
      map.panTo(plan.target);
      map.setZoom(plan.zoom);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    plan.targets.forEach((target) => bounds.extend(target));
    map.fitBounds(bounds, plan.padding);
    // This is intentionally keyed only to the one-shot request nonce. Later
    // viewport refreshes must not override user-driven camera movement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitListingsRequest?.nonce, map]);

  useEffect(() => {
    if (!map || !clusterFitRequest) return;
    map.fitBounds(clusterFitRequest.bounds, isDesktop
      ? { top: 64, right: 56, bottom: 64, left: 500 }
      : { top: 120, right: 40, bottom: Math.max(240, mobileBottomPaddingRef.current + 32), left: 40 });
  }, [clusterFitRequest, isDesktop, map]);

  return (
    <Map
      id={MAP_INSTANCE_ID}
      defaultCenter={center}
      defaultZoom={initialCenter ? 14 : 11}
      mapId={mapId || FALLBACK_MAP_ID}
      gestureHandling="greedy"
      disableDefaultUI
      zoomControl={false}
      onCameraChanged={handleCameraChanged}
      className="h-full w-full"
    >
      <ListingMarkerLayer
        listings={listings}
        selectedListingId={selectedListingId}
        previewedListingId={previewedListingId}
        displayMode={displayMode}
        onActivate={handleActivateListing}
        onPreviewChange={handlePreviewListing}
        registerMarker={registerMarker}
      />
      {/* Render 800m Walkability Circle for Selected Listing */}
      {selectedListingId && map && (
        <Circle
          radius={800}
          center={listings.find((l) => l.id === selectedListingId)?.coordinates || center}
          strokeColor="var(--forest)"
          strokeOpacity={0.8}
          strokeWeight={2}
          fillColor="var(--forest)"
          fillOpacity={0.1}
        />
      )}

      {/* InfoWindow for selected listing (Desktop only). Hidden while the full
          detail panel is open — the panel already shows every detail, so the
          popup would just duplicate it and cover the map. */}
    </Map>
  );
}

/**
 * MapInfoCardContent — the card rendered inside the Google Maps InfoWindow.
 *
 * Uses the compact {@link PropertyCard} variant so the popup stays light over
 * the map: a smaller thumbnail, price pill, title, beds/baths and address. The
 * richer full-width card is reserved for the left-hand listings panel.
 */
export function MapView({
  apiKey,
  mapId,
  listings,
  selectedListingId,
  previewedListingId,
  onSelectListing,
  onPreviewListingChange,
  onViewListing,
  onBoundsChange,
  initialCenter,
  searchQuery,
  searchPlaceId,
  suggestionQuery,
  mobileBottomPadding,
  onViewportContextChange,
  onClusterPreview,
  onPlaceSuggestionsChange,
  recenterTarget,
  fitListingsRequest,
  clusterFitRequest,
  detailOpen,
  detailPanelExpanded,
  children,
}: MapViewProps) {
  if (!apiKey) {
    return (
      <div className="flex h-full min-h-[520px] items-center justify-center bg-accent p-6">
        <div className="max-w-sm rounded-lg border border-border bg-panel p-4 text-sm shadow-[var(--elevation-1)]">
          <p className="font-semibold text-forest">Google Maps API key required</p>
          <p className="mt-2 text-muted-foreground">
            Add <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to load the live Pinpoints map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[520px]">
      <APIProvider apiKey={apiKey} libraries={["geocoding", "places"]}>
        <MapApiBoundary>
          <MapContent
            mapId={mapId}
            listings={listings}
            selectedListingId={selectedListingId}
            previewedListingId={previewedListingId}
            onSelectListing={onSelectListing}
            onPreviewListingChange={onPreviewListingChange}
            onViewListing={onViewListing}
            onBoundsChange={onBoundsChange}
            initialCenter={initialCenter}
            searchQuery={searchQuery}
            searchPlaceId={searchPlaceId}
            suggestionQuery={suggestionQuery}
            mobileBottomPadding={mobileBottomPadding}
            onViewportContextChange={onViewportContextChange}
            onClusterPreview={onClusterPreview}
            onPlaceSuggestionsChange={onPlaceSuggestionsChange}
            recenterTarget={recenterTarget}
            fitListingsRequest={fitListingsRequest}
            clusterFitRequest={clusterFitRequest}
            detailOpen={detailOpen}
            detailPanelExpanded={detailPanelExpanded}
          />
        </MapApiBoundary>
        {children}
      </APIProvider>
    </div>
  );
}
