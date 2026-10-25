"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapLibreMap, { Marker, type MapRef, type MarkerDragEvent } from "react-map-gl/maplibre";
import mapLibrePackage from "maplibre-gl/package.json";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  forwardGeocode,
  getMapTilerStyleUrl,
  reverseGeocode,
  type NormalizedLocation,
} from "@/lib/maptiler";
import { cn } from "@/lib/utils";

export type LocationPickerProps = {
  mapApiKey: string;
  defaultAddress?: string;
  defaultLat?: number;
  defaultLng?: number;
  invalid?: boolean;
};

const JOBURG = { lat: -26.2041, lng: 28.0473 };
const DEFAULT_ZOOM = 14;

export function LocationPicker({
  mapApiKey,
  defaultAddress,
  defaultLat,
  defaultLng,
  invalid = false,
}: LocationPickerProps) {
  const mapRef = useRef<MapRef | null>(null);
  const searchControllerRef = useRef<AbortController | null>(null);
  const reverseControllerRef = useRef<AbortController | null>(null);
  const blurTimerRef = useRef<number | null>(null);

  const [address, setAddress] = useState(defaultAddress ?? "");
  const [lat, setLat] = useState(defaultLat ?? 0);
  const [lng, setLng] = useState(defaultLng ?? 0);
  const [hasLocation, setHasLocation] = useState(Boolean(defaultLat && defaultLng));
  const [markerPosition, setMarkerPosition] = useState<{ lat: number; lng: number } | null>(
    defaultLat && defaultLng ? { lat: defaultLat, lng: defaultLng } : null,
  );
  const [suggestions, setSuggestions] = useState<NormalizedLocation[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isDark, setIsDark] = useState(false);

  const mapStyle = useMemo(() => getMapTilerStyleUrl(mapApiKey, isDark), [isDark, mapApiKey]);
  const center = useMemo(
    () => defaultLat && defaultLng ? { lat: defaultLat, lng: defaultLng } : JOBURG,
    [defaultLat, defaultLng],
  );

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const query = address.trim();
    if (
      !mapApiKey ||
      !suggestionsOpen ||
      query.length < 3 ||
      (hasLocation && query === defaultAddress)
    ) return;

    const controller = new AbortController();
    searchControllerRef.current?.abort();
    searchControllerRef.current = controller;
    const timeoutId = window.setTimeout(() => {
      forwardGeocode({
        apiKey: mapApiKey,
        query,
        limit: 6,
        types: ["address", "road", "place"],
        proximity: markerPosition ?? center,
        signal: controller.signal,
      }).then((locations) => {
        if (controller.signal.aborted) return;
        setSuggestions(locations);
        setActiveSuggestionIndex(-1);
        setServiceUnavailable(false);
      }).catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSuggestions([]);
        setServiceUnavailable(true);
      });
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [address, center, defaultAddress, hasLocation, mapApiKey, markerPosition, suggestionsOpen]);

  useEffect(() => () => {
    searchControllerRef.current?.abort();
    reverseControllerRef.current?.abort();
    if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
  }, []);

  const moveMap = useCallback((nextLat: number, nextLng: number, zoom = DEFAULT_ZOOM) => {
    mapRef.current?.easeTo({
      center: [nextLng, nextLat],
      zoom,
      duration: 450,
    });
  }, []);

  const applyLocation = useCallback((location: NormalizedLocation) => {
    setLat(location.center.lat);
    setLng(location.center.lng);
    setAddress(location.fullAddress);
    setHasLocation(true);
    setMarkerPosition(location.center);
    setSuggestions([]);
    setSuggestionsOpen(false);
    setActiveSuggestionIndex(-1);
    setServiceUnavailable(false);
    moveMap(location.center.lat, location.center.lng);
  }, [moveMap]);

  const reverseLookup = useCallback((nextLat: number, nextLng: number) => {
    setLat(nextLat);
    setLng(nextLng);
    setMarkerPosition({ lat: nextLat, lng: nextLng });
    setHasLocation(true);
    setSuggestions([]);
    setSuggestionsOpen(false);

    const controller = new AbortController();
    reverseControllerRef.current?.abort();
    reverseControllerRef.current = controller;
    reverseGeocode({
      apiKey: mapApiKey,
      coordinates: { lat: nextLat, lng: nextLng },
      types: ["address", "road", "place"],
      signal: controller.signal,
    }).then((locations) => {
      if (controller.signal.aborted || !locations[0]) return;
      setAddress(locations[0].fullAddress);
      setServiceUnavailable(false);
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setServiceUnavailable(true);
    });
  }, [mapApiKey]);

  const geocodeTypedAddress = useCallback(() => {
    const query = address.trim();
    if (!query || (hasLocation && query === defaultAddress)) return;

    const controller = new AbortController();
    searchControllerRef.current?.abort();
    searchControllerRef.current = controller;
    forwardGeocode({
      apiKey: mapApiKey,
      query,
      limit: 1,
      types: ["address", "road", "place"],
      autocomplete: false,
      proximity: markerPosition ?? center,
      signal: controller.signal,
    }).then((locations) => {
      if (controller.signal.aborted || !locations[0]) return;
      applyLocation(locations[0]);
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setServiceUnavailable(true);
    });
  }, [address, applyLocation, center, defaultAddress, hasLocation, mapApiKey, markerPosition]);

  const handleMarkerDragEnd = useCallback((event: MarkerDragEvent) => {
    reverseLookup(event.lngLat.lat, event.lngLat.lng);
  }, [reverseLookup]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Label htmlFor="location-search" className="text-xs font-semibold uppercase text-muted-foreground">
          Search address
          <span className="ml-1.5 text-[0.65rem] normal-case tracking-normal text-clay">Required</span>
        </Label>
        <Input
          id="location-search"
          type="text"
          placeholder="Type an address in South Africa"
          aria-invalid={invalid}
          aria-autocomplete="list"
          aria-expanded={suggestionsOpen && suggestions.length > 0}
          aria-controls="location-search-suggestions"
          aria-activedescendant={activeSuggestionIndex >= 0 ? `location-search-option-${activeSuggestionIndex}` : undefined}
          autoComplete="off"
          className="mt-2 bg-warm-surface text-base shadow-none focus-visible:border-ring focus-visible:ring-ring/30"
          value={address}
          onFocus={() => setSuggestionsOpen(true)}
          onChange={(event) => {
            setAddress(event.target.value);
            setLat(0);
            setLng(0);
            setHasLocation(false);
            setMarkerPosition(null);
            setSuggestions([]);
            setSuggestionsOpen(true);
          }}
          onBlur={() => {
            blurTimerRef.current = window.setTimeout(() => {
              setSuggestionsOpen(false);
              geocodeTypedAddress();
            }, 100);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setSuggestionsOpen(false);
              setActiveSuggestionIndex(-1);
              return;
            }
            if ((event.key === "ArrowDown" || event.key === "ArrowUp") && suggestions.length > 0) {
              event.preventDefault();
              const direction = event.key === "ArrowDown" ? 1 : -1;
              setActiveSuggestionIndex((current) =>
                current < 0
                  ? direction === 1 ? 0 : suggestions.length - 1
                  : (current + direction + suggestions.length) % suggestions.length,
              );
              return;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              const active = suggestions[activeSuggestionIndex];
              if (active) applyLocation(active);
              else geocodeTypedAddress();
            }
          }}
        />
        {suggestionsOpen && suggestions.length > 0 ? (
          <ul
            id="location-search-suggestions"
            role="listbox"
            aria-label="Address suggestions"
            className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-[var(--z-filter-dropdown,35)] overflow-hidden rounded-xl border border-border/60 bg-panel p-1.5 shadow-[var(--elevation-3)]"
          >
            {suggestions.map((suggestion, index) => (
              <li key={suggestion.id}>
                <button
                  id={`location-search-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={index === activeSuggestionIndex}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveSuggestionIndex(index)}
                  onClick={() => applyLocation(suggestion)}
                  className={cn(
                    "flex min-h-11 w-full flex-col justify-center rounded-lg px-3 text-left text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    index === activeSuggestionIndex ? "bg-warm-surface" : "hover:bg-warm-surface",
                  )}
                >
                  <span className="font-medium">{suggestion.label}</span>
                  {suggestion.secondaryLabel ? (
                    <span className="truncate text-xs text-muted-foreground">{suggestion.secondaryLabel}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-1.5 text-xs text-muted-foreground">
          {serviceUnavailable
            ? "Address lookup is unavailable right now. Try again, or place the pin directly on the map."
            : "Choose a suggestion, press Enter to locate the typed address, or place the pin on the map."}
        </p>
      </div>

      <div className="h-[280px] w-full overflow-hidden rounded-lg border border-border">
        {mapUnavailable ? (
          <div role="alert" className="flex h-full items-center justify-center bg-status-warning-surface p-5 text-center text-sm text-status-warning-text">
            The map preview is unavailable. You can still choose an address above.
          </div>
        ) : (
          <MapLibreMap
            ref={mapRef}
            initialViewState={{
              longitude: center.lng,
              latitude: center.lat,
              zoom: defaultLat ? 15 : 11,
            }}
            mapStyle={mapStyle}
          workerUrl={`/maplibre/${mapLibrePackage.version}/maplibre-gl-worker.mjs`}
            dragRotate={false}
            pitchWithRotate={false}
            attributionControl={{ compact: true }}
            onLoad={() => {
              setMapLoaded(true);
              setMapUnavailable(false);
            }}
            onError={() => {
              if (!mapLoaded) setMapUnavailable(true);
            }}
            onClick={(event) => {
              reverseLookup(event.lngLat.lat, event.lngLat.lng);
            }}
            style={{ width: "100%", height: "100%" }}
          >
            {markerPosition ? (
              <Marker
                longitude={markerPosition.lng}
                latitude={markerPosition.lat}
                anchor="bottom"
                draggable
                onDragEnd={handleMarkerDragEnd}
              >
                <button
                  type="button"
                  aria-label="Property location. Drag to adjust."
                  className="flex min-h-11 min-w-11 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="relative block size-7 rounded-full border-4 border-panel bg-forest shadow-[var(--elevation-2)] after:absolute after:-bottom-1 after:left-1/2 after:size-2.5 after:-translate-x-1/2 after:rotate-45 after:bg-forest" />
                </button>
              </Marker>
            ) : null}
          </MapLibreMap>
        )}
      </div>

      {hasLocation ? (
        <p className="mt-2 text-sm font-medium text-clay">
          {lat.toFixed(6)}, {lng.toFixed(6)}. Drag the pin to adjust if necessary.
        </p>
      ) : (
        <p className="mt-2 text-sm font-medium text-muted-foreground">
          Search for an address above or click the map to place the pin.
        </p>
      )}

      <input type="hidden" name="address" value={address} />
      <input type="hidden" name="latitude" value={lat || ""} />
      <input type="hidden" name="longitude" value={lng || ""} />
    </div>
  );
}
