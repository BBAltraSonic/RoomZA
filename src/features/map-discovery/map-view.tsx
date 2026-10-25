"use client";
import { useRouter } from "next/navigation";
import { authPathForRedirect } from "@/lib/redirects";

import { ContactActions } from "@/features/guest-contact/contact-actions";
import type { PublicContact } from "@/features/guest-contact/schema";


import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import MapLibreMap, {
  Layer,
  Marker,
  Popup,
  Source,
  type MapRef,
  type ViewStateChangeEvent,
} from "react-map-gl/maplibre";
import Supercluster from "supercluster";
import mapLibrePackage from "maplibre-gl/package.json";
const mapLibreVersion = mapLibrePackage.version;
import {
  ArrowRight,
  Armchair,
  Bath,
  BedDouble,
  CarFront,
  Heart,
  MessageSquare,
  Share2,
  X,
} from "lucide-react";

import { isNewListing } from "@/features/listings/listing-freshness";
import type { PresenceBadge } from "@/features/presence/presence-status";
import {
  selectLandlordTrustSignals,
  type LandlordTrustSummary,
} from "@/features/trust/landlord-signals";
import {
  getMapTilerStyleUrl,
  reverseGeocode,
} from "@/lib/maptiler";
import { cn } from "@/lib/utils";

import { MapLoadingSkeleton } from "./discovery-loading";
import { useFavorites } from "./hooks/use-favorites";
import { buildExternalDirectionsUrl } from "./lib/external-directions";
import { buildListingShareUrl, shareListing } from "./lib/listing-share";
import {
  boundsFromPoints,
  createRadiusFeature,
  toMapBounds,
} from "./lib/map-geometry";
import { buildQuickFilterCameraPlan, discoveryCameraPadding } from "./lib/quick-filter-camera";
import { shouldRequestInitialUserLocation } from "./lib/search-recenter";
import type { GeoPoint, MapSearchTarget, ViewportBounds } from "./lib/types";
import {
  markerDisplayMode,
  resolveLocationViewportContext,
  type ViewportContext,
} from "./lib/viewport-context";
import { MapControls } from "./map-controls";
import { ListingMarker } from "./mobile/listing-marker";

type ListingPin = {
  publicContact?: PublicContact | null;
  id: string;
  title: string;
  area: string;
  price: string;
  fullPrice?: string;
  coordinates: GeoPoint;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
  bedrooms?: number | string | null;
  bathrooms?: number | string | null;
  createdAt?: string | null;
  availabilityDate?: string | null;
  listingType?: "rent" | "sale";
  parkingCount?: number | null;
  propertyType?: string | null;
  furnished?: boolean;
  landlordTrust?: LandlordTrustSummary | null;
  landlordPresence?: PresenceBadge;
  liveTourId?: string | null;
  hasInstantViewing?: boolean;
};

export type ClusterPreviewPayload = {
  listingIds: string[];
  count: number;
  bounds: ViewportBounds;
};

type RecenterTarget = GeoPoint & {
  nonce: number;
};

export type MapViewProps = {
  mapApiKey?: string;
  listings: ListingPin[];
  selectedListingId?: string;
  previewedListingId?: string;
  onSelectListing?: (listingId: string) => void;
  onPreviewListingChange?: (listingId?: string) => void;
  onViewListing?: (listingId: string) => void;
  onBoundsChange?: (bounds: ViewportBounds) => void;
  initialCenter?: GeoPoint;
  searchQuery?: string;
  searchTarget?: MapSearchTarget | null;
  mobileBottomPadding?: number;
  onViewportContextChange?: (context: ViewportContext) => void;
  onClusterPreview?: (preview: ClusterPreviewPayload) => void;
  children?: React.ReactNode;
  recenterTarget?: RecenterTarget | null;
  fitListingsRequest?: { nonce: number } | null;
  clusterFitRequest?: { bounds: ViewportBounds; nonce: number } | null;
  detailOpen?: boolean;
  detailPanelExpanded?: boolean;
};

type ListingPointProperties = {
  listingId: string;
};

const DEFAULT_CENTER = { lat: -26.2041, lng: 28.0473 };
const USER_CITY_ZOOM = 11;
const RECENTER_ZOOM = 14;
const WORLD_BOUNDS: ViewportBounds = { west: -180, south: -85, east: 180, north: 85 };

function isDesktopSubscribe(onChange: () => void) {
  const media = window.matchMedia("(min-width: 1024px)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function mapBounds(map: MapRef): ViewportBounds {
  const bounds = map.getBounds();
  if (!bounds) return WORLD_BOUNDS;
  return {
    west: bounds.getWest(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    north: bounds.getNorth(),
  };
}

function PropertyMapPreview({
  listing,
  onClose,
  onView,
}: {
  listing: ListingPin;
  onClose: () => void;
  onView: () => void;
}) {
  const [shareStatus, setShareStatus] = useState("");
  const { isFavorite, toggleFavorite, authenticated } = useFavorites();
  const router = useRouter();
  const saved = isFavorite(listing.id);
  const trustSignals = selectLandlordTrustSignals(listing.landlordTrust);
  const verifiedSignal = trustSignals.find((signal) => signal.kind !== "response_time");
  const responseSignal = trustSignals.find((signal) => signal.kind === "response_time");
  const availabilityLabel = (() => {
    if (!listing.availabilityDate) return null;
    const date = new Date(listing.availabilityDate);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "short" }).format(date);
  })();

  const handleShare = async () => {
    const outcome = await shareListing({
      title: listing.title,
      text: listing.area,
      url: buildListingShareUrl(window.location.origin, listing.id),
    });
    setShareStatus(
      outcome === "shared"
        ? "Property shared"
        : outcome === "copied"
          ? "Property link copied"
          : outcome === "manual-copy-required"
            ? "Copy this property from its details page"
            : "",
    );
  };

  const handleMessage = () => {
    const path = `/listing/${encodeURIComponent(listing.id)}?intent=message`;
    router.push(authenticated ? path : authPathForRedirect(path));
  };

  return (
    <article className="w-[min(20rem,calc(100vw-3rem))] bg-panel text-ink">
      <div className="relative aspect-[16/7.2] w-full overflow-hidden bg-muted">
        {listing.imageUrl ? (
          <Image
            src={listing.imageUrl}
            alt={`${listing.title} in ${listing.area}`}
            fill
            sizes="320px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-muted text-sm font-medium text-muted-foreground">
            Photo coming soon
          </div>
        )}
        {isNewListing(listing.createdAt) ? (
          <span className="absolute left-3 top-3 rounded-full bg-forest px-2.5 py-1 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-primary-foreground shadow-[var(--elevation-1)]">
            New
          </span>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close property preview"
          className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full border border-border/60 bg-panel/95 text-ink shadow-[var(--elevation-1)] hover:bg-panel hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="px-4 pb-2.5 pt-3">
        <div className="min-w-0">
          <p className="flex items-baseline gap-1 text-lg font-extrabold tracking-tight text-forest">
            {listing.fullPrice ?? listing.price}
            {listing.listingType !== "sale" ? (
              <span className="text-[0.6875rem] font-medium tracking-normal text-muted-foreground">/ month</span>
            ) : null}
          </p>
          <h2 className="mt-0.5 truncate text-[0.9375rem] font-bold">{listing.title}</h2>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{listing.area}</p>
        </div>

        {verifiedSignal || responseSignal || listing.landlordPresence === "available" || listing.hasInstantViewing || availabilityLabel ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {verifiedSignal ? (
              <span className="rounded-full bg-forest/10 px-1.5 py-0.5 text-[0.625rem] font-semibold text-forest">
                {verifiedSignal.label}
              </span>
            ) : null}
            {responseSignal ? (
              <span className="rounded-full bg-forest/10 px-1.5 py-0.5 text-[0.625rem] font-semibold text-forest">
                {responseSignal.label}
              </span>
            ) : null}
            {listing.landlordPresence === "available" ? (
              <span className="rounded-full bg-forest/10 px-1.5 py-0.5 text-[0.625rem] font-semibold text-forest">
                Available now
              </span>
            ) : listing.hasInstantViewing ? (
              <span className="rounded-full bg-forest/10 px-1.5 py-0.5 text-[0.625rem] font-semibold text-forest">
                Instant viewing
              </span>
            ) : availabilityLabel ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.625rem] font-semibold text-muted-foreground">
                From {availabilityLabel}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-border/60 py-2 text-xs text-muted-foreground">
          {listing.bedrooms != null ? (
            <span className="inline-flex items-center gap-1.5">
              <BedDouble className="size-3.5" aria-hidden="true" />
              {listing.bedrooms} bed
            </span>
          ) : null}
          {listing.bathrooms != null ? (
            <span className="inline-flex items-center gap-1.5">
              <Bath className="size-3.5" aria-hidden="true" />
              {listing.bathrooms} bath
            </span>
          ) : null}
          {listing.parkingCount ? (
            <span className="inline-flex items-center gap-1.5">
              <CarFront className="size-3.5" aria-hidden="true" />
              {listing.parkingCount} parking
            </span>
          ) : null}
          {listing.furnished ? (
            <span className="inline-flex items-center gap-1.5">
              <Armchair className="size-3.5" aria-hidden="true" />
              Furnished
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onView}
          className="mt-2.5 flex min-h-10 w-full items-center justify-center rounded-full bg-forest px-4 text-sm font-semibold text-primary-foreground shadow-[var(--elevation-1)] hover:bg-forest/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View details
        </button>

        <ContactActions contact={listing.publicContact} title={listing.title} />
        <div className="mt-1.5 grid grid-cols-4 gap-1" aria-label="Property actions">
          <button
            type="button"
            onClick={() => {
              void toggleFavorite(listing.id, { listingType: listing.listingType ?? "rent" });
            }}
            aria-pressed={saved}
            className="flex min-h-10 flex-col items-center justify-center gap-1 rounded-lg text-[0.625rem] font-semibold text-muted-foreground hover:bg-warm-surface hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Heart className={cn("size-4", saved && "fill-selection text-brand-ink")} aria-hidden="true" />
            {saved ? "Saved" : "Save"}
          </button>
          <button
            type="button"
            onClick={handleMessage}
            className="flex min-h-10 flex-col items-center justify-center gap-1 rounded-lg text-[0.625rem] font-semibold text-muted-foreground hover:bg-warm-surface hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MessageSquare className="size-4" aria-hidden="true" />
            {authenticated ? "Message" : "Sign in to chat"}
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex min-h-10 flex-col items-center justify-center gap-1 rounded-lg text-[0.625rem] font-semibold text-muted-foreground hover:bg-warm-surface hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Share2 className="size-4" aria-hidden="true" />
            Share
          </button>
          <button
            type="button"
            onClick={onView}
            className="flex min-h-10 flex-col items-center justify-center gap-1 rounded-lg text-[0.625rem] font-semibold text-muted-foreground hover:bg-warm-surface hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowRight className="size-4" aria-hidden="true" />
            Details
          </button>
        </div>
        <p className="sr-only" role="status" aria-live="polite">{shareStatus}</p>
      </div>
    </article>
  );
}

export function MapView({
  mapApiKey,
  listings,
  selectedListingId,
  previewedListingId,
  onSelectListing,
  onPreviewListingChange,
  onViewListing,
  onBoundsChange,
  initialCenter,
  searchQuery,
  searchTarget,
  mobileBottomPadding = 0,
  onViewportContextChange,
  onClusterPreview,
  recenterTarget,
  fitListingsRequest,
  clusterFitRequest,
  detailOpen,
  detailPanelExpanded,
  children,
}: MapViewProps) {
  const mapRef = useRef<MapRef | null>(null);
  const cameraDebounceRef = useRef<number | null>(null);
  const reverseControllerRef = useRef<AbortController | null>(null);
  const hasEvaluatedInitialUserCenterRef = useRef(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [zoom, setZoom] = useState(initialCenter ? 14 : 11);
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds>(WORLD_BOUNDS);
  const isDesktop = useSyncExternalStore(isDesktopSubscribe, () => window.matchMedia("(min-width: 1024px)").matches, () => true);
  const mapStyle = useMemo(
    () => mapApiKey ? getMapTilerStyleUrl(mapApiKey, true) : null,
    [mapApiKey],
  );


  const listingById = useMemo(
    () => new globalThis.Map(listings.map((listing) => [listing.id, listing])),
    [listings],
  );
  const selectedListing = selectedListingId ? listingById.get(selectedListingId) : undefined;

  const clusterIndex = useMemo(() => {
    const index = new Supercluster<ListingPointProperties, Record<string, never>>({
      radius: 72,
      maxZoom: 14,
    });
    index.load(listings.map((listing) => ({
      type: "Feature",
      properties: { listingId: listing.id },
      geometry: {
        type: "Point",
        coordinates: [listing.coordinates.lng, listing.coordinates.lat],
      },
    })));
    return index;
  }, [listings]);

  const displayMode = markerDisplayMode(Math.round(zoom));
  const clusteredFeatures = useMemo(
    () => displayMode === "density"
      ? clusterIndex.getClusters(
        [viewportBounds.west, viewportBounds.south, viewportBounds.east, viewportBounds.north],
        Math.min(14, Math.max(0, Math.floor(zoom))),
      )
      : [],
    [clusterIndex, displayMode, viewportBounds, zoom],
  );
  const selectedRadius = useMemo(
    () => selectedListing ? createRadiusFeature(selectedListing.coordinates, 800) : null,
    [selectedListing],
  );

  const emitCameraState = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const nextBounds = mapBounds(map);
    const nextCenter = map.getCenter();
    const nextZoom = map.getZoom();
    setViewportBounds(nextBounds);
    setZoom(nextZoom);

    if (cameraDebounceRef.current) window.clearTimeout(cameraDebounceRef.current);
    cameraDebounceRef.current = window.setTimeout(() => {
      onBoundsChange?.(nextBounds);
      if (!onViewportContextChange || !mapApiKey) {
        onViewportContextChange?.(resolveLocationViewportContext(Math.round(nextZoom)));
        return;
      }

      reverseControllerRef.current?.abort();
      const controller = new AbortController();
      reverseControllerRef.current = controller;
      reverseGeocode({
        apiKey: mapApiKey,
        coordinates: { lat: nextCenter.lat, lng: nextCenter.lng },
        signal: controller.signal,
      }).then((features) => {
        onViewportContextChange(resolveLocationViewportContext(Math.round(nextZoom), features[0]));
      }).catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        onViewportContextChange(resolveLocationViewportContext(Math.round(nextZoom)));
      });
    }, 250);
  }, [mapApiKey, onBoundsChange, onViewportContextChange]);

  useEffect(() => () => {
    if (cameraDebounceRef.current) window.clearTimeout(cameraDebounceRef.current);
    reverseControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const frame = window.requestAnimationFrame(() => {
      map.resize();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [detailPanelExpanded, mapLoaded]);

  useEffect(() => {
    if (!mapLoaded || hasEvaluatedInitialUserCenterRef.current) return;
    hasEvaluatedInitialUserCenterRef.current = true;
    if (
      !shouldRequestInitialUserLocation({ initialCenter, searchQuery, selectedListingId }) ||
      !("geolocation" in navigator)
    ) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        mapRef.current?.easeTo({
          center: [position.coords.longitude, position.coords.latitude],
          zoom: USER_CITY_ZOOM,
          duration: 500,
        });
      },
      () => undefined,
      { enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: 6000 },
    );
  }, [initialCenter, mapLoaded, searchQuery, selectedListingId]);

  useEffect(() => {
    if (!mapLoaded || !searchTarget) return;
    if (searchTarget.bounds) {
      mapRef.current?.fitBounds(toMapBounds(searchTarget.bounds), {
        padding: discoveryCameraPadding(isDesktop, mobileBottomPadding, mapRef.current?.getMap().getContainer().clientHeight),
        duration: 600,
      });
      return;
    }
    mapRef.current?.easeTo({
      center: [searchTarget.center.lng, searchTarget.center.lat],
      zoom: RECENTER_ZOOM,
      duration: 600,
    });
  }, [isDesktop, mapLoaded, mobileBottomPadding, searchTarget]);

  useEffect(() => {
    if (!mapLoaded || !selectedListing) return;
    mapRef.current?.easeTo({
      center: [selectedListing.coordinates.lng, selectedListing.coordinates.lat],
      zoom: Math.max(12, mapRef.current.getZoom()),
      offset: isDesktop
        ? [0, 150]
        : mobileBottomPadding > 0
          ? [0, -Math.min(180, mobileBottomPadding * 0.35)]
          : [0, 0],
      duration: 450,
    });
  }, [isDesktop, mapLoaded, mobileBottomPadding, selectedListing]);

  useEffect(() => {
    if (!mapLoaded || !recenterTarget) return;
    mapRef.current?.easeTo({
      center: [recenterTarget.lng, recenterTarget.lat],
      zoom: RECENTER_ZOOM,
      duration: 500,
    });
  }, [mapLoaded, recenterTarget]);

  useEffect(() => {
    if (!mapLoaded || !fitListingsRequest) return;
    const plan = buildQuickFilterCameraPlan(listings, isDesktop, mobileBottomPadding, mapRef.current?.getMap().getContainer().clientHeight);
    if (plan.kind === "none") return;
    if (plan.kind === "single") {
      mapRef.current?.easeTo({ center: [plan.target.lng, plan.target.lat], zoom: plan.zoom, duration: 500 });
      return;
    }
    const bounds = boundsFromPoints(plan.targets);
    if (bounds) mapRef.current?.fitBounds(toMapBounds(bounds), { padding: plan.padding, duration: 500 });
  }, [fitListingsRequest, isDesktop, listings, mapLoaded, mobileBottomPadding]);

  useEffect(() => {
    if (!mapLoaded || !clusterFitRequest) return;
    mapRef.current?.fitBounds(toMapBounds(clusterFitRequest.bounds), {
      padding: discoveryCameraPadding(isDesktop, mobileBottomPadding, mapRef.current?.getMap().getContainer().clientHeight),
      duration: 500,
    });
  }, [clusterFitRequest, isDesktop, mapLoaded, mobileBottomPadding]);

  const handleClusterActivate = useCallback((clusterId: number, count: number) => {
    const leaves = clusterIndex.getLeaves(clusterId, Infinity);
    const listingIds = leaves.map((leaf) => leaf.properties.listingId);
    const bounds = boundsFromPoints(
      leaves.map((leaf) => ({
        lng: leaf.geometry.coordinates[0]!,
        lat: leaf.geometry.coordinates[1]!,
      })),
    );
    if (!bounds) return;
    onSelectListing?.("");
    if (onClusterPreview) {
      onClusterPreview({ listingIds, count, bounds });
      return;
    }
    mapRef.current?.fitBounds(toMapBounds(bounds), {
      padding: discoveryCameraPadding(isDesktop, mobileBottomPadding, mapRef.current?.getMap().getContainer().clientHeight),
      duration: 500,
    });
  }, [clusterIndex, isDesktop, mobileBottomPadding, onClusterPreview, onSelectListing]);

  const handleDirections = selectedListing
    ? () => {
      const url = buildExternalDirectionsUrl({
        destination: selectedListing.coordinates,
        label: selectedListing.title,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
      });
      if (url.startsWith("geo:")) {
        window.location.href = url;
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    }
    : undefined;

  if (!mapApiKey || !mapStyle) {
    return (
      <div role="alert" className="flex h-full min-h-0 items-center justify-center bg-muted p-6">
        <div className="max-w-sm rounded-lg border border-status-warning-border bg-status-warning-surface p-4 text-sm text-status-warning-text shadow-[var(--elevation-1)]">
          <p className="font-semibold">The map is not configured.</p>
          <p className="mt-1">Add a protected MapTiler API key, then reload this page.</p>
        </div>
      </div>
    );
  }

  if (mapError) {
    return (
      <div role="alert" className="flex h-full min-h-0 items-center justify-center bg-muted p-6">
        <div className="max-w-sm rounded-lg border border-status-error-border bg-status-error-surface p-4 text-sm text-status-error-text shadow-[var(--elevation-1)]">
          <p className="font-semibold">The map could not be loaded.</p>
          <p className="mt-1">Check your connection or browser graphics support, then refresh.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0">
      {!mapLoaded ? <div className="absolute inset-0 z-10"><MapLoadingSkeleton /></div> : null}
      <MapLibreMap
        ref={mapRef}
        initialViewState={{
          longitude: (initialCenter ?? DEFAULT_CENTER).lng,
          latitude: (initialCenter ?? DEFAULT_CENTER).lat,
          zoom: initialCenter ? 14 : 11,
        }}
        mapStyle={mapStyle}
        workerUrl={`/maplibre/${mapLibreVersion}/maplibre-gl-worker.mjs`}
        attributionControl={{ compact: true }}
        dragRotate={false}
        pitchWithRotate={false}
        reuseMaps
        onLoad={() => {
          setMapLoaded(true);
          setMapError(false);
          window.requestAnimationFrame(emitCameraState);
        }}
        onError={() => {
          if (!mapLoaded) setMapError(true);
        }}
        onMove={(event: ViewStateChangeEvent) => {
          setZoom(event.viewState.zoom);
        }}
        onMoveEnd={emitCameraState}
        style={{ width: "100%", height: "100%" }}
      >
        {selectedRadius ? (
          <Source id="selected-listing-radius" type="geojson" data={selectedRadius}>
            <Layer
              id="selected-listing-radius-fill"
              type="fill"
              paint={{ "fill-color": "#D89B23", "fill-opacity": 0.1 }}
            />
            <Layer
              id="selected-listing-radius-line"
              type="line"
              paint={{ "line-color": "#D89B23", "line-opacity": 0.75, "line-width": 2 }}
            />
          </Source>
        ) : null}

        {displayMode === "density"
          ? clusteredFeatures.map((feature) => {
            const [lng, lat] = feature.geometry.coordinates;
            if (typeof lng !== "number" || typeof lat !== "number") return null;
            if ("cluster" in feature.properties && feature.properties.cluster) {
              const clusterId = Number(feature.properties.cluster_id);
              const count = Number(feature.properties.point_count);
              return (
                <Marker key={`cluster-${clusterId}`} longitude={lng} latitude={lat} anchor="center">
                  <button
                    type="button"
                    className="pinpoint-map-cluster"
                    aria-label={`Preview ${count} homes`}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleClusterActivate(clusterId, count);
                    }}
                  >
                    {count}
                  </button>
                </Marker>
              );
            }

            const listing = listingById.get(feature.properties.listingId);
            if (!listing) return null;
            return (
              <Marker key={listing.id} longitude={listing.coordinates.lng} latitude={listing.coordinates.lat} anchor="bottom">
                <ListingMarker
                  title={listing.title}
                  area={listing.area}
                  price={listing.price}
                  selected={listing.id === selectedListingId}
                  previewed={listing.id === previewedListingId}
                  dimmed={Boolean(selectedListingId && listing.id !== selectedListingId)}
                  displayMode="dot"
                  liveState={
                    listing.liveTourId
                      ? "live-tour"
                      : listing.hasInstantViewing
                        ? "instant-viewing"
                        : listing.landlordPresence === "available"
                          ? "available"
                          : "default"
                  }
                  onActivate={() => onSelectListing?.(listing.id)}
                  onPreviewChange={(previewed) => onPreviewListingChange?.(previewed ? listing.id : undefined)}
                />
              </Marker>
            );
          })
          : listings.map((listing) => (
            <Marker key={listing.id} longitude={listing.coordinates.lng} latitude={listing.coordinates.lat} anchor="bottom">
              <ListingMarker
                title={listing.title}
                area={listing.area}
                price={listing.price}
                selected={listing.id === selectedListingId}
                previewed={listing.id === previewedListingId}
                dimmed={Boolean(selectedListingId && listing.id !== selectedListingId)}
                displayMode="price"
                liveState={
                  listing.liveTourId
                    ? "live-tour"
                    : listing.hasInstantViewing
                      ? "instant-viewing"
                      : listing.landlordPresence === "available"
                        ? "available"
                        : "default"
                }
                onActivate={() => onSelectListing?.(listing.id)}
                onPreviewChange={(previewed) => onPreviewListingChange?.(previewed ? listing.id : undefined)}
              />
            </Marker>
          ))}

        {isDesktop && selectedListing && !detailOpen ? (
          <Popup
            longitude={selectedListing.coordinates.lng}
            latitude={selectedListing.coordinates.lat}
            anchor="bottom"
            offset={32}
            closeButton={false}
            closeOnClick={false}
            onClose={() => onSelectListing?.("")}
            className="pinpoint-map-popup pinpoint-property-map-popup"
            maxWidth="calc(20rem + 2px)"
          >
            <PropertyMapPreview
              listing={selectedListing}
              onClose={() => onSelectListing?.("")}
              onView={() => onViewListing?.(selectedListing.id)}
            />
          </Popup>
        ) : null}
      </MapLibreMap>

      <MapControls
        className="absolute top-4 z-[var(--z-controls)]"
        onZoomIn={() => mapRef.current?.zoomIn({ duration: 220 })}
        onZoomOut={() => mapRef.current?.zoomOut({ duration: 220 })}
        onLocate={(coordinates) => mapRef.current?.easeTo({
          center: [coordinates.lng, coordinates.lat],
          zoom: 15,
          duration: 500,
        })}
        onDirections={handleDirections}
      />

      {children}
    </div>
  );
}
