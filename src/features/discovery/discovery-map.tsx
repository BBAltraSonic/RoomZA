"use client";
import { specialTiming, useDiscoveryNow } from "./discovery-clock";
import styles from "./special-card.module.css";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Map, {
  Marker,
  Popup,
  type MapRef,
} from "react-map-gl/maplibre";
import mapLibrePackage from "maplibre-gl/package.json";
const mapLibreVersion = mapLibrePackage.version;
import { MapPin } from "lucide-react";
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

export type DiscoveryMapPoint = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  identity?: string; priceLabel?: string; startsAt?: string; endsAt?: string;
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
  selectedCard?: ReactNode;
  onCloseSelection?: () => void;
  searchQuery?: string;
};
export function DiscoveryMap({
  mapApiKey,
  place,
  points,
  selectedId,
  onSelect,
  categoryLabel,
  targetBounds,
  onBoundsChange, onUserLocation,
  searchQuery, selectedCard, onCloseSelection,
}: DiscoveryMapProps) {
  const ref = useRef<MapRef>(null);
  const now = useDiscoveryNow();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [dark, setDark] = useState(false);
  const reducedMotion = useReducedMotion();
  const reportedBounds = useRef<string | null>(null);
  const positionedTarget = useRef<string | null>(null);
  const located = useRef(false);
  const positionedSelection = useRef<string | null>(null);
  const explicitlyPositioned = useRef(false);
  const locationCallback = useRef(onUserLocation);
  useEffect(() => { locationCallback.current = onUserLocation; }, [onUserLocation]);
  const startup = useRef({ targetBounds, place, selectedId, searchQuery, reducedMotion });
  const updateCamera = () => {
    const map = ref.current, bounds = map?.getBounds();
    if (!map || !bounds) return;
    const parsed = boundsSchema.safeParse({ west: Math.max(-180, bounds.getWest()), south: Math.max(-85, bounds.getSouth()), east: Math.min(180, bounds.getEast()), north: Math.min(85, bounds.getNorth()) });
    if (!parsed.success) return;
    const visible = parsed.data;
    reportedBounds.current = formatViewportBbox(visible);
    onBoundsChange?.(visible);
  };
  useEffect(() => {
    const update = () =>
      setDark(document.documentElement.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);
  const fitResults = useCallback(() => {
    if (!ref.current) return;
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
                  ref.current.getMap().getContainer().clientHeight * 0.48,
                  300,
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
    const initial = startup.current;
    if (initial.targetBounds || !shouldRequestInitialUserLocation({ initialCenter: initial.place?.center, searchQuery: initial.searchQuery, selectedListingId: initial.selectedId }) || !("geolocation" in navigator)) return;
    let disposed = false;
    navigator.geolocation.getCurrentPosition(position => {
      if (!disposed) locationCallback.current?.({ lat: position.coords.latitude, lng: position.coords.longitude });
      if (!disposed && !explicitlyPositioned.current) ref.current?.easeTo({ center: [position.coords.longitude, position.coords.latitude], zoom: 11, duration: initial.reducedMotion ? 0 : 500 });
    }, () => undefined, { enableHighAccuracy: false, maximumAge: 600000, timeout: 6000 });
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
            You can still browse {categoryLabel.toLowerCase()} in Feed view.
          </p>
        </div>
      </div>
    );
  return (
    <div className="relative h-full min-h-0" data-slot="category-map">
      <Map
        ref={ref}
        initialViewState={{
          latitude: place?.center.lat ?? -26.2041,
          longitude: place?.center.lng ?? 28.0473,
          zoom: place ? 14 : 11,
        }}
        mapStyle={getMapTilerStyleUrl(mapApiKey, dark)}
        workerUrl={"/maplibre/" + mapLibreVersion + "/maplibre-gl-worker.mjs"}
        style={{ width: "100%", height: "100%" }}
        attributionControl={{ compact: true }}
        dragRotate={false}
        pitchWithRotate={false}
        onLoad={() => { setLoaded(true); if (!targetBounds) updateCamera(); }}
        onMoveEnd={updateCamera}
        onMoveStart={event => { if (event.originalEvent) explicitlyPositioned.current = true; }}
        onError={() => {
          if (!loaded) setFailed(true);
        }}
      >
        {points.map((point) => {
          const timing = point.startsAt && point.endsAt && now !== null ? specialTiming(point.startsAt, point.endsAt, now) : null;
          const ringColor = timing?.tone === "urgent" ? "oklch(60% .2 35)" : timing?.tone === "soon" ? "oklch(68% .16 75)" : "oklch(35% .08 160)";
          return (
          <Marker
            key={point.id}
            latitude={point.latitude}
            longitude={point.longitude}
            anchor="bottom"
          >
            <button
              type="button"
              aria-label={"Show " + point.title + (point.priceLabel ? ", " + point.priceLabel : "") + (timing ? ", " + timing.label : "")}
              aria-pressed={selectedId === point.id}
              onClick={() => onSelect(point.id)}
              disabled={timing?.ended}
              style={point.identity ? { "--special-marker-ring": ringColor } as CSSProperties : undefined}
              className={point.identity ? styles.marker : "flex min-h-11 max-w-48 items-center gap-1 rounded-full border-2 border-panel bg-forest px-3 text-sm font-semibold text-primary-foreground shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"}
            >
              {point.identity ? <span aria-hidden="true" className={styles.markerInitial}>{point.identity.slice(0, 1).toUpperCase()}</span> : <MapPin size={16} aria-hidden="true" />}
              <span className={point.identity ? styles.markerLabel : "truncate"}>{point.priceLabel ?? point.title}</span>
            </button>
          </Marker>
        ); })}
        {selectedPoint && selectedCard ? <Popup latitude={selectedPoint.latitude} longitude={selectedPoint.longitude} maxWidth="none" offset={34} closeButton={false} closeOnClick={false} onClose={onCloseSelection} className={styles.popup}><div className={styles.popupCard}>{selectedCard}</div></Popup> : null}
      </Map>
      {categoryLabel === "Specials" ? <div aria-label="Special marker ring legend" className="absolute bottom-4 left-4 z-10 flex flex-wrap items-center gap-3 rounded-full border border-border bg-panel px-4 py-2 text-xs shadow-sm"><strong>Ring = time left</strong><span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-status-error-text" />&lt; 1h</span><span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-gold" />&lt; 3h</span><span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-forest" />later</span></div> : null}
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
