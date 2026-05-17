"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";

type ListingPin = {
  id: string;
  title: string;
  area: string;
  price: string;
  coordinates: { lat: number; lng: number };
};

type ViewportBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

type MapViewProps = {
  apiKey?: string;
  listings: ListingPin[];
  selectedListingId?: string;
  onSelectListing?: (listingId: string) => void;
  onBoundsChange?: (bounds: ViewportBounds) => void;
  initialCenter?: { lat: number; lng: number };
  searchQuery?: string;
  onCenterNameChange?: (name: string) => void;
  children?: React.ReactNode;
};

const defaultCenter = { lat: -26.2041, lng: 28.0473 };
const MAP_ID = "roomza-discovery-map";

function MapContent({
  listings,
  selectedListingId,
  onSelectListing,
  onBoundsChange,
  initialCenter,
  searchQuery,
  onCenterNameChange,
}: Omit<MapViewProps, "apiKey">) {
  const map = useMap(MAP_ID);
  const geocodingLib = useMapsLibrary("geocoding");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const geocoder = useMemo(
    () => geocodingLib ? new geocodingLib.Geocoder() : null,
    [geocodingLib],
  );

  const center = useMemo(
    () => initialCenter ?? defaultCenter,
    [initialCenter],
  );

  const handleCameraChanged = useCallback(
    (event: { detail: { bounds: { south: number; west: number; north: number; east: number }, center: { lat: number; lng: number } } }) => {
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

        // Reverse geocode the center to find the neighborhood
        if (onCenterNameChange && geocoder && event.detail.center) {
          const c = event.detail.center;
          geocoder.geocode({ location: { lat: c.lat, lng: c.lng } }, (results, status) => {
            if (status === "OK" && results?.[0]) {
              const options: Record<string, string> = {};
              results[0].address_components.forEach((comp) => {
                if (comp.types.includes("neighborhood")) options.neighborhood = comp.long_name;
                if (comp.types.includes("sublocality")) options.sublocality = comp.long_name;
                if (comp.types.includes("locality")) options.locality = comp.long_name;
              });
              const locationName = options.neighborhood || options.sublocality || options.locality;
              if (locationName) {
                onCenterNameChange(locationName);
              }
            }
          });
        }
      }, 250);
    },
    [onBoundsChange, onCenterNameChange, geocoder],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!geocoder || !map || !searchQuery) return;

    geocoder.geocode({ address: `${searchQuery}, South Africa` }, (results, status) => {
      if (status === "OK" && results?.[0]) {
        // Automatically pan/zoom to the queried location boundary
        map.fitBounds(results[0].geometry.viewport);
      }
    });
  }, [geocoder, map, searchQuery]);

  useEffect(() => {
    if (!map || !selectedListingId) return;

    const selected = listings.find((l) => l.id === selectedListingId);
    if (!selected) return;

    map.panTo(selected.coordinates);
    const currentZoom = map.getZoom() ?? 11;
    if (currentZoom < 12) {
      map.setZoom(12);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selectedListingId]);

  return (
    <Map
      id={MAP_ID}
      defaultCenter={center}
      defaultZoom={initialCenter ? 14 : 11}
      mapId={MAP_ID}
      gestureHandling="greedy"
      disableDefaultUI
      zoomControl={false}
      onCameraChanged={handleCameraChanged}
      className="h-full w-full"
    >
      {listings.map((listing) => (
        <AdvancedMarker
          key={listing.id}
          position={listing.coordinates}
          onClick={() => onSelectListing?.(listing.id)}
        >
          <button
            type="button"
            className={[
              "roomza-price-pin",
              listing.id === selectedListingId ? "roomza-price-pin-selected" : "",
            ].join(" ")}
            aria-label={`Open ${listing.title} in ${listing.area}`}
          >
            {listing.price}
          </button>
        </AdvancedMarker>
      ))}
    </Map>
  );
}

export function MapView({
  apiKey,
  listings,
  selectedListingId,
  onSelectListing,
  onBoundsChange,
  initialCenter,
  searchQuery,
  onCenterNameChange,
  children,
}: MapViewProps) {
  if (!apiKey) {
    return (
      <div className="flex h-full min-h-[520px] items-center justify-center bg-[#d7e4df] p-6">
        <div className="max-w-sm rounded-lg border border-white/80 bg-white/90 p-4 text-sm shadow-lg shadow-black/10 backdrop-blur">
          <p className="font-semibold text-[#173b33]">Google Maps API key required</p>
          <p className="mt-2 text-muted-foreground">
            Add <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to load the live RoomZA map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[520px]">
      <APIProvider apiKey={apiKey} libraries={["geocoding", "places"]}>
        <MapContent
          listings={listings}
          selectedListingId={selectedListingId}
          onSelectListing={onSelectListing}
          onBoundsChange={onBoundsChange}
          initialCenter={initialCenter}
          searchQuery={searchQuery}
          onCenterNameChange={onCenterNameChange}
        />
        {children}
      </APIProvider>
    </div>
  );
}
