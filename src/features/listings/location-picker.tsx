"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  APIProvider,
  AdvancedMarker,
  Map,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

export type LocationPickerProps = {
  apiKey: string;
  defaultAddress?: string;
  defaultLat?: number;
  defaultLng?: number;
};

const joburg = { lat: -26.2041, lng: 28.0473 };
const defaultZoom = 14;
const MAP_ID = "roomza-location-picker";

function LocationPickerInner({
  defaultAddress,
  defaultLat,
  defaultLng,
}: Omit<LocationPickerProps, "apiKey">) {
  const map = useMap();
  const placesLib = useMapsLibrary("places");
  const geocodingLib = useMapsLibrary("geocoding");
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const [address, setAddress] = useState(defaultAddress ?? "");
  const [lat, setLat] = useState(defaultLat ?? 0);
  const [lng, setLng] = useState(defaultLng ?? 0);
  const [hasLocation, setHasLocation] = useState(!!(defaultLat && defaultLng));
  const [markerPosition, setMarkerPosition] = useState<google.maps.LatLngLiteral | null>(
    defaultLat && defaultLng ? { lat: defaultLat, lng: defaultLng } : null,
  );
  // When Places autocomplete is unavailable (API not enabled/authorized, quota,
  // or billing), we degrade gracefully to the Geocoding-based path below, which
  // only needs the Geocoding API. This keeps the picker fully usable.
  const [placesUnavailable, setPlacesUnavailable] = useState(false);

  // Google invokes window.gm_authFailure when the Maps key can't use a requested
  // service. Treat it as "suggestions off" and lean on the geocoding fallback.
  useEffect(() => {
    const previous = window.gm_authFailure;
    window.gm_authFailure = () => {
      setPlacesUnavailable(true);
      previous?.();
    };
    return () => {
      window.gm_authFailure = previous;
    };
  }, []);

  useEffect(() => {
    if (!placesLib || !inputRef.current || autocompleteRef.current) return;

    let autocomplete: google.maps.places.Autocomplete;
    try {
      autocomplete = new placesLib.Autocomplete(inputRef.current, {
        componentRestrictions: { country: "ZA" },
        fields: ["geometry", "formatted_address", "name"],
      });
    } catch {
      // Constructing the widget failed (library unavailable) — fall back silently.
      // Deferred to avoid a synchronous setState inside the effect body.
      queueMicrotask(() => setPlacesUnavailable(true));
      return;
    }

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry?.location) return;

      const resultLat = place.geometry.location.lat();
      const resultLng = place.geometry.location.lng();
      const fullAddress = place.formatted_address ?? place.name ?? "";

      setLat(resultLat);
      setLng(resultLng);
      setAddress(fullAddress);
      setHasLocation(true);
      setMarkerPosition({ lat: resultLat, lng: resultLng });

      map?.panTo({ lat: resultLat, lng: resultLng });
      map?.setZoom(defaultZoom);
    });

    autocompleteRef.current = autocomplete;
  }, [placesLib, map]);

  const handleMarkerDragEnd = useCallback(
    (event: google.maps.MapMouseEvent) => {
      if (!event.latLng || !geocodingLib) return;

      const newLat = event.latLng.lat();
      const newLng = event.latLng.lng();
      setLat(newLat);
      setLng(newLng);
      setMarkerPosition({ lat: newLat, lng: newLng });

      const geocoder = new geocodingLib.Geocoder();
      geocoder.geocode({ location: { lat: newLat, lng: newLng } }).then(
        ({ results }) => {
          if (results[0]?.formatted_address) {
            setAddress(results[0].formatted_address);
            if (inputRef.current) inputRef.current.value = results[0].formatted_address;
          }
        },
        () => undefined,
      );
    },
    [geocodingLib],
  );

  // Fallback for manual typing: if the user types an address but never selects a
  // Google suggestion, geocode the free text so latitude/longitude get populated.
  const geocodeTypedAddress = useCallback(() => {
    const query = inputRef.current?.value.trim();
    if (!query || !geocodingLib) return;
    if (hasLocation && query === address) return;

    const geocoder = new geocodingLib.Geocoder();
    geocoder.geocode({ address: query, componentRestrictions: { country: "ZA" } }).then(
      ({ results }) => {
        const best = results[0];
        if (!best?.geometry?.location) return;
        const resultLat = best.geometry.location.lat();
        const resultLng = best.geometry.location.lng();
        setLat(resultLat);
        setLng(resultLng);
        setMarkerPosition({ lat: resultLat, lng: resultLng });
        setHasLocation(true);
        const formatted = best.formatted_address ?? query;
        setAddress(formatted);
        if (inputRef.current) inputRef.current.value = formatted;
        map?.panTo({ lat: resultLat, lng: resultLng });
        map?.setZoom(defaultZoom);
      },
      () => undefined,
    );
  }, [geocodingLib, hasLocation, address, map]);

  const center = defaultLat && defaultLng ? { lat: defaultLat, lng: defaultLng } : joburg;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Label htmlFor="location-search" className="text-xs font-semibold uppercase text-muted-foreground">
          Search address
        </Label>
        <Input
          ref={inputRef}
          id="location-search"
          type="text"
          placeholder="Type an address in South Africa, then press Enter"
          className="mt-2 bg-warm-surface text-base shadow-none focus-visible:border-ring focus-visible:ring-ring/30"
          defaultValue={defaultAddress}
          onChange={(event) => setAddress(event.target.value)}
          onBlur={geocodeTypedAddress}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              geocodeTypedAddress();
            }
          }}
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          {placesUnavailable
            ? "Address suggestions are unavailable right now — type the full address and press Enter to locate it, then drag the pin to fine-tune."
            : "Start typing for suggestions, or press Enter to locate the address you typed."}
        </p>
      </div>

      <div className="h-[280px] w-full overflow-hidden rounded-lg border border-border">
        <Map
          defaultCenter={center}
          defaultZoom={defaultLat ? 15 : 11}
          mapId={MAP_ID}
          gestureHandling="greedy"
          disableDefaultUI
          zoomControl
          zoomControlOptions={{ position: 6 }}
          className="h-full w-full"
        >
          {markerPosition ? (
            <AdvancedMarker position={markerPosition} draggable onDragEnd={handleMarkerDragEnd} />
          ) : null}
        </Map>
      </div>

      {hasLocation ? (
        <p className="mt-2 text-sm font-medium text-clay">
          {lat.toFixed(6)}, {lng.toFixed(6)}. Drag the pin to adjust if necessary.
        </p>
      ) : (
        <p className="mt-2 text-sm font-medium text-muted-foreground">
          Search for an address above to place the pin.
        </p>
      )}

      <input type="hidden" name="address" value={address} />
      <input type="hidden" name="latitude" value={lat || ""} />
      <input type="hidden" name="longitude" value={lng || ""} />
    </div>
  );
}

export function LocationPicker({
  apiKey,
  defaultAddress,
  defaultLat,
  defaultLng,
}: LocationPickerProps) {
  return (
    <APIProvider apiKey={apiKey} libraries={["places", "geocoding"]}>
      <LocationPickerInner
        defaultAddress={defaultAddress}
        defaultLat={defaultLat}
        defaultLng={defaultLng}
      />
    </APIProvider>
  );
}
