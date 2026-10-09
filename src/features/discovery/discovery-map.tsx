"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Map, {
  Marker,
  Popup,
  type MapRef,
} from "react-map-gl/maplibre";
import mapLibrePackage from "maplibre-gl/package.json";
const mapLibreVersion = mapLibrePackage.version;
import { MapPin } from "lucide-react";
import { forwardGeocode, getMapTilerStyleUrl } from "@/lib/maptiler";
import {
  boundsFromPoints,
  toMapBounds,
} from "@/features/map-discovery/lib/map-geometry";
import type { DiscoveryPlace } from "@/features/places/place";
import { useReducedMotion } from "motion/react";
import { MapControls } from "@/features/map-discovery/map-controls";
import { buildExternalDirectionsUrl } from "@/features/map-discovery/lib/external-directions";
import { NEARBY_CATEGORIES, NEARBY_MIN_ZOOM, NearbyPanel, locationToPoi, type NearbyCategoryId, type NearbyPoi } from "@/features/map-discovery/nearby-places";
import type { GeoPoint, ViewportBounds } from "@/features/map-discovery/lib/types";
import { boundsSchema, formatViewportBbox } from "./viewport-contract";
import { shouldRequestInitialUserLocation } from "@/features/map-discovery/lib/search-recenter";

const emptyNearby = (): Record<NearbyCategoryId, NearbyPoi[]> => ({ transport: [], schools: [], groceries: [], clinics: [], restaurants: [] });
export type DiscoveryMapPoint = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
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
  onBoundsChange,
  searchQuery,
}: DiscoveryMapProps) {
  const ref = useRef<MapRef>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [dark, setDark] = useState(false);
  const reducedMotion = useReducedMotion();
  const [camera, setCamera] = useState<{ center: GeoPoint; bounds: ViewportBounds; zoom: number }>();
  const [nearbyOpen, setNearbyOpen] = useState(false);
  const [nearbyCategory, setNearbyCategory] = useState<NearbyCategoryId>("transport");
  const [nearbyResults, setNearbyResults] = useState(emptyNearby);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [selectedPoi, setSelectedPoi] = useState<NearbyPoi | null>(null);
  const reportedBounds = useRef<string | null>(null);
  const positionedTarget = useRef<string | null>(null);
  const located = useRef(false);
  const positionedSelection = useRef<string | null>(null);
  const explicitlyPositioned = useRef(false);
  const startup = useRef({ targetBounds, place, selectedId, searchQuery, reducedMotion });
  const updateCamera = () => {
    const map = ref.current, bounds = map?.getBounds();
    if (!map || !bounds) return;
    const center = map.getCenter();
    const parsed = boundsSchema.safeParse({ west: Math.max(-180, bounds.getWest()), south: Math.max(-85, bounds.getSouth()), east: Math.min(180, bounds.getEast()), north: Math.min(85, bounds.getNorth()) });
    if (!parsed.success) return;
    const visible = parsed.data;
    reportedBounds.current = formatViewportBbox(visible);
    setCamera({ center: { lat: center.lat, lng: center.lng }, bounds: visible, zoom: map.getZoom() });
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
  useEffect(() => {
    if (!loaded || !nearbyOpen || !camera || camera.zoom < NEARBY_MIN_ZOOM || !mapApiKey) return;
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) { setNearbyResults(emptyNearby()); setSelectedPoi(null); setNearbyLoading(true); setNearbyError(null); } });
    void Promise.allSettled(NEARBY_CATEGORIES.map(async category => {
      const features = await forwardGeocode({ apiKey: mapApiKey, query: category.query, limit: 10, proximity: camera.center, bounds: camera.bounds, types: ["poi"], autocomplete: false, signal: controller.signal });
      return [category.id, features.flatMap(feature => { const poi = locationToPoi(feature, category.id); return poi ? [poi] : []; })] as const;
    })).then(results => {
      if (controller.signal.aborted) return;
      const next = emptyNearby(); let successes = 0;
      for (const result of results) if (result.status === "fulfilled") { successes++; next[result.value[0]] = result.value[1]; }
      setNearbyResults(next); setNearbyLoading(false); setNearbyError(successes ? null : "Nearby places are unavailable right now.");
    });
    return () => controller.abort();
  }, [loaded, nearbyOpen, camera, mapApiKey]);
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
        <div className="max-w-sm rounded-xl border border-border bg-panel p-5 text-sm">
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
        {points.map((point) => (
          <Marker
            key={point.id}
            latitude={point.latitude}
            longitude={point.longitude}
            anchor="bottom"
          >
            <button
              type="button"
              aria-label={"Show " + point.title}
              aria-pressed={selectedId === point.id}
              onClick={() => onSelect(point.id)}
              className="flex min-h-11 max-w-48 items-center gap-1 rounded-full border-2 border-panel bg-forest px-3 text-sm font-semibold text-primary-foreground shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MapPin size={16} aria-hidden="true" />
              <span className="truncate">{point.title}</span>
            </button>
          </Marker>
        ))}
        {nearbyOpen && (camera?.zoom ?? 0) >= NEARBY_MIN_ZOOM ? nearbyResults[nearbyCategory].map(poi => <Marker key={poi.id} latitude={poi.coordinates.lat} longitude={poi.coordinates.lng} anchor="center"><button type="button" aria-label={"Show " + poi.name} onClick={() => setSelectedPoi(poi)} className="flex size-11 items-center justify-center rounded-full border-2 border-panel bg-forest text-primary-foreground shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><MapPin size={16} aria-hidden="true" /></button></Marker>) : null}
        {nearbyOpen && selectedPoi ? <Popup latitude={selectedPoi.coordinates.lat} longitude={selectedPoi.coordinates.lng} onClose={() => setSelectedPoi(null)} closeOnClick={false}><p className="text-sm font-semibold">{selectedPoi.name}</p>{selectedPoi.address ? <p className="text-xs">{selectedPoi.address}</p> : null}</Popup> : null}
      </Map>
      <MapControls className="absolute top-4 z-[var(--z-controls)]"
        onZoomIn={() => ref.current?.zoomIn({ duration: reducedMotion ? 0 : 220 })}
        onZoomOut={() => ref.current?.zoomOut({ duration: reducedMotion ? 0 : 220 })}
        onLocate={coordinates => ref.current?.easeTo({ center: [coordinates.lng, coordinates.lat], zoom: 15, duration: reducedMotion ? 0 : 500 })}
        onFitResults={fitResults} nearbyOpen={nearbyOpen} onToggleNearby={() => setNearbyOpen(open => !open)}
        onDirections={directions} directionsLabel={"Directions to selected " + (categoryLabel === "Services" ? "service" : "special")}
      />
      <NearbyPanel zoom={camera?.zoom ?? 0} open={nearbyOpen} activeCategory={nearbyCategory} onActiveCategoryChange={category => { setNearbyCategory(category); setSelectedPoi(null); }} results={nearbyResults} loading={nearbyLoading} error={nearbyError} onClose={() => { setNearbyOpen(false); setSelectedPoi(null); }} />

    </div>
  );
}
