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

type LocationPickerProps = {
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

  useEffect(() => {
    if (!placesLib || !inputRef.current || autocompleteRef.current) return;

    const autocomplete = new placesLib.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "ZA" },
      fields: ["geometry", "formatted_address", "name"],
    });

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
          }
        },
        () => undefined,
      );
    },
    [geocodingLib],
  );

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
          placeholder="Search for an address in South Africa"
          className="mt-2 bg-warm-surface text-base shadow-none focus-visible:border-ring focus-visible:ring-ring/30"
          defaultValue={defaultAddress}
        />
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
