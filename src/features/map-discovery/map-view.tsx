"use client";

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { Circle } from "./circle"; // Let's quickly create this wrapper or use Google Maps API directly.
import { type POIMarkerData } from "./hooks/use-overpass-pois";
import { POIMarker } from "./poi-marker";
import { ListingMarker } from "./mobile/listing-marker";
import { PropertyCard, SaveIconButton } from "@/components/premium/property-card";
import { useFavorites } from "./hooks/use-favorites";
import { X } from "lucide-react";
import { clusterMarkers, shouldClusterMarkers } from "./lib/cap";
import { cn } from "@/lib/utils";

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
};

type ViewportBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

type RecenterTarget = {
  lat: number;
  lng: number;
  /** Monotonic counter so repeated locate clicks to the same coords still trigger a recenter. */
  nonce: number;
};

export type MapViewProps = {
  apiKey?: string;
  listings: ListingPin[];
  selectedListingId?: string;
  onSelectListing?: (listingId: string) => void;
  onViewListing?: (listingId: string) => void;
  onBoundsChange?: (bounds: ViewportBounds) => void;
  initialCenter?: { lat: number; lng: number };
  searchQuery?: string;
  onCenterNameChange?: (name: string) => void;
  children?: React.ReactNode;
  poiMarkers?: POIMarkerData[];
  recenterTarget?: RecenterTarget | null;
  /**
   * When the full listing detail panel is open the map's InfoWindow becomes
   * pure duplication, so we suppress it to keep the map readable.
   */
  detailOpen?: boolean;
};

const defaultCenter = { lat: -26.2041, lng: 28.0473 };
const MAP_ID = "roomza-discovery-map";
const USER_CITY_ZOOM = 11;
const RECENTER_ZOOM = 14;

function MapContent({
  listings,
  selectedListingId,
  onSelectListing,
  onViewListing,
  onBoundsChange,
  initialCenter,
  searchQuery,
  onCenterNameChange,
  poiMarkers = [],
  recenterTarget,
  detailOpen = false,
}: Omit<MapViewProps, "apiKey">) {
  const map = useMap(MAP_ID);
  const geocodingLib = useMapsLibrary("geocoding");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hasCenteredOnUserCityRef = useRef(false);
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
  const geocoder = useMemo(
    () => geocodingLib ? new geocodingLib.Geocoder() : null,
    [geocodingLib],
  );
  const shouldRenderClusters = shouldClusterMarkers(listings.length);
  const markerClusters = useMemo(() => clusterMarkers(listings), [listings]);

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
        map.fitBounds(results[0].geometry.viewport);
      }
    });
  }, [geocoder, map, searchQuery]);

  useEffect(() => {
    if (
      !map ||
      initialCenter ||
      searchQuery ||
      selectedListingId ||
      hasCenteredOnUserCityRef.current ||
      typeof navigator === "undefined" ||
      !("geolocation" in navigator)
    ) {
      return;
    }

    hasCenteredOnUserCityRef.current = true;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selectedListingId]);

  // Recenter the map on an explicit target (e.g. the Locate_Button result).
  // Keyed on the nonce so repeated requests to the same coords still pan.
  useEffect(() => {
    if (!map || !recenterTarget) return;

    map.panTo({ lat: recenterTarget.lat, lng: recenterTarget.lng });
    map.setZoom(RECENTER_ZOOM);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, recenterTarget?.nonce]);

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
      {shouldRenderClusters
        ? markerClusters.map((cluster) => {
            const firstListing = cluster.markers[0];
            if (!firstListing) return null;

            return (
              <AdvancedMarker
                key={cluster.id}
                position={cluster.center}
                onClick={() => handleActivateListing(firstListing.id)}
              >
                {cluster.count > 1 ? (
                  <ClusterMarker count={cluster.count} onActivate={() => handleActivateListing(firstListing.id)} />
                ) : (
                  <ListingMarker
                    title={firstListing.title}
                    area={firstListing.area}
                    price={firstListing.price}
                    imageUrl={firstListing.imageUrl}
                    selected={firstListing.id === selectedListingId}
                    onActivate={() => handleActivateListing(firstListing.id)}
                  />
                )}
              </AdvancedMarker>
            );
          })
        : listings.map((listing) => (
            <AdvancedMarker
              key={listing.id}
              position={listing.coordinates}
              onClick={() => handleActivateListing(listing.id)}
            >
              <ListingMarker
                title={listing.title}
                area={listing.area}
                price={listing.price}
                imageUrl={listing.imageUrl}
                selected={listing.id === selectedListingId}
                onActivate={() => handleActivateListing(listing.id)}
              />
            </AdvancedMarker>
          ))}

      {/* Render POI markers for active layers */}
      {poiMarkers.map((poi) => (
        <POIMarker key={poi.id} poi={poi} />
      ))}

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
      {isDesktop && !detailOpen && selectedListingId && (
        <InfoWindow
          position={listings.find(l => l.id === selectedListingId)?.coordinates}
          onCloseClick={() => onSelectListing?.("")}
          headerDisabled={true}
          className="roomza-info-window"
        >
          {(() => {
            const selected = listings.find((l) => l.id === selectedListingId);
            if (!selected) return null;
            return (
              <MapInfoCardContent
                listing={selected}
                onView={() => onViewListing?.(selected.id)}
                onClose={() => onSelectListing?.("")}
              />
            );
          })()}
        </InfoWindow>
      )}
    </Map>
  );
}

function ClusterMarker({ count, onActivate }: { count: number; onActivate: () => void }) {
  return (
    <button
      type="button"
      onClick={onActivate}
      aria-label={`${count} listings clustered in this area`}
      className={cn(
        "flex size-12 items-center justify-center rounded-full border-0 bg-background text-sm font-extrabold text-forest shadow-[var(--neu-raised)] outline-none",
        "transition-[transform,box-shadow] duration-200 ease-[var(--ease-out-quart)] hover:scale-105 hover:shadow-[var(--neu-raised-lg)] focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2",
      )}
    >
      {count}
    </button>
  );
}

/**
 * MapInfoCardContent — the card rendered inside the Google Maps InfoWindow.
 *
 * Uses the compact {@link PropertyCard} variant so the popup stays light over
 * the map: a smaller thumbnail, price pill, title, beds/baths and address. The
 * richer full-width card is reserved for the left-hand listings panel.
 */
function MapInfoCardContent({
  listing,
  onView,
  onClose,
}: {
  listing: ListingPin;
  onView: () => void;
  onClose: () => void;
}) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorited = isFavorite(listing.id);

  return (
    <div className="w-64 shadow-[var(--elevation-3)] rounded-md relative group">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute right-2 top-2 z-[var(--z-controls)] flex size-7 items-center justify-center rounded-full bg-panel shadow-sm border border-border/50 text-ink/70 hover:text-ink hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 lg:opacity-100"
        aria-label="Close"
      >
        <X className="size-3.5" />
      </button>

      <PropertyCard
        compact
        showVideoCall={false}
        property={{
          id: listing.id,
          title: listing.title,
          area: listing.area,
          price: listing.fullPrice ?? listing.price,
          bedrooms: listing.bedrooms,
          bathrooms: listing.bathrooms,
          imageUrl: listing.imageUrl,
          imageUrls: listing.imageUrls,
          availabilityDate: listing.availabilityDate,
          createdAt: listing.createdAt,
        }}
        onSelect={onView}
        action={
          <SaveIconButton
            saved={favorited}
            onClick={(event) => {
              event.stopPropagation();
              toggleFavorite(listing.id);
            }}
          />
        }
      />
    </div>
  );
}

export function MapView({
  apiKey,
  listings,
  selectedListingId,
  onSelectListing,
  onViewListing,
  onBoundsChange,
  initialCenter,
  searchQuery,
  onCenterNameChange,
  poiMarkers,
  recenterTarget,
  detailOpen,
  children,
}: MapViewProps) {
  if (!apiKey) {
    return (
      <div className="flex h-full min-h-[520px] items-center justify-center bg-accent p-6">
        <div className="max-w-sm rounded-lg border border-border bg-panel p-4 text-sm shadow-[var(--elevation-1)]">
          <p className="font-semibold text-forest">Google Maps API key required</p>
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
          onViewListing={onViewListing}
          onBoundsChange={onBoundsChange}
          initialCenter={initialCenter}
          searchQuery={searchQuery}
          onCenterNameChange={onCenterNameChange}
          poiMarkers={poiMarkers}
          recenterTarget={recenterTarget}
          detailOpen={detailOpen}
        />
        {children}
      </APIProvider>
    </div>
  );
}
