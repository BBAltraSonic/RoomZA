"use client";

import { AlertTriangle, CalendarDays, Search, X, Filter } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

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

type Listing = {
  id: string;
  title: string;
  area: string;
  price: string;
  fullPrice: string;
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

type MobileSheetState = "peek" | "expanded";

const MOBILE_SHEET_MIN_HEIGHT = 176;
const MOBILE_SHEET_GAP = 12;
const MOBILE_SHEET_EXPANDED_RATIO = 0.72;
const MOBILE_SHEET_PEEK_RATIO = 0.46;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getMobilePeekHeight(viewportHeight: number, maxHeight: number) {
  return Math.min(maxHeight, Math.max(MOBILE_SHEET_MIN_HEIGHT, viewportHeight * MOBILE_SHEET_PEEK_RATIO));
}

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



export function DiscoveryPage({ googleMapsApiKey, initialListing, initialIntent, hideSidebar = false, currentRole, isAuthenticated = false }: DiscoveryPageProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const urlQuery = searchParams.get("q") ?? "";
  const mobileChromeRef = useRef<HTMLElement | null>(null);
  const mobileLayerPanelRef = useRef<HTMLDivElement | null>(null);
  const mobileSheetDragRef = useRef({
    isDragging: false,
    startY: 0,
    startHeight: 0,
    didDrag: false,
  });
  const listingRequestRef = useRef<AbortController | null>(null);
  const [visibleListings, setVisibleListings] = useState<Listing[]>([]);
  const [selectedListingId, setSelectedListingId] = useState<string | undefined>(initialListing?.id);
  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [mobileSheetState, setMobileSheetState] = useState<MobileSheetState>("peek");
  const [mobileSheetHeight, setMobileSheetHeight] = useState<number | null>(null);
  const [mobileSheetMaxHeight, setMobileSheetMaxHeight] = useState<number | null>(null);
  const [isMobileSheetDragging, setIsMobileSheetDragging] = useState(false);
  const [mapLocationName, setMapLocationName] = useState("");
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds | null>(null);
  const [isLoadingListings, setIsLoadingListings] = useState(false);
  const [listingError, setListingError] = useState<string | null>(null);
  const [detailListing, setDetailListing] = useState<ListingDetail | null>(initialListing ?? null);
  const [activeLayers, setActiveLayers] = useState<Set<string>>(new Set());
  const [isLayersPanelOpen, setIsLayersPanelOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showSpotlight, setShowSpotlight] = useState(true);
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
    setMobileSheetState("peek");
  }, []);

  const handleViewDetail = useCallback((listingId: string) => {
    setSelectedListingId(listingId);
    setMobileSheetState("peek");
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

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (searchQuery) {
      params.set("q", searchQuery);
    } else {
      params.delete("q");
    }
    router.replace(`${pathname}?${params.toString()}`);
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
        if (error instanceof DOMException && error.name === "AbortError") return;
        setListingError("Visible listings could not be loaded.");
      })
      .finally(() => {
        if (listingRequestRef.current === controller) {
          listingRequestRef.current = null;
          setIsLoadingListings(false);
        }
      });
  }, [viewportBounds, searchParams]);

  useEffect(() => {
    return () => listingRequestRef.current?.abort();
  }, []);

  const updateMobileSheetBounds = useCallback(() => {
    if (typeof window === "undefined" || window.innerWidth >= 1024) return;

    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const chromeBottoms = [mobileChromeRef.current?.getBoundingClientRect().bottom ?? 0];

    if (isLayersPanelOpen) {
      chromeBottoms.push(mobileLayerPanelRef.current?.getBoundingClientRect().bottom ?? 0);
    }

    const chromeBottom = Math.max(...chromeBottoms);
    const availableHeight = viewportHeight - chromeBottom - MOBILE_SHEET_GAP;
    const maxHeight = Math.round(
      clamp(
        availableHeight,
        MOBILE_SHEET_MIN_HEIGHT,
        viewportHeight * MOBILE_SHEET_EXPANDED_RATIO,
      ),
    );
    const targetHeight =
      mobileSheetState === "expanded" ? maxHeight : Math.round(getMobilePeekHeight(viewportHeight, maxHeight));

    setMobileSheetMaxHeight(maxHeight);
    if (!mobileSheetDragRef.current.isDragging) {
      setMobileSheetHeight(targetHeight);
    }
  }, [isLayersPanelOpen, mobileSheetState]);

  useEffect(() => {
    updateMobileSheetBounds();

    const viewport = window.visualViewport;
    const observer = new ResizeObserver(() => updateMobileSheetBounds());
    if (mobileChromeRef.current) observer.observe(mobileChromeRef.current);
    if (mobileLayerPanelRef.current) observer.observe(mobileLayerPanelRef.current);

    window.addEventListener("resize", updateMobileSheetBounds);
    viewport?.addEventListener("resize", updateMobileSheetBounds);

    const animationFrame = requestAnimationFrame(updateMobileSheetBounds);

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      window.removeEventListener("resize", updateMobileSheetBounds);
      viewport?.removeEventListener("resize", updateMobileSheetBounds);
    };
  }, [showFilters, isLayersPanelOpen, updateMobileSheetBounds]);

  const handleMobileSheetToggle = () => {
    if (mobileSheetDragRef.current.didDrag) {
      mobileSheetDragRef.current.didDrag = false;
      return;
    }

    setMobileSheetState((prev) => (prev === "expanded" ? "peek" : "expanded"));
  };

  const handleMobileSheetHandlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.preventDefault();

    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const maxHeight = mobileSheetMaxHeight ?? viewportHeight * MOBILE_SHEET_EXPANDED_RATIO;
    const startHeight = mobileSheetHeight ?? getMobilePeekHeight(viewportHeight, maxHeight);
    let nextHeight = startHeight;

    mobileSheetDragRef.current = {
      isDragging: true,
      startY: event.clientY,
      startHeight,
      didDrag: false,
    };
    setIsMobileSheetDragging(true);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const delta = mobileSheetDragRef.current.startY - moveEvent.clientY;
      if (Math.abs(delta) > 6) {
        mobileSheetDragRef.current.didDrag = true;
      }

      nextHeight = Math.round(
        clamp(
          mobileSheetDragRef.current.startHeight + delta,
          MOBILE_SHEET_MIN_HEIGHT,
          maxHeight,
        ),
      );
      setMobileSheetHeight(nextHeight);
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);

      mobileSheetDragRef.current.isDragging = false;
      setIsMobileSheetDragging(false);

      const peekHeight = getMobilePeekHeight(viewportHeight, maxHeight);
      const nextState = nextHeight > (peekHeight + maxHeight) / 2 ? "expanded" : "peek";
      setMobileSheetState(nextState);
      setMobileSheetHeight(Math.round(nextState === "expanded" ? maxHeight : peekHeight));
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  };

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
          listings={visibleListings}
          selectedListingId={selectedListingId}
          onSelectListing={handleSelectListing}
          onBoundsChange={setViewportBounds}
          onCenterNameChange={setMapLocationName}
          initialCenter={initialCenter}
          searchQuery={urlQuery}
          poiMarkers={pois}
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
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-md transition-all duration-200 active:scale-95",
                showFilters 
                  ? "bg-ink text-panel shadow-sm" 
                  : "text-muted-foreground hover:bg-muted hover:text-ink"
              )}
              aria-label="Toggle filters"
            >
              <Filter className="size-4.5" />
            </button>
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

        {/* Desktop Filter Bar */}
        {showFilters && (
          <div className="pointer-events-auto mt-3 hidden animate-in fade-in slide-in-from-top-2 duration-200 ease-[var(--ease-out-quart)] lg:block">
            <div className="rounded-xl border border-border bg-panel/95 p-3 shadow-lg backdrop-blur-md">
              <FilterBar filters={filters} onFilterChange={handleFilterChange} />
            </div>
          </div>
        )}

        {/* Mobile: floating search pill */}
        <form
          role="search"
          className="pointer-events-auto mr-12 flex items-center gap-3 rounded-2xl border border-border/80 bg-panel/95 px-4 py-3.5 shadow-xl backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-500 ease-[var(--ease-out-quart)] lg:hidden"
          onSubmit={handleSearchSubmit}
        >
          <Search className="size-5 shrink-0 text-ink" aria-hidden="true" />
          <input
            ref={mobileSearchInputRef}
            type="search"
            className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-ink outline-none placeholder:text-muted-foreground"
            placeholder="Search by locations"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            aria-label="Search by locations"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={handleClearSearch}
              className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground transition-all duration-200 hover:text-ink active:scale-95"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full transition-all duration-200 active:scale-95",
              showFilters 
                ? "scale-105 bg-ink text-panel shadow-sm" 
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-ink"
            )}
            aria-label="Toggle filters"
          >
            <Filter className="size-4" />
          </button>
        </form>

        {/* Mobile Filter Bar */}
        {showFilters && (
          <div className="pointer-events-auto mr-12 mt-3 animate-in fade-in slide-in-from-top-2 duration-200 ease-[var(--ease-out-quart)] lg:hidden">
            <div className="rounded-2xl border border-border/60 bg-panel/95 p-3 shadow-lg backdrop-blur-md">
              <FilterBar filters={filters} onFilterChange={handleFilterChange} />
            </div>
          </div>
        )}
      </header>

      {/* Discovery Spotlight — hero modal on every visit */}
      {showSpotlight ? (
        <DiscoverySpotlight
          onDismiss={() => setShowSpotlight(false)}
          onSearchFocus={() => {
            // Focus the appropriate search input for the viewport
            requestAnimationFrame(() => {
              if (window.innerWidth >= 1024) {
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

      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-controls)] lg:hidden",
          detailListing && "hidden",
        )}
      >
        <section className={cn(
          "pointer-events-auto mx-auto flex w-full max-w-[440px] flex-col overflow-hidden rounded-t-[32px] bg-panel shadow-[var(--elevation-3)] ease-[var(--ease-out-quart)]",
          isMobileSheetDragging ? "transition-none" : "transition-[height,max-height] duration-200",
        )}
        style={{
          height: mobileSheetHeight ? `${mobileSheetHeight}px` : undefined,
          maxHeight: mobileSheetMaxHeight ? `${mobileSheetMaxHeight}px` : "72dvh",
        }}
        >
          <button
            type="button"
            onClick={handleMobileSheetToggle}
            onPointerDown={handleMobileSheetHandlePointerDown}
            className="flex w-full touch-none select-none items-center justify-center px-4 pb-2 pt-3"
            aria-label={mobileSheetState === "expanded" ? "Collapse listings" : "Expand listings"}
          >
            <span className="h-1.5 w-12 rounded-full bg-muted-foreground/20" />
          </button>

          <div className="flex items-center justify-between gap-3 px-6 pb-6 pt-2">
            <div className="min-w-0">
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-forest">Discovery</p>
              <h2 className="text-3xl font-bold tracking-tight text-ink">
                Homes in view
              </h2>
            </div>
            {addListingHref ? (
              <Link href={addListingHref} className="flex h-9 shrink-0 items-center justify-center rounded-md bg-forest px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-forest/90">
                List property
              </Link>
            ) : null}
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-hide">
            {listingError ? (
              <div className="mx-6 mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>{listingError}</p>
              </div>
            ) : null}

            {isLoadingListings && visibleListings.length === 0 ? (
              <div className="mx-6 mb-6 h-36 shrink-0 animate-pulse rounded-xl border border-border bg-muted" />
            ) : null}

            {visibleListings.length === 0 && !isLoadingListings && !listingError ? (
              <div className="mx-6 mb-6">
                <EmptyStateCapture bbox={viewportBounds} filters={filters} compact={true} />
              </div>
            ) : visibleListings.length > 0 ? (
              <div className="space-y-4 px-6 pb-6 pt-2">
                {visibleListings.map((listing) => (
                  <ListingPropertyCard
                    key={listing.id}
                    listing={listing}
                    compact={true}
                    isSelected={selectedListingId === listing.id}
                    onSelect={() => handleViewDetail(listing.id)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </section>
      </div>

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
