"use client";

import { AlertTriangle, CalendarDays, Search, X } from "lucide-react";
import { Component, type ReactNode, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { NavigationTabs } from "@/components/navigation/navigation";
import { PropertyCard, SaveIconButton } from "@/components/premium/property-card";
import { authPathForRedirect, onboardingPathForRedirect } from "@/lib/redirects";
import type { Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

import { ListingDetailPanel, type ListingDetail } from "./listing-detail-panel";
import { MapControls } from "./map-controls";
import { MapView } from "./map-view";
import { EmptyStateCapture } from "./empty-state-capture";
import { useFavorites } from "./hooks/use-favorites";
import { useOverpassPois } from "./hooks/use-overpass-pois";
import { FilterBar, type FilterState } from "./filter-bar";
import { LayerTogglePanel } from "./layer-toggle-panel";
import { DiscoverySpotlight } from "./discovery-spotlight";
import { capListings } from "./lib/cap";
import { haversineKm } from "./lib/distance";
import { mostNearestSort } from "./lib/sort";
import type { GeoPoint, ListingCardModel } from "./lib/types";
import { MobileDiscoveryShell } from "./mobile/mobile-discovery-shell";

type Listing = {
  id: string;
  title: string;
  area: string;
  price: string;
  fullPrice: string;
  /** Numeric price source (Listing.price is formatted) used by the card model pipeline. */
  priceValue: number;
  beds: number;
  baths: number;
  coordinates: { lat: number; lng: number };
  imageUrls: string[];
  availabilityDate: string | null;
  createdAt: string | null;
};

type DiscoveryPageProps = {
  googleMapsApiKey?: string;
  initialListing?: ListingDetail | null;
  initialIntent?: "apply" | "message";
  hideSidebar?: boolean;
  currentRole?: Role | null;
  isAuthenticated?: boolean;
};

type ViewportBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

type ViewportListingResponse = {
  ok: true;
  data: {
    listings: ViewportListing[];
  };
  requestId?: string;
};

type ListingDetailResponse = {
  ok: true;
  data: ListingDetail;
  requestId?: string;
};

type ViewportListing = {
    id: string;
    title: string;
    area: string;
    price: number;
    latitude: number;
    longitude: number;
    bedrooms: number;
    bathrooms: number;
    imageUrls: string[];
    availabilityDate: string | null;
    created_at: string | null;
};

function formatPrice(price: number) {
  return `R${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(price)}`;
}

function formatFullPrice(price: number) {
  return `R ${new Intl.NumberFormat("en-ZA").format(price)}`;
}



function toListing(pin: ViewportListing): Listing {
  return {
    id: pin.id,
    title: pin.title,
    area: pin.area,
    price: formatPrice(pin.price),
    fullPrice: formatFullPrice(pin.price),
    priceValue: Number(pin.price),
    beds: Number(pin.bedrooms),
    baths: Number(pin.bathrooms),
    coordinates: { lat: pin.latitude, lng: pin.longitude },
    imageUrls: pin.imageUrls || [],
    availabilityDate: pin.availabilityDate,
    createdAt: pin.created_at,
  };
}

function ListingPropertyCard({
  listing,
  isSelected,
  onSelect,
  compact,
}: {
  listing: Listing;
  isSelected?: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorited = isFavorite(listing.id);

  return (
    <PropertyCard
      compact={compact}
      property={{
        id: listing.id,
        title: listing.title,
        area: listing.area,
        price: listing.fullPrice,
        bedrooms: listing.beds,
        bathrooms: listing.baths,
        imageUrl: listing.imageUrls[0],
        availabilityDate: listing.availabilityDate,
        createdAt: listing.createdAt,
      }}
      selected={isSelected}
      onSelect={onSelect}
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
  );
}



// Responsive 1024px boundary store (Req 8.5, 8.6). Subscribing to matchMedia via
// useSyncExternalStore keeps isDesktop in sync with the viewport without a
// setState-in-effect cascade. SSR snapshot is false so server/first client
// render agree; the client snapshot reflects the live media query.
const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";

function subscribeIsDesktop(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const query = window.matchMedia(DESKTOP_MEDIA_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getIsDesktopSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}

function getIsDesktopServerSnapshot(): boolean {
  return false;
}

// Minimal local error boundary (Req 10.3): the DiscoverySpotlight hosts the
// Value_Proposition + Primary_Search_CTA. Its content is static (no async
// load), so there is no real fetch-failure path, but this guards against a
// render failure so the page/map stay usable. On error it renders a tiny,
// non-blocking inline notice (positioned out of the way) while the visitor
// remains at `/` — nothing navigates.
class SpotlightErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="pointer-events-none fixed inset-x-0 top-0 z-[var(--z-chrome)] flex justify-center px-4 pt-[max(env(safe-area-inset-top),1rem)]"
        >
          <p className="pointer-events-auto rounded-lg border border-border bg-panel/95 px-3 py-2 text-xs text-ink shadow-sm backdrop-blur-md">
            We couldn&apos;t load the welcome panel. The map is still available below.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}



export function DiscoveryPage({ googleMapsApiKey, initialListing, initialIntent, hideSidebar = false, currentRole, isAuthenticated = false }: DiscoveryPageProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const urlQuery = searchParams.get("q") ?? "";
  const mobileChromeRef = useRef<HTMLElement | null>(null);
  const mobileLayerPanelRef = useRef<HTMLDivElement | null>(null);
  const listingRequestRef = useRef<AbortController | null>(null);
  const [visibleListings, setVisibleListings] = useState<Listing[]>([]);
  const [selectedListingId, setSelectedListingId] = useState<string | undefined>(initialListing?.id);
  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [mapLocationName, setMapLocationName] = useState("");
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds | null>(null);
  const [isLoadingListings, setIsLoadingListings] = useState(false);
  const [listingError, setListingError] = useState<string | null>(null);
  const [detailListing, setDetailListing] = useState<ListingDetail | null>(initialListing ?? null);
  const [activeLayers, setActiveLayers] = useState<Set<string>>(new Set());
  const [isLayersPanelOpen, setIsLayersPanelOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showSpotlight, setShowSpotlight] = useState(true);
  // Responsive 1024px boundary (Req 8.5, 8.6): CSS (`lg:`) already swaps the
  // mobile shell and desktop aside instantly. This mirrors that boundary into
  // React state so JS-side behavior (e.g. which search input the spotlight
  // focuses) re-evaluates when the viewport crosses 1024px, within the 500ms
  // budget. Render stays at `/` either way — this never navigates.
  const isDesktop = useSyncExternalStore(
    subscribeIsDesktop,
    getIsDesktopSnapshot,
    getIsDesktopServerSnapshot,
  );
  // Distance origin for the card model pipeline (Req 6.3, Data Gap 2):
  // best-effort visitor geolocation; falls back to the current map center
  // (derived from viewportBounds), else null => distanceKm is null.
  const [geoOrigin, setGeoOrigin] = useState<GeoPoint | null>(null);
  // Recenter target forwarded to MapView when the visitor uses the Locate_Button.
  // The nonce increments on every successful locate so repeated clicks to the
  // same coordinates still trigger a recenter (Req 2.5).
  const [recenterTarget, setRecenterTarget] = useState<
    { lat: number; lng: number; nonce: number } | null
  >(null);
  const desktopSearchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

  const { pois } = useOverpassPois(activeLayers, viewportBounds);

  const [filters, setFilters] = useState<FilterState>(() => ({
    price: {
      min: searchParams.has("minPrice") ? Number(searchParams.get("minPrice")) : undefined,
      max: searchParams.has("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined,
    },
    beds: searchParams.has("beds") ? Number(searchParams.get("beds")) : undefined,
    baths: searchParams.has("baths") ? Number(searchParams.get("baths")) : undefined,
    propertyTypes: searchParams.get("type") ? searchParams.get("type")!.split(",") : undefined,
    petFriendly: searchParams.get("petFriendly") === "true" ? true : undefined,
  }));

  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
    const params = new URLSearchParams(searchParams.toString());

    if (newFilters.price?.min) params.set("minPrice", newFilters.price.min.toString());
    else params.delete("minPrice");

    if (newFilters.price?.max) params.set("maxPrice", newFilters.price.max.toString());
    else params.delete("maxPrice");

    if (newFilters.beds) params.set("beds", newFilters.beds.toString());
    else params.delete("beds");

    if (newFilters.baths) params.set("baths", newFilters.baths.toString());
    else params.delete("baths");

    if (newFilters.propertyTypes && newFilters.propertyTypes.length > 0) params.set("type", newFilters.propertyTypes.join(","));
    else params.delete("type");

    if (newFilters.petFriendly) params.set("petFriendly", "true");
    else params.delete("petFriendly");

    if (searchQuery) params.set("q", searchQuery);
    else params.delete("q");

    if (newFilters.layerPresets) {
      const nextLayers = new Set(activeLayers);
      newFilters.layerPresets.forEach(preset => nextLayers.add(preset));
      setActiveLayers(nextLayers);
      if (newFilters.layerPresets.length > 0) {
        setIsLayersPanelOpen(true);
      }
    }

    router.replace(`${pathname}?${params.toString()}`);
  }, [searchParams, pathname, router, searchQuery, activeLayers]);

  const toggleLayer = useCallback((layerId: string) => {
    setActiveLayers(prev => {
      const next = new Set(prev);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
  }, []);

  const initialCenter = useMemo(() => {
    if (!initialListing) return undefined;
    return { lat: initialListing.latitude, lng: initialListing.longitude };
  }, [initialListing]);

  const handleSelectListing = useCallback((listingId: string) => {
    setSelectedListingId(listingId);
  }, []);

  const handleViewDetail = useCallback((listingId: string) => {
    setSelectedListingId(listingId);
    fetch(`/api/listings/${listingId}`)
      .then(async (res) => {
        if (!res.ok) return;
        const payload = (await res.json()) as ListingDetailResponse;
        setDetailListing(payload.data);
      })
      .catch(() => {
        setListingError("Listing details could not be loaded.");
      });
  }, []);

  const hasAutoOpened = useRef(false);
  useEffect(() => {
    const listingIdParam = searchParams.get("listingId");
    if (listingIdParam && !hasAutoOpened.current) {
      hasAutoOpened.current = true;
      handleViewDetail(listingIdParam);
    }
  }, [searchParams, handleViewDetail]);

  const submitSearch = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (searchQuery) {
      params.set("q", searchQuery);
    } else {
      params.delete("q");
    }
    router.replace(`${pathname}?${params.toString()}`);
  }, [searchParams, searchQuery, router, pathname]);

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    submitSearch();
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    router.replace(`${pathname}?${params.toString()}`);
  };

  useEffect(() => {
    if (!viewportBounds) return;

    listingRequestRef.current?.abort();

    const controller = new AbortController();
    listingRequestRef.current = controller;
    const bbox = [viewportBounds.west, viewportBounds.south, viewportBounds.east, viewportBounds.north]
      .map((coordinate) => coordinate.toFixed(6))
      .join(",");

    queueMicrotask(() => {
      setIsLoadingListings(true);
      setListingError(null);
    });

    const queryParams = new URLSearchParams(searchParams.toString());
    queryParams.set("bbox", bbox);

    // Req 5.8: bound the request to 30s. When the timer fires we abort the
    // controller and flag `didTimeOut` so the resulting AbortError is treated
    // as a real failure (error indication + retain cards), distinguishing it
    // from a supersession abort (a newer bounds/search change), which stays
    // silent.
    let didTimeOut = false;
    const timeoutId = setTimeout(() => {
      didTimeOut = true;
      controller.abort();
    }, 30000);

    fetch(`/api/listings?${queryParams.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load visible listings.");
        return (await response.json()) as ViewportListingResponse;
      })
      .then((payload) => {
        const nextListings = payload.data.listings.map(toListing);
        setVisibleListings(nextListings);
        setSelectedListingId((currentId) =>
          nextListings.some((listing) => listing.id === currentId) ? currentId : undefined,
        );
      })
      .catch((error: unknown) => {
        // A supersession abort (newer request) is silent; only a timeout-driven
        // abort surfaces an error. Either way `visibleListings` is left intact
        // so previously shown cards are retained (Req 5.8).
        if (error instanceof DOMException && error.name === "AbortError") {
          if (didTimeOut) {
            setListingError("Visible listings could not be loaded.");
          }
          return;
        }
        setListingError("Visible listings could not be loaded.");
      })
      .finally(() => {
        clearTimeout(timeoutId);
        if (listingRequestRef.current === controller) {
          listingRequestRef.current = null;
          setIsLoadingListings(false);
        }
      });
  }, [viewportBounds, searchParams]);

  useEffect(() => {
    return () => listingRequestRef.current?.abort();
  }, []);

  // Best-effort visitor geolocation for the distance origin (Req 6.3, Data Gap 2).
  // Non-blocking: on success we record the coordinates; on denial/timeout/error
  // we leave geoOrigin null and fall back to the map center (see distanceOrigin).
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        setGeoOrigin({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        // Ignore errors/denial — distance falls back to the map center or null.
      },
      { timeout: 10000 },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Resolve the distance origin: visitor geolocation when available, else the
  // current map center, else null. The map center is computed as the midpoint
  // of the current viewportBounds (west/east, south/north) since the camera
  // exposes its bounds rather than a center coordinate.
  const distanceOrigin = useMemo<GeoPoint | null>(() => {
    if (geoOrigin) return geoOrigin;
    if (viewportBounds) {
      return {
        lat: (viewportBounds.south + viewportBounds.north) / 2,
        lng: (viewportBounds.west + viewportBounds.east) / 2,
      };
    }
    return null;
  }, [geoOrigin, viewportBounds]);

  // Card model pipeline (Req 3.2, 5.2, 6.3, 6.5):
  // cap -> map to ListingCardModel (numeric price, nullable rating/reviewCount,
  // haversine distance from the origin) -> "Most Nearest" sort.
  const cards = useMemo<ListingCardModel[]>(() => {
    const capped = capListings(visibleListings);
    const models = capped.map<ListingCardModel>((listing) => ({
      id: listing.id,
      title: listing.title,
      imageUrls: listing.imageUrls,
      price: listing.priceValue,
      bedrooms: listing.beds,
      bathrooms: listing.baths,
      // Data Gap 1: rating/reviewCount are not in the API today — nullable,
      // hidden by the card when absent.
      rating: null,
      reviewCount: null,
      distanceKm: distanceOrigin
        ? haversineKm(distanceOrigin, { lat: listing.coordinates.lat, lng: listing.coordinates.lng })
        : null,
    }));
    return mostNearestSort(models);
  }, [visibleListings, distanceOrigin]);

  // Derive the map markers from the SAME sorted+capped order as the cards so
  // marker and card indices align (Req 3.4). Markers carry a single thumbnail
  // (imageUrl) for the rounded ListingMarker visual (Req 3.3), ordered to match
  // `cards`.
  const markerListings = useMemo(() => {
    const byId = new Map(visibleListings.map((listing) => [listing.id, listing]));
    return cards
      .map((card) => byId.get(card.id))
      .filter((listing): listing is Listing => listing !== undefined)
      .map((listing) => ({
        id: listing.id,
        title: listing.title,
        area: listing.area,
        price: listing.price,
        coordinates: listing.coordinates,
        imageUrl: listing.imageUrls[0] ?? null,
      }));
  }, [cards, visibleListings]);

  // App_Bar Back_Button: return to the previous page when there is history,
  // otherwise fall back to the home route (Req 1.4).
  const handleBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }, [router]);

  // Locate_Button (Req 2.5, 2.6): request the visitor's current location,
  // bounded to 10s via Promise.race. On success, recenter the map (panTo +
  // zoom) within ~2s by bumping the recenterTarget nonce, and update geoOrigin
  // so distances recompute. On denial/timeout/error, show a non-blocking
  // "Current location unavailable" toast and leave the map center/zoom intact.
  const handleLocate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Current location unavailable");
      return;
    }

    const locate = new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
    });

    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("timeout")), 10000);
    });

    Promise.race([locate, timeout])
      .then((position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setGeoOrigin(coords);
        setRecenterTarget((prev) => ({ ...coords, nonce: (prev?.nonce ?? 0) + 1 }));
      })
      .catch(() => {
        toast.error("Current location unavailable");
      });
  }, []);

  // Carousel retry (Req 5.9): re-trigger the bbox fetch by re-setting
  // viewportBounds to a fresh object copy so the fetch effect re-runs. The
  // effect aborts any in-flight request, creates a new AbortController, and via
  // the queueMicrotask sets isLoadingListings true + clears the error, so the
  // loading indication shows. Previous cards remain in visibleListings until a
  // successful response replaces them (Req 5.8 retention).
  const handleRetry = useCallback(() => {
    setListingError(null);
    setViewportBounds((prev) => (prev ? { ...prev } : prev));
  }, []);

  // See_All: the BottomSheet already expands itself to its max snap and switches
  // the carousel to the in-place full list (Data Gap 3 default). No route change.
  const handleSeeAll = useCallback(() => {
    // No-op beyond the sheet's own expand; in-place expansion is handled in the
    // shell/sheet. Kept as a named handler for future wiring.
  }, []);

  const homesLabel = isLoadingListings
    ? "Loading homes in view"
    : `${visibleListings.length} ${visibleListings.length === 1 ? "home" : "homes"} in view`;
  const addListingHref =
    currentRole === "landlord"
      ? "/dashboard/listings/new"
      : currentRole === "renter"
        ? null
        : isAuthenticated
          ? onboardingPathForRedirect("/dashboard/listings/new")
          : authPathForRedirect("/dashboard/listings/new");

  return (
    <main className="relative h-screen overflow-hidden bg-background text-ink">
      <h1 className="sr-only">Homes in view</h1>

      <div className="absolute inset-0 z-[var(--z-map)]">
        <MapView
          apiKey={googleMapsApiKey}
          listings={markerListings}
          selectedListingId={selectedListingId}
          onSelectListing={handleSelectListing}
          onBoundsChange={setViewportBounds}
          onCenterNameChange={setMapLocationName}
          initialCenter={initialCenter}
          searchQuery={urlQuery}
          poiMarkers={pois}
          recenterTarget={recenterTarget}
        >
          <MapControls 
            className="absolute top-24 z-[var(--z-controls)] lg:top-[140px]" 
            onLayersClick={() => setIsLayersPanelOpen(!isLayersPanelOpen)}
            activeLayerCount={activeLayers.size}
          />
          <div ref={mobileLayerPanelRef} className="fixed inset-x-3 top-[5.75rem] z-[var(--z-chrome)] lg:absolute lg:inset-x-auto lg:right-[calc(var(--sidebar-offset-lg)+4rem)] lg:top-[140px] lg:z-[var(--z-controls)] xl:right-[calc(var(--sidebar-offset-xl)+4rem)]">
            <LayerTogglePanel 
              isOpen={isLayersPanelOpen}
              onClose={() => setIsLayersPanelOpen(false)}
              activeLayers={activeLayers}
              onToggleLayer={toggleLayer}
              className="w-full max-h-[min(46dvh,360px)] rounded-xl lg:w-[320px] lg:max-h-[80vh] lg:rounded-2xl"
            />
          </div>
          <div className="pointer-events-none absolute left-4 top-[140px] z-[var(--z-controls)] hidden lg:flex lg:flex-col lg:items-start lg:gap-2">
            <div className="pointer-events-auto rounded-xl border border-border bg-panel/95 p-3 shadow-[var(--elevation-2)] backdrop-blur-md">
              <FilterBar filters={filters} onFilterChange={handleFilterChange} />
            </div>
          </div>
        </MapView>
      </div>

      <header
        ref={mobileChromeRef}
        className={cn(
          "pointer-events-none absolute left-0 top-0 z-[var(--z-chrome)] px-4 pb-4 pt-4",
          hideSidebar ? "right-0" : "right-0 lg:right-[calc(var(--sidebar-w-lg)+1rem)] xl:right-[calc(var(--sidebar-w-xl)+1rem)]",
        )}
        style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)" }}
      >
        {/* Desktop: full chrome bar */}
        <div className="pointer-events-auto hidden gap-4 rounded-xl border border-border bg-panel/95 p-4 shadow-2xl backdrop-blur-md lg:grid lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center animate-in fade-in slide-in-from-top-4 duration-500 ease-[var(--ease-out-quart)]">
          <NavigationTabs className="flex" currentRole={currentRole} />

          <form role="search" className="flex min-w-0 items-center gap-3 rounded-lg border border-input bg-warm-surface px-4 py-3 shadow-sm transition-colors focus-within:border-forest focus-within:ring-1 focus-within:ring-forest" onSubmit={handleSearchSubmit}>
            <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              ref={desktopSearchInputRef}
              type="search"
              className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted-foreground"
              placeholder="Search neighbourhood or city"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label="Search listings"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={handleClearSearch}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-ink active:scale-95"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </form>

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">
                {searchQuery || mapLocationName || "South Africa"}
              </p>
              <p className="text-xs text-muted-foreground">{homesLabel}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile (<1024px) chrome — composed by MobileDiscoveryShell (Req 8.1,
          8.2, 10.1). Replaces the former inline floating search pill, mobile
          filter bar, and inline bottom sheet. The map stays mounted behind it. */}
      <MobileDiscoveryShell
        onBack={handleBack}
        screenTitle="Listings Near You"
        searchQuery={searchQuery}
        onSearchChange={(value) => setSearchQuery(value)}
        onSearchSubmit={submitSearch}
        onClearSearch={handleClearSearch}
        onToggleFilters={() => setShowFilters((value) => !value)}
        filtersActive={showFilters}
        onLocate={handleLocate}
        searchInputRef={mobileSearchInputRef}
        cards={cards}
        selectedListingId={selectedListingId}
        isLoading={isLoadingListings}
        error={listingError}
        onRetry={handleRetry}
        onSelectCard={handleViewDetail}
        onSeeAll={handleSeeAll}
        activeNav="discovery"
      >
        {/* Mobile Filter Bar overlay — rendered under the App_Bar/SearchRegion
            so tab order stays correct. */}
        {showFilters ? (
          <div
            className="pointer-events-none fixed inset-x-0 z-[var(--z-chrome)] px-4"
            style={{ top: "calc(var(--mobile-safe-top) + 7.5rem)" }}
          >
            <div className="pointer-events-auto mx-auto w-full max-w-[440px] animate-in fade-in slide-in-from-top-2 duration-200 ease-[var(--ease-out-quart)]">
              <div className="rounded-2xl border border-border/60 bg-panel/95 p-3 shadow-lg backdrop-blur-md">
                <FilterBar filters={filters} onFilterChange={handleFilterChange} />
              </div>
            </div>
          </div>
        ) : null}
      </MobileDiscoveryShell>

      {/* Discovery Spotlight — hero modal on every visit */}
      {showSpotlight ? (
        <SpotlightErrorBoundary>
          <DiscoverySpotlight
            onDismiss={() => setShowSpotlight(false)}
            onSearchFocus={() => {
              // Focus the appropriate search input for the viewport, using the
              // matchMedia-backed isDesktop state (Req 8.5, 8.6).
              requestAnimationFrame(() => {
                if (isDesktop) {
                  desktopSearchInputRef.current?.focus();
                } else {
                  mobileSearchInputRef.current?.focus();
                }
              });
            }}
            locationName={searchQuery || mapLocationName || "South Africa"}
            homesCount={visibleListings.length}
            isLoading={isLoadingListings}
          />
        </SpotlightErrorBoundary>
      ) : null}


      <aside
        className={cn(
          "absolute bottom-4 right-4 top-4 z-[var(--z-controls)] hidden w-[var(--sidebar-w-lg)] flex-col overflow-hidden rounded-[32px] border border-border bg-panel shadow-[var(--elevation-3)] lg:flex xl:w-[var(--sidebar-w-xl)]",
          hideSidebar && "lg:hidden",
        )}
      >
        {detailListing ? (
          <div className="flex h-full flex-col animate-in fade-in slide-in-from-right-8 duration-200 ease-[var(--ease-out-quart)]">
            <ListingDetailPanel listing={detailListing} initialIntent={initialIntent} onBack={() => setDetailListing(null)} />
          </div>
        ) : (
          <div className="flex h-full flex-col animate-in fade-in slide-in-from-bottom-8 duration-500 ease-[var(--ease-out-quart)]">
            <div className="border-b border-border bg-warm-surface/30 px-6 py-8">
              <div className="mb-6 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-forest">RoomZA Discovery</p>
                <div className="flex items-center gap-2">
                  {addListingHref ? (
                    <Link href={addListingHref} className="flex h-9 items-center justify-center rounded-md bg-forest px-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-forest/90">
                      Add listing
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    className="flex size-9 items-center justify-center rounded-md border border-border bg-panel text-ink shadow-sm transition-colors hover:bg-muted"
                    aria-label="Viewing calendar"
                  >
                    <CalendarDays className="size-4" />
                  </button>
                </div>
              </div>
              <h2 className="text-4xl font-extrabold tracking-tight text-ink">
                Find your<br />next home.
              </h2>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-hide">
              {listingError ? (
                <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <p>{listingError}</p>
                </div>
              ) : null}

              {isLoadingListings && visibleListings.length === 0 ? (
                [1, 2, 3].map((item) => (
                  <div key={item} className="h-64 animate-pulse rounded-lg border border-border bg-muted" />
                ))
              ) : null}

              {visibleListings.length === 0 && !isLoadingListings && !listingError ? (
                <EmptyStateCapture bbox={viewportBounds} filters={filters} compact={false} />
              ) : null}

              {visibleListings.map((listing) => (
                <ListingPropertyCard
                  key={listing.id}
                  listing={listing}
                  isSelected={selectedListingId === listing.id}
                  onSelect={() => handleViewDetail(listing.id)}
                />
              ))}
            </div>
          </div>
        )}
      </aside>

      {detailListing ? (
        <div
          className="fixed inset-x-0 bottom-0 z-[var(--z-detail-mobile)] overflow-hidden rounded-t-2xl bg-panel shadow-[var(--elevation-3)] animate-in fade-in slide-in-from-bottom-12 duration-300 ease-[var(--ease-out-quart)] lg:hidden"
          style={{ top: "max(env(safe-area-inset-top), 0.25rem)" }}
        >
          <div className="h-full overflow-y-auto">
            <ListingDetailPanel listing={detailListing} initialIntent={initialIntent} onBack={() => setDetailListing(null)} />
          </div>
        </div>
      ) : null}
    </main>
  );
}
