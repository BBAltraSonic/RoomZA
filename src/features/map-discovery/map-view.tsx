"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

type ListingPin = {
  id: string;
  title: string;
  area: string;
  price: string;
  coordinates: [number, number];
};

type ViewportBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

type MapViewProps = {
  accessToken?: string;
  listings: ListingPin[];
  selectedListingId?: string;
  onSelectListing?: (listingId: string) => void;
  onBoundsChange?: (bounds: ViewportBounds) => void;
};

const defaultCenter: [number, number] = [28.0473, -26.2041];

export function MapView({ accessToken, listings, selectedListingId, onSelectListing, onBoundsChange }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || !accessToken) {
      return;
    }

    mapboxgl.accessToken = accessToken;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: defaultCenter,
      zoom: 11,
      attributionControl: false,
    });

    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");
    map.on("error", () => setMapError("Map tiles could not load."));
    map.on("load", () => {
      const bounds = map.getBounds();

      if (!bounds) {
        return;
      }

      onBoundsChange?.({
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
      });
    });

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [accessToken, onBoundsChange]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    const handleMoveEnd = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        const bounds = map.getBounds();

        if (!bounds) {
          return;
        }

        onBoundsChange?.({
          west: bounds.getWest(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          north: bounds.getNorth(),
        });
      }, 250);
    };

    map.on("moveend", handleMoveEnd);

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      map.off("moveend", handleMoveEnd);
    };
  }, [onBoundsChange]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = listings.map((listing) => {
      const markerElement = document.createElement("button");
      markerElement.type = "button";
      markerElement.className = [
        "roomza-price-pin",
        listing.id === selectedListingId ? "roomza-price-pin-selected" : "",
      ].join(" ");
      markerElement.textContent = listing.price;
      markerElement.setAttribute("aria-label", `Open ${listing.title} in ${listing.area}`);
      markerElement.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelectListing?.(listing.id);
      });

      return new mapboxgl.Marker({ element: markerElement, anchor: "bottom" })
        .setLngLat(listing.coordinates)
        .addTo(map);
    });
  }, [listings, onSelectListing, selectedListingId]);

  useEffect(() => {
    const map = mapRef.current;
    const selectedListing = listings.find((listing) => listing.id === selectedListingId);

    if (!map || !selectedListing) {
      return;
    }

    map.flyTo({
      center: selectedListing.coordinates,
      essential: true,
      zoom: Math.max(map.getZoom(), 12),
      speed: 0.8,
    });
  }, [listings, selectedListingId]);

  if (!accessToken) {
    return (
      <div className="flex h-full min-h-[520px] items-center justify-center bg-[#d7e4df] p-6">
        <div className="max-w-sm rounded-lg border border-white/80 bg-white/90 p-4 text-sm shadow-lg shadow-black/10 backdrop-blur">
          <p className="font-semibold text-[#173b33]">Mapbox token required</p>
          <p className="mt-2 text-muted-foreground">
            Add `NEXT_PUBLIC_MAPBOX_TOKEN` to load the live RoomZA map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[520px]">
      <div ref={mapContainerRef} className="absolute inset-0" aria-label="RoomZA listing map" />
      {mapError ? (
        <div className="absolute left-4 top-4 rounded-lg border border-destructive/30 bg-white px-3 py-2 text-sm text-destructive shadow-sm">
          {mapError}
        </div>
      ) : null}
    </div>
  );
}
