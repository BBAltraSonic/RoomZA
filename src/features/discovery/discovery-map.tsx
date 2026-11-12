"use client";
import { DiscoveryClock, specialTiming, useDiscoveryCoarseNow } from "./discovery-clock";
import { formatDealPrice } from "./deal-schema";
import styles from "./special-card.module.css";
import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Map, {
  Marker,
  Popup,
  type MapRef,
  type ViewStateChangeEvent,
} from "react-map-gl/maplibre";
import mapLibrePackage from "maplibre-gl/package.json";
const mapLibreVersion = mapLibrePackage.version;
import { CalendarDays, Droplets, Hammer, Leaf, MapPin, Sparkles, Wrench, Zap } from "lucide-react";
import { getMapTilerStyleUrl } from "@/lib/maptiler";
import {
  boundsFromPoints,
  toMapBounds,
} from "@/features/map-discovery/lib/map-geometry";
import type { DiscoveryPlace } from "@/features/places/place";
import { useReducedMotion } from "motion/react";
import { MapControls } from "@/features/map-discovery/map-controls";
import { buildExternalDirectionsUrl } from "@/features/map-discovery/lib/external-directions";
import type { GeoPoint, ViewportBounds } from "@/features/map-discovery/lib/types";
import { boundsSchema, formatViewportBbox } from "./viewport-contract";
import { shouldRequestInitialUserLocation } from "@/features/map-discovery/lib/search-recenter";
import { useMapPins, type MapPinCluster, type PinSignals } from "@/features/map-discovery/hooks/use-map-pins";
import { haversineKm } from "@/features/map-discovery/lib/distance";
import { zoomBucket } from "@/features/map-discovery/lib/marker-window";
import { animatedPinIds, eventWhenLabel, formatPinDistance, pinPulseDelay } from "@/features/map-discovery/lib/pin-content";
import { markerDisplayMode } from "@/features/map-discovery/lib/viewport-context";
import type { MapCamera } from "@/features/map-discovery/map-view";

export type DiscoveryMapPoint = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  identity?: string; priceLabel?: string; startsAt?: string; endsAt?: string;
  kind?: "special" | "place" | "event" | "service";
  /** What the pin leads with: the price, the deal, or who the provider is. */
  headline?: string;
  detail?: string;
  tag?: string;
  serviceType?: string;
  /** In cents, so a cluster can say what its cheapest member costs. */
  amount?: number;
  onNow?: boolean;
  isNew?: boolean;
};
export type DiscoveryMapProps = {
  mapApiKey?: string;
  place: DiscoveryPlace | null;
  points: DiscoveryMapPoint[];
  selectedId?: string;
  onSelect: (id: string) => void;
  categoryLabel: string;
  targetBounds?: ViewportBounds | null;
  onBoundsChange?: (bounds: ViewportBounds) => void;
  onUserLocation?: (location: GeoPoint) => void;
  userLocation?: GeoPoint | null;
  /** The stage map renders outside the screen's clock, so it keeps its own from this. */
  serverNow?: string;
  selectedCard?: ReactNode;
  onCloseSelection?: () => void;
  searchQuery?: string;
  /** Set when the map is already live, so the camera continues from where it was. */
  initialCamera?: MapCamera | null;
  onCameraChange?: (camera: MapCamera) => void;
};

const WORLD_BOUNDS: ViewportBounds = { west: -180, south: -85, east: 180, north: 85 };

const SERVICE_ICONS: Record<string, ReactNode> = { Plumbing: <Droplets size={15} />, Electrical: <Zap size={15} />, Cleaning: <Sparkles size={15} />, Gardening: <Leaf size={15} />, Handyman: <Hammer size={15} /> };

function pointIcon({ kind, serviceType }: DiscoveryMapPoint) {
  if (kind === "service") return SERVICE_ICONS[serviceType ?? ""] ?? <Wrench size={15} />;
  return kind === "event" ? <CalendarDays size={15} /> : kind === "place" ? <MapPin size={15} /> : null;
}

function pointTiming(point: DiscoveryMapPoint, now: number | null) {
  return point.startsAt && point.endsAt && now !== null ? specialTiming(point.startsAt, point.endsAt, now) : null;
}

function pointAttention(point: DiscoveryMapPoint, now: number | null) {
  const timing = pointTiming(point, now);
  if (!timing) return point.isNew ? 1 : 0;
  if (timing.ended) return 0;
  if (point.kind === "event") return timing.upcoming ? (timing.tone === "later" ? 0 : 2) : 3;
  return !timing.upcoming && timing.tone === "urgent" ? 3 : 0;
}

const pointSignals = (point: DiscoveryMapPoint): PinSignals => ({ live: Boolean(point.onNow), price: point.amount });

type PointMarkerProps = { point: DiscoveryMapPoint; selected: boolean; now: number | null; compact: boolean; animated: boolean; distance?: string; onSelect: (id: string) => void };

/** Memoised so one selection re-renders one pin; timing updates on the coarse clock. */
const PointMarker = memo(function PointMarker({ point, selected, now, compact, animated, distance, onSelect }: PointMarkerProps) {
  const timing = pointTiming(point, now);
  const ringColor = timing?.tone === "urgent" ? "oklch(60% .2 35)" : timing?.tone === "soon" ? "oklch(68% .16 75)" : "var(--brand-amber)";
  const endingSoon = timing && !timing.ended && !timing.upcoming && timing.tone === "urgent" && point.kind !== "event" ? Math.ceil(timing.remaining / 60_000) + "m left" : undefined;
  const when = point.kind === "event" && point.startsAt && point.endsAt && now !== null ? eventWhenLabel(point.startsAt, point.endsAt, now) : undefined;
  const tag = endingSoon ?? when ?? point.tag ?? (point.isNew ? "New" : undefined);
  const headline = point.headline ?? point.priceLabel ?? point.title;
  const detail = [point.detail, distance].filter(Boolean).join(" · ");
  const designed = Boolean(point.identity || point.kind);
  const label = ["Show " + point.title, point.headline ?? point.priceLabel, point.detail, tag, !endingSoon && !when ? timing?.label : undefined, distance ? distance + " from you" : undefined].filter(Boolean).join(", ");
  return (
    <Marker
      latitude={point.latitude}
      longitude={point.longitude}
      anchor="bottom"
    >
      <button
        type="button"
        aria-label={label}
        aria-pressed={selected}
        onClick={() => onSelect(point.id)}
        disabled={timing?.ended}
        style={designed ? { "--special-marker-ring": ringColor, "--pin-pulse-color": ringColor, "--pin-pulse-delay": pinPulseDelay(point.id) } as CSSProperties : undefined}
        className={designed ? styles.marker : "flex min-h-11 max-w-48 items-center gap-1 rounded-full border-2 border-panel bg-selection px-3 text-sm font-semibold text-selection-foreground shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"}
      >
        {animated ? <span aria-hidden="true" className="map-pin-pulse" /> : null}
        {designed ? <span aria-hidden="true" className={styles.markerInitial}>{pointIcon(point) ?? point.identity?.slice(0, 1).toUpperCase()}</span> : <MapPin size={16} aria-hidden="true" />}
        {designed ? <span className={styles.markerText}>
          <span className={styles.markerHeadline}><span className={styles.markerLabel}>{headline}</span>{tag ? <span className="map-pin-tag">{tag}</span> : null}</span>
          {!compact && detail ? <span className={styles.markerDetail}>{detail}</span> : null}
        </span> : <span className="truncate">{headline}</span>}
      </button>
    </Marker>
  );
});

/** Lives inside the map's clock so pins and their motion budget follow time remaining. */
function PointMarkers({ points, selectedId, compact, userLocation, onSelect }: { points: DiscoveryMapPoint[]; selectedId?: string; compact: boolean; userLocation?: GeoPoint | null; onSelect: (id: string) => void }) {
  const now = useDiscoveryCoarseNow();
  const animated = useMemo(() => animatedPinIds(points.map(point => ({ id: point.id, attention: pointAttention(point, now) }))), [now, points]);
  return points.map(point => <PointMarker
    key={point.id} point={point} selected={selectedId === point.id} now={now} compact={compact} animated={animated.has(point.id)} onSelect={onSelect}
    distance={userLocation ? formatPinDistance(haversineKm(userLocation, { lat: point.latitude, lng: point.longitude })) : undefined}
  />);
}

const ClusterMarker = memo(function ClusterMarker({ clusterId, count, lng, lat, liveCount, fromPrice, onActivate }: MapPinCluster & { onActivate: (clusterId: number) => void }) {
  const from = fromPrice === null ? null : fromPrice === 0 ? "Free" : "from " + formatDealPrice(fromPrice);
  return (
    <Marker longitude={lng} latitude={lat} anchor="center">
      <button type="button" className="pinpoint-map-cluster relative" aria-label={`Zoom to ${count} results` + (from ? ", " + from : "") + (liveCount ? `, ${liveCount} on now` : "")} onClick={event => { event.stopPropagation(); onActivate(clusterId); }}>
        {count}
        {liveCount ? <span aria-hidden="true" className="map-cluster-badge">{liveCount} on now</span> : null}
        {from ? <span aria-hidden="true" className="map-cluster-from">{from}</span> : null}
      </button>
    </Marker>
  );
});

export function DiscoveryMap({
  mapApiKey,
  place,
  points,
  selectedId,
  onSelect,
  categoryLabel,
  targetBounds,
  onBoundsChange, onUserLocation, userLocation, serverNow,
  searchQuery, selectedCard, onCloseSelection,
  initialCamera, onCameraChange,
}: DiscoveryMapProps) {
  const ref = useRef<MapRef>(null);
  const pane = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [visibleBounds, setVisibleBounds] = useState(WORLD_BOUNDS);
  const [zoom, setZoom] = useState(() => zoomBucket(initialCamera?.zoom ?? (place ? 14 : 11)));
  const reducedMotion = useReducedMotion();
  const reportedBounds = useRef<string | null>(null);
  // A live map resumes its camera instead of snapping back to the linked target.
  const positionedTarget = useRef(initialCamera && targetBounds ? formatViewportBbox(targetBounds) : null);
  const located = useRef(false);
  const positionedSelection = useRef<string | null>(null);
  const explicitlyPositioned = useRef(false);
  const locationCallback = useRef(onUserLocation);
  useEffect(() => { locationCallback.current = onUserLocation; }, [onUserLocation]);
  const startup = useRef({ targetBounds, place, selectedId, searchQuery, reducedMotion, resumed: Boolean(initialCamera) });
  // The results list still needs a viewport when the map cannot report one.
  // Use the shared link/catalogue bounds, with the existing national viewport
  // as the final fallback; this does not create or infer a discovery place.
  useEffect(() => {
    if (mapApiKey && !failed) return;
    const fallback = boundsSchema.safeParse(targetBounds ?? place?.bounds ?? { west: 16, south: -35, east: 33, north: -22 });
    if (fallback.success) onBoundsChange?.(fallback.data);
  }, [mapApiKey, failed, targetBounds, place, onBoundsChange]);
  const updateCamera = useCallback(() => {
    const map = ref.current, bounds = map?.getBounds();
    if (!map || !bounds) return;
    const parsed = boundsSchema.safeParse({ west: Math.max(-180, bounds.getWest()), south: Math.max(-85, bounds.getSouth()), east: Math.min(180, bounds.getEast()), north: Math.min(85, bounds.getNorth()) });
    if (!parsed.success) return;
    const visible = parsed.data;
    reportedBounds.current = formatViewportBbox(visible);
    setVisibleBounds(visible);
    setZoom(zoomBucket(map.getZoom()));
    const center = map.getCenter();
    onCameraChange?.({ lng: center.lng, lat: center.lat, zoom: map.getZoom() });
    onBoundsChange?.(visible);
  }, [onBoundsChange, onCameraChange]);
  // Runs after `loaded` commits because a reused map fires `load` before `ref`
  // attaches, and a new `onBoundsChange` means another environment took the map.
  const reportsOnReady = !targetBounds || Boolean(initialCamera);
  useEffect(() => {
    if (loaded && reportsOnReady) updateCamera();
  }, [loaded, reportsOnReady, updateCamera]);
  const pins = useMemo(() => points.map(point => ({ ...point, coordinates: { lat: point.latitude, lng: point.longitude } })), [points]);
  const { clusters, singles, clusterMembers } = useMapPins(pins, visibleBounds, zoom, selectedId, pointSignals);
  const zoomToCluster = useCallback((clusterId: number) => {
    const bounds = boundsFromPoints(clusterMembers(clusterId));
    if (bounds) ref.current?.fitBounds(toMapBounds(bounds), { padding: 64, maxZoom: 15, duration: reducedMotion ? 0 : 400 });
  }, [clusterMembers, reducedMotion]);
  const fitResults = useCallback(() => {
    if (!ref.current) return;
    const container = ref.current.getMap().getContainer();
    const pane = container.closest<HTMLElement>("[data-discovery-map-body]");
    const sheetHeight = pane ? parseFloat(pane.style.getPropertyValue("--discovery-sheet-height")) : NaN;
    const bounds =
      boundsFromPoints(
        points.map((point) => ({ lat: point.latitude, lng: point.longitude })),
      ) ?? place?.bounds ?? { west: 16, south: -35, east: 33, north: -22 };
    if (bounds)
      ref.current.fitBounds(toMapBounds(bounds), {
        padding: {
          top: 64,
          right: 64,
          bottom:
            window.innerWidth < 1024
              ? Math.min(
                  Number.isFinite(sheetHeight) ? sheetHeight + 16 : 300,
                  Math.max(0, container.clientHeight - 128),
                )
              : 64,
          left: 64,
        },
        maxZoom: 15,
        duration: 0,
      });
  }, [points, place]);
  useEffect(() => {
    if (!loaded || !ref.current || !targetBounds) return;
    const key = formatViewportBbox(targetBounds);
    if (key === positionedTarget.current) return;
    positionedTarget.current = key;
    if (key === reportedBounds.current) return;
    explicitlyPositioned.current = true;
    ref.current.fitBounds(toMapBounds(targetBounds), { padding: 0, duration: 0 });
  }, [loaded, targetBounds]);
  useEffect(() => {
    if (!loaded || located.current) return;
    located.current = true;
    if (!("geolocation" in navigator)) return;
    const initial = startup.current;
    const recenter = !initial.resumed && !initial.targetBounds && shouldRequestInitialUserLocation({ initialCenter: initial.place?.center, searchQuery: initial.searchQuery, selectedListingId: initial.selectedId });
    let disposed = false;
    const locate = () => navigator.geolocation.getCurrentPosition(position => {
      if (!disposed) locationCallback.current?.({ lat: position.coords.latitude, lng: position.coords.longitude });
      if (!disposed && recenter && !explicitlyPositioned.current) ref.current?.easeTo({ center: [position.coords.longitude, position.coords.latitude], zoom: 11, duration: initial.reducedMotion ? 0 : 500 });
    }, () => undefined, { enableHighAccuracy: false, maximumAge: 600000, timeout: 6000 });
    // A linked or resumed map never prompts; it only reads a location already shared with us.
    if (recenter) locate();
    else void navigator.permissions?.query({ name: "geolocation" }).then(status => { if (status.state === "granted" && !disposed) locate(); }, () => undefined);
    return () => { disposed = true; };
  }, [loaded]);
  useEffect(() => {
    if (!selectedId) { positionedSelection.current = null; return; }
    const selected = points.find((point) => point.id === selectedId);
    if (loaded && selected && positionedSelection.current !== selectedId) {
      positionedSelection.current = selectedId;
      explicitlyPositioned.current = true;
      ref.current?.easeTo({
        center: [selected.longitude, selected.latitude],
        duration: reducedMotion ? 0 : 250,
      });
    }
  }, [loaded, points, selectedId, reducedMotion]);
  const selectedPoint = points.find(point => point.id === selectedId);
  const directions = selectedPoint ? () => {
    const url = buildExternalDirectionsUrl({ destination: { lat: selectedPoint.latitude, lng: selectedPoint.longitude }, label: selectedPoint.title, userAgent: navigator.userAgent, platform: navigator.platform });
    if (url.startsWith("geo:")) window.location.href = url;
    else window.open(url, "_blank", "noopener,noreferrer");
  } : undefined;
  if (!mapApiKey || failed)
    return (
      <div
        role="alert"
        className="flex h-full items-center justify-center bg-muted p-6"
      >
        <div className="max-w-sm rounded-xl border border-status-warning-border bg-status-warning-surface p-5 text-sm text-status-warning-text">
          <p className="font-semibold">
            {failed
              ? "The map could not be loaded."
              : "The map is not configured."}
          </p>
          <p className="mt-2 text-muted-foreground">
            Open the results list to keep browsing {categoryLabel.toLowerCase()}.
          </p>
        </div>
      </div>
    );
  const timedLayer = <>
    <PointMarkers points={singles} selectedId={selectedId} compact={markerDisplayMode(zoom) === "density"} userLocation={userLocation} onSelect={onSelect} />
    {selectedPoint && selectedCard ? <Popup latitude={selectedPoint.latitude} longitude={selectedPoint.longitude} maxWidth="none" offset={34} closeButton={false} closeOnClick={false} onClose={onCloseSelection} className={styles.popup}><div className={styles.popupCard}>{selectedCard}</div></Popup> : null}
  </>;
  return (
    <div ref={pane} className="relative h-full min-h-0" data-slot="category-map">
      <Map
        ref={ref}
        initialViewState={initialCamera ? {
          latitude: initialCamera.lat,
          longitude: initialCamera.lng,
          zoom: initialCamera.zoom,
        } : {
          latitude: place?.center.lat ?? -26.2041,
          longitude: place?.center.lng ?? 28.0473,
          zoom: place ? 14 : 11,
        }}
        mapStyle={getMapTilerStyleUrl(mapApiKey, true)}
        workerUrl={"/maplibre/" + mapLibreVersion + "/maplibre-gl-worker.mjs"}
        style={{ width: "100%", height: "100%" }}
        attributionControl={{ compact: true }}
        dragRotate={false}
        pitchWithRotate={false}
        reuseMaps
        onLoad={() => setLoaded(true)}
        onMove={(event: ViewStateChangeEvent) => {
          const next = zoomBucket(event.viewState.zoom);
          if (next !== zoom) startTransition(() => setZoom(next));
        }}
        onMoveEnd={() => { pane.current?.toggleAttribute("data-map-moving", false); updateCamera(); }}
        onMoveStart={event => { pane.current?.toggleAttribute("data-map-moving", true); if (event.originalEvent) explicitlyPositioned.current = true; }}
        onError={() => {
          if (!loaded) setFailed(true);
        }}
      >
        {userLocation ? <Marker latitude={userLocation.lat} longitude={userLocation.lng} anchor="center"><span role="img" aria-label="Your location" className="map-user-location" /></Marker> : null}
        {clusters.map(cluster => <ClusterMarker key={`cluster-${cluster.clusterId}`} {...cluster} onActivate={zoomToCluster} />)}
        {serverNow ? <DiscoveryClock serverNow={serverNow}>{timedLayer}</DiscoveryClock> : timedLayer}
      </Map>
      {categoryLabel === "Specials" ? <div aria-label="Special marker ring legend" className="absolute bottom-[calc(var(--discovery-sheet-height,0px)+1rem)] left-4 z-10 flex flex-wrap items-center gap-3 rounded-full border border-border bg-panel px-4 py-2 text-xs shadow-sm lg:bottom-4"><strong>Ring = time left</strong><span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-status-error-text" />&lt; 1h</span><span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-gold" />&lt; 3h</span><span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-forest" />later</span></div> : null}
      <MapControls className="absolute top-4 z-[var(--z-controls)]"
        onZoomIn={() => ref.current?.zoomIn({ duration: reducedMotion ? 0 : 220 })}
        onZoomOut={() => ref.current?.zoomOut({ duration: reducedMotion ? 0 : 220 })}
        onLocate={coordinates => { locationCallback.current?.(coordinates); ref.current?.easeTo({ center: [coordinates.lng, coordinates.lat], zoom: 15, duration: reducedMotion ? 0 : 500 }); }}
        onFitResults={fitResults}
        onDirections={directions} directionsLabel={"Directions to selected " + (categoryLabel === "Services" ? "service" : "special")}
      />
    </div>
  );
}
