"use client";

import {
  AlertTriangle,
  Bath,
  BedDouble,
  Building2,
  CalendarDays,
  MapPin,
  Search,
  X,
  Filter,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

import { NavigationTabs } from "@/components/navigation/navigation";
import { PropertyCard, SaveIconButton } from "@/components/premium/property-card";
import { HeroModal } from "@/components/premium/hero-modal";
import { cn } from "@/lib/utils";

import { ListingDetailPanel, type ListingDetail } from "./listing-detail-panel";
import { MapControls } from "./map-controls";
import { MapView } from "./map-view";
import { EmptyStateCapture } from "./empty-state-capture";
import { useFavorites } from "./hooks/use-favorites";
import { useOverpassPois } from "./hooks/use-overpass-pois";
import { FilterBar, type FilterState } from "./filter-bar";
import { LayerTogglePanel } from "./layer-toggle-panel";

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
  hideSidebar?: boolean;
};

type ViewportBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

type ViewportListingResponse = {
  listings: {
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
  }[];
};

type MobileSheetState = "peek" | "expanded";

function formatPrice(price: number) {
  return `R${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(price)}`;
}

function formatFullPrice(price: number) {
  return `R ${new Intl.NumberFormat("en-ZA").format(price)}`;
}



function toListing(pin: ViewportListingResponse["listings"][number]): Listing {
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

function LandlordCta() {
  return (
    <div className="rounded-lg border border-border bg-warm-surface p-4">
      <p className="text-sm font-semibold text-ink">List a rental</p>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">
        Publish a draft, review applicants, and propose viewing times from your workspace.
      </p>
      <Link
        href="/dashboard/listings/new"
        className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-forest px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-forest/90"
      >
        Add listing
      </Link>
    </div>
  );
}

export function DiscoveryPage({ googleMapsApiKey, initialListing, hideSidebar = false }: DiscoveryPageProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const urlQuery = searchParams.get("q") ?? "";
  const listingRequestRef = useRef<AbortController | null>(null);
  const [visibleListings, setVisibleListings] = useState<Listing[]>([]);
  const [selectedListingId, setSelectedListingId] = useState<string | undefined>(initialListing?.id);
  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [mobileSheetState, setMobileSheetState] = useState<MobileSheetState>("peek");
  const [mapLocationName, setMapLocationName] = useState("");
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds | null>(null);
  const [isLoadingListings, setIsLoadingListings] = useState(false);
  const [listingError, setListingError] = useState<string | null>(null);
  const [detailListing, setDetailListing] = useState<ListingDetail | null>(initialListing ?? null);
  const [activeLayers, setActiveLayers] = useState<Set<string>>(new Set());
  const [isLayersPanelOpen, setIsLayersPanelOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showHeroModal, setShowHeroModal] = useState(false);

  useEffect(() => {
    const hasVisited = localStorage.getItem("roomza_has_visited");
    if (!hasVisited) {
      setShowHeroModal(true);
      localStorage.setItem("roomza_has_visited", "true");
    }
  }, []);

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
        const data = await res.json();
        setDetailListing(data);
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

  const handleHeroSearch = (query: string) => {
    setSearchQuery(query);
    const params = new URLSearchParams(searchParams.toString());
    params.set("q", query);
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
        const nextListings = payload.listings.map(toListing);
        setVisibleListings(nextListings);
        setSelectedListingId((currentId) =>
          nextListings.some((listing) => listing.id === currentId) ? currentId : nextListings[0]?.id,
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

  const homesLabel = isLoadingListings
    ? "Loading homes in view"
    : `${visibleListings.length} ${visibleListings.length === 1 ? "home" : "homes"} in view`;

  return (
    <main className="relative h-screen overflow-hidden bg-background text-ink">
      <h1 className="sr-only">Homes in view</h1>

      <HeroModal
        open={showHeroModal}
        onClose={() => setShowHeroModal(false)}
        onSearch={handleHeroSearch}
      />

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
          <div className="absolute right-[4.5rem] top-24 z-[var(--z-controls)] lg:right-[calc(var(--sidebar-offset-lg)+4rem)] lg:top-[140px] xl:right-[calc(var(--sidebar-offset-xl)+4rem)]">
            <LayerTogglePanel 
              isOpen={isLayersPanelOpen}
              onClose={() => setIsLayersPanelOpen(false)}
              activeLayers={activeLayers}
              onToggleLayer={toggleLayer}
            />
          </div>
        </MapView>
      </div>

      <header
        className={cn(
          "pointer-events-none absolute left-0 top-0 z-[var(--z-chrome)] px-4 pb-4 pt-4",
          hideSidebar ? "right-0" : "right-0 lg:right-[var(--sidebar-w-lg)] xl:right-[var(--sidebar-w-xl)]",
        )}
        style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)" }}
      >
        {/* Desktop: full chrome bar */}
        <div className="pointer-events-auto hidden gap-3 rounded-lg border border-border bg-panel/95 p-3 shadow-[var(--elevation-2)] lg:grid lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
          <NavigationTabs className="flex" />

          <form role="search" className="flex min-w-0 items-center gap-2 rounded-md border border-input bg-warm-surface px-3 py-2" onSubmit={handleSearchSubmit}>
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted-foreground"
              placeholder="Search neighbourhood or city"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label="Search listings"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={handleClearSearch}
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-ink active:scale-95"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-md transition-all duration-200 active:scale-95",
                showFilters 
                  ? "bg-ink text-panel shadow-sm" 
                  : "text-muted-foreground hover:bg-muted hover:text-ink"
              )}
              aria-label="Toggle filters"
            >
              <Filter className="size-4" />
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
          className="pointer-events-auto mr-12 flex items-center gap-3 rounded-full border border-border/60 bg-panel/90 px-4 py-3 shadow-[var(--elevation-2)] backdrop-blur-xl lg:hidden"
          onSubmit={handleSearchSubmit}
        >
          <Search className="size-5 shrink-0 text-ink" aria-hidden="true" />
          <input
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



      <aside
        className={cn(
          "absolute bottom-0 right-0 top-0 z-[var(--z-controls)] hidden w-[var(--sidebar-w-lg)] flex-col overflow-hidden border-l border-border bg-panel shadow-[var(--elevation-3)] lg:flex xl:w-[var(--sidebar-w-xl)]",
          hideSidebar && "lg:hidden",
        )}
      >
        {detailListing ? (
          <div className="flex h-full flex-col animate-in fade-in slide-in-from-right-8 duration-200 ease-[var(--ease-out-quart)]">
            <ListingDetailPanel listing={detailListing} onBack={() => setDetailListing(null)} />
          </div>
        ) : (
          <div className="flex h-full flex-col animate-in fade-in slide-in-from-left-4 duration-200 ease-[var(--ease-out-quart)]">
            <div className="border-b border-border px-5 py-4">
              <p className="text-xs font-semibold uppercase text-clay">Discovery</p>
              <div className="mt-1 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-ink">Listings</h2>
                </div>
                <button
                  type="button"
                  className="flex size-9 items-center justify-center rounded-md border border-border bg-panel text-muted-foreground"
                  aria-label="Viewing calendar"
                >
                  <CalendarDays className="size-4" />
                </button>
              </div>
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
              <LandlordCta />
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
          "pointer-events-auto mx-auto flex w-full max-w-[440px] flex-col overflow-hidden rounded-t-[32px] bg-panel shadow-[var(--elevation-3)] transition-all duration-300 ease-[var(--ease-out-quart)]",
          mobileSheetState === "expanded" ? "h-[55dvh]" : "max-h-[55dvh]"
        )}>
          <button
            type="button"
            onClick={() => setMobileSheetState((prev) => (prev === "expanded" ? "peek" : "expanded"))}
            className="flex w-full items-center justify-center px-4 pt-3 pb-2"
            aria-label={mobileSheetState === "expanded" ? "Collapse listings" : "Expand listings"}
          >
            <span className="h-1.5 w-12 rounded-full bg-muted-foreground/20" />
          </button>

          <div className="flex items-center justify-between gap-3 px-6 pb-4 pt-2">
            <div className="min-w-0">
              <h2 className="text-[1.35rem] font-medium text-ink">
                Recommended for you
              </h2>
            </div>
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
                <LandlordCta />
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
            <ListingDetailPanel listing={detailListing} onBack={() => setDetailListing(null)} />
          </div>
        </div>
      ) : null}
    </main>
  );
}
