"use client";

import { Search, SlidersHorizontal, LayoutGrid, Map as MapIcon, Home, ArrowUpDown, Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";

import { PropertyCard, SaveIconButton } from "@/components/premium/property-card";
import { useOnClickOutside } from "@/lib/hooks/use-on-click-outside";
import type { Role } from "@/lib/roles";
import { cn, formatPrice } from "@/lib/utils";

import type { ListingDetail } from "./listing-detail-panel";

// The detail panel is only rendered once a listing is selected (or deep-linked),
// and it pulls in the application modal, chat actions, image lightbox, and the
// Supabase client. Load it lazily so none of that ships in the `/` initial
// bundle (keeps the route within the 300 KB initial-JS budget, Req 9.5).
const ListingDetailPanel = dynamic(
  () => import("./listing-detail-panel").then((m) => m.ListingDetailPanel),
  { ssr: false },
);
import { MapControls } from "./map-controls";
import { MapViewLoader } from "./map-view-loader";
import { EmptyStateCapture } from "./empty-state-capture";
import { useFavorites } from "./hooks/use-favorites";
import { useOverpassPois } from "./hooks/use-overpass-pois";
import { FilterBar, type FilterState } from "./filter-bar";
import { LayerTogglePanel } from "./layer-toggle-panel";
import { capListings } from "./lib/cap";
import { haversineKm, resolveDistanceOrigin } from "./lib/distance";
import { formatBboxParam } from "./lib/format";
import { deriveMarkerListings } from "./lib/marker-sync";
import type { SheetSnap } from "./lib/sheet";
import { latestSort, mostNearestSort } from "./lib/sort";
import type { GeoPoint, ListingCardModel } from "./lib/types";
import { MobileDiscoveryShell } from "./mobile/mobile-discovery-shell";
import { MobileBottomSheet } from "./mobile/bottom-sheet";
import { ListingCard } from "./mobile/listing-card";
import { ListingCarousel } from "./mobile/listing-carousel";
import {
  LifestyleStrip,
  OpenHousesSection,
  CollectionsSection,
} from "./mobile/explore-sections";

/** sessionStorage key for persisting the mobile Bottom_Sheet snap position. */
const SHEET_SNAP_STORAGE_KEY = "roomza:mobile-sheet-snap";

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

const VIEWPORT_QUERY_TIMEOUT_MS = 2000;
const LISTING_DETAIL_TIMEOUT_MS = 2000;

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
  onClose,
  compact,
  revealIndex,
}: {
  listing: Listing;
  isSelected?: boolean;
  onSelect: () => void;
  onClose?: () => void;
  compact?: boolean;
  revealIndex?: number | null;
}) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorited = isFavorite(listing.id);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSelected && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isSelected]);

  const reveal = revealIndex != null;

  return (
    <div
      ref={ref}
      className={cn("relative", reveal ? "discovery-card-reveal" : undefined)}
      style={reveal ? ({ "--stagger-index": revealIndex } as React.CSSProperties) : undefined}
    >
    <PropertyCard
      compact={compact}
      showVideoCall={false}
      onClose={onClose}
      property={{
        id: listing.id,
        title: listing.title,
        area: listing.area,
        price: listing.fullPrice,
        bedrooms: listing.beds,
        bathrooms: listing.baths,
        imageUrl: listing.imageUrls[0],
        imageUrls: listing.imageUrls,
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
    </div>
  );
}



export function DiscoveryPage({ googleMapsApiKey, initialListing, initialIntent }: DiscoveryPageProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const urlQuery = searchParams.get("q") ?? "";
  const mobileLayerPanelRef = useRef<HTMLDivElement | null>(null);
  const listingRequestRef = useRef<AbortController | null>(null);
  const detailRequestRef = useRef<AbortController | null>(null);
  const [visibleListings, setVisibleListings] = useState<Listing[]>([]);
  const [selectedListingId, setSelectedListingId] = useState<string | undefined>(initialListing?.id);
  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [mapLocationName, setMapLocationName] = useState("");
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds | null>(null);
  const [isLoadingListings, setIsLoadingListings] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [listingError, setListingError] = useState<string | null>(null);
  const [detailListing, setDetailListing] = useState<ListingDetail | null>(initialListing ?? null);
  const [activeLayers, setActiveLayers] = useState<Set<string>>(new Set());
  const [isLayersPanelOpen, setIsLayersPanelOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  // Start collapsed (peek) so the map is visible on load; the user drags/taps
  // the handle to expand the listings sheet.
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>("collapsed");
  // Locally dismissed cards (the per-card "X" in the left listings panel).
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const handleDismissListing = useCallback((id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  // Discovery view/sort UI state
  const [isGridView, setIsGridView] = useState(false);
  const [sortBy, setSortBy] = useState("Latest");
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(sortMenuRef, () => setIsSortOpen(false));
  const SORT_OPTIONS = ["Latest", "Price: Low to High", "Price: High to Low", "Closest"] as const;

  // Distance origin for the card model pipeline (Req 6.3, Data Gap 2):
  // best-effort visitor geolocation; falls back to the current map center
  // (derived from viewportBounds), else null => distanceKm is null.
  const [geoOrigin, setGeoOrigin] = useState<GeoPoint | null>(null);
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

  const handleViewDetail = useCallback((listingId: string) => {
    setSelectedListingId(listingId);
    setListingError(null);
    detailRequestRef.current?.abort();

    const controller = new AbortController();
    detailRequestRef.current = controller;
    setIsLoadingDetail(true);

    let didTimeOut = false;
    const timeoutId = setTimeout(() => {
      didTimeOut = true;
      controller.abort();
    }, LISTING_DETAIL_TIMEOUT_MS);

    fetch(`/api/listings/${listingId}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("Listing details could not be loaded.");
        const payload = (await res.json()) as ListingDetailResponse;
        setDetailListing(payload.data);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError" && !didTimeOut) {
          return;
        }
        setListingError(didTimeOut ? "Listing details could not be loaded within 2 seconds." : "Listing details could not be loaded.");
      })
      .finally(() => {
        clearTimeout(timeoutId);
        if (detailRequestRef.current === controller) {
          detailRequestRef.current = null;
          setIsLoadingDetail(false);
        }
      });
  }, []);

  const handleSelectListing = useCallback((listingId: string) => {
    setSelectedListingId(listingId);
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
    const bbox = formatBboxParam(viewportBounds);

    queueMicrotask(() => {
      setIsLoadingListings(true);
      setListingError(null);
    });

    const queryParams = new URLSearchParams(searchParams.toString());
    queryParams.set("bbox", bbox);

    // Req 5.2: bound viewport refresh to 2s. When the timer fires we abort the
    // controller and flag `didTimeOut` so the resulting AbortError is treated
    // as a real failure (error indication + retain cards), distinguishing it
    // from a supersession abort (a newer bounds/search change), which stays
    // silent.
    let didTimeOut = false;
    const timeoutId = setTimeout(() => {
      didTimeOut = true;
      controller.abort();
    }, VIEWPORT_QUERY_TIMEOUT_MS);

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
    return () => {
      listingRequestRef.current?.abort();
      detailRequestRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    router.prefetch("/listings");
    router.prefetch("/saved");
  }, [router]);

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
  const distanceOrigin = useMemo<GeoPoint | null>(
    () => resolveDistanceOrigin(geoOrigin, viewportBounds),
    [geoOrigin, viewportBounds],
  );

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
  const markerListings = useMemo(
    () => deriveMarkerListings(cards, visibleListings),
    [cards, visibleListings],
  );

  const selectedListing = useMemo(
    () => visibleListings.find((listing) => listing.id === selectedListingId) ?? null,
    [selectedListingId, visibleListings],
  );

  // Desktop listing grid order driven by the "Sort by" control.
  const sortedVisibleListings = useMemo(() => {
    const list = [...visibleListings];
    switch (sortBy) {
      case "Price: Low to High":
        return list.sort((a, b) => a.priceValue - b.priceValue);
      case "Price: High to Low":
        return list.sort((a, b) => b.priceValue - a.priceValue);
      case "Closest": {
        if (!distanceOrigin) return list;
        return list.sort(
          (a, b) =>
            haversineKm(distanceOrigin, { lat: a.coordinates.lat, lng: a.coordinates.lng }) -
            haversineKm(distanceOrigin, { lat: b.coordinates.lat, lng: b.coordinates.lng }),
        );
      }
      case "Latest":
      default:
        return latestSort(list);
    }
  }, [visibleListings, sortBy, distanceOrigin]);

  // Docked "Open houses" cards reuse the currently visible listings (real
  // imagery + working tap-to-detail) as the source, capped to a small set so
  // the explore band stays a teaser above the full listings grid.
  const exploreOpenHouses = useMemo(
    () =>
      sortedVisibleListings.slice(0, 5).map((listing) => ({
        id: listing.id,
        title: listing.title,
        subtitle: listing.area,
        imageUrl: listing.imageUrls?.[0] ?? null,
      })),
    [sortedVisibleListings],
  );

  // Retracting desktop chrome (top app bar + sub app bar): instead of the bars
  // permanently consuming vertical space (which squeezes the left panel), they
  // collapse when the left panel scrolls down and reappear on scroll up. The
  // last scroll position is tracked per active scroll container.
  const [isChromeHidden, setIsChromeHidden] = useState(false);
  const lastPanelScrollTop = useRef(0);

  const handlePanelScroll = useCallback((event: React.UIEvent<HTMLElement>) => {
    const top = event.currentTarget.scrollTop;
    const last = lastPanelScrollTop.current;
    // Ignore tiny jitters; only react to a meaningful delta.
    if (Math.abs(top - last) < 6) return;
    if (top > last && top > 48) {
      setIsChromeHidden(true);
    } else if (top < last) {
      setIsChromeHidden(false);
    }
    lastPanelScrollTop.current = top;
  }, []);

  // Whenever the detail panel opens/closes, reset the chrome to visible so the
  // bars are never left collapsed against fresh, unscrolled content. Uses the
  // "store previous value in state + adjust during render" pattern (React docs)
  // instead of an effect, avoiding a cascading re-render. The scroll container's
  // scrollTop returns to 0 with the new content, so the tracking ref self-heals.
  const [prevDetailId, setPrevDetailId] = useState(detailListing?.id);
  if (prevDetailId !== detailListing?.id) {
    setPrevDetailId(detailListing?.id);
    if (isChromeHidden) setIsChromeHidden(false);
  }

  // App_Bar Back_Button: return to the previous page when there is history,
  // otherwise fall back to the home route (Req 1.4).
  const handleBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }, [router]);

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

  // State persistence (Req 9): restore the last sheet position on mount and
  // remember it across navigation via sessionStorage. This is a one-time
  // hydration from an external store; it must run after mount (not in a lazy
  // useState initializer) so the server and client first render agree — hence
  // the intentional post-mount setState.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.sessionStorage.getItem(SHEET_SNAP_STORAGE_KEY);
    } catch {
      /* sessionStorage may be unavailable (private mode); ignore */
    }
    if (saved === "collapsed" || saved === "half" || saved === "expanded") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time external-store hydration
      setSheetSnap(saved);
    }
  }, []);

  const handleSheetSnapChange = useCallback((next: SheetSnap) => {
    setSheetSnap(next);
    try {
      window.sessionStorage.setItem(SHEET_SNAP_STORAGE_KEY, next);
    } catch {
      /* ignore persistence failures */
    }
  }, []);

  // See_All: the BottomSheet already expands itself to its max snap and switches
  // the carousel to the in-place full list (Data Gap 3 default). No route change.
  const handleSeeAll = useCallback(() => {
    // No-op beyond the sheet's own expand; in-place expansion is handled in the
    // shell/sheet. Kept as a named handler for future wiring.
  }, []);



  return (
    <main className="relative h-dvh overflow-hidden bg-warm-surface text-ink flex flex-col">
      <h1 className="sr-only">Homes in view</h1>

      {/* Sticky desktop top navigation — logo + search + Map/Grid toggle */}
      <header className="hidden lg:flex flex-none items-center gap-5 pl-9 pr-28 py-3 bg-panel border-b border-border/40 z-[var(--z-chrome)] relative shadow-sm">
        {/* Logo + rental context */}
        <Link href="/" aria-label="RoomZA home" className="flex items-center gap-3 shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest">
          <div className="flex items-center justify-center size-8 bg-forest rounded text-primary-foreground">
            <Home className="size-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-forest">RoomZA</span>
          <span className="ml-1 hidden items-center gap-1.5 rounded-full bg-warm-surface px-2.5 py-1 text-xs font-semibold text-ink xl:inline-flex">
            <span className="inline-flex size-2 rounded-full bg-forest" aria-hidden="true" />
            Rentals
          </span>
        </Link>

        {/* Search — primary action, takes the flexible middle */}
        <form role="search" className="flex min-w-0 flex-1 items-center gap-3 rounded-full border border-border/60 bg-warm-surface px-4 py-2 shadow-sm transition-colors focus-within:border-forest focus-within:ring-1 focus-within:ring-forest" onSubmit={handleSearchSubmit}>
          <Search className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <input
            ref={desktopSearchInputRef}
            type="search"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted-foreground"
            placeholder="Search neighbourhood or city"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            aria-label="Search listings"
          />
          <button
            type="button"
            aria-label="Filter listings"
            aria-expanded={showFilters}
            onClick={() => setShowFilters((value) => !value)}
            className={cn(
              "flex size-6 items-center justify-center rounded-full border border-border/60 shadow-sm transition-colors hover:bg-muted",
              showFilters ? "bg-forest text-primary-foreground" : "bg-panel text-muted-foreground",
            )}
          >
            <SlidersHorizontal className="size-3" />
          </button>
        </form>

        {/* Map/Grid segmented control */}
        <div className="flex shrink-0 items-center gap-1 rounded-full border border-border/60 bg-warm-surface p-1">
          <button
            onClick={() => setIsGridView(false)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              !isGridView ? "bg-panel shadow-sm border border-border/40 text-ink" : "text-muted-foreground hover:text-ink"
            )}
          >
            <MapIcon className="size-4" />
            Map
          </button>
          <button
            onClick={() => setIsGridView(true)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              isGridView ? "bg-panel shadow-sm border border-border/40 text-ink" : "text-muted-foreground hover:text-ink"
            )}
          >
            <LayoutGrid className="size-4" />
            Grid
          </button>
        </div>

      </header>


      <div className="flex-1 min-h-0 relative flex flex-col lg:flex-row">
        {detailListing && (
          <div className={cn(
            "hidden lg:flex flex-col overflow-hidden bg-warm-surface border-r border-border/40 z-10 relative shadow-[var(--elevation-2)]",
            "w-[30%] min-w-[340px]"
          )}>
            <div
              key={detailListing.id}
              className="flex h-full flex-col animate-in fade-in slide-in-from-left-4 duration-300 ease-[var(--ease-out-quart)] motion-reduce:animate-none"
            >
              <ListingDetailPanel listing={detailListing} initialIntent={initialIntent} onBack={() => setDetailListing(null)} onScroll={handlePanelScroll} compact />
            </div>
          </div>
        )}

        {/* Left Listings Panel (desktop) — floating rounded bento card over the full-width map */}
        {!detailListing && !isGridView && (
          <aside className="hidden lg:flex absolute left-3 top-3 bottom-3 w-[50%] xl:w-[45%] z-[var(--z-controls)] flex-col rounded-[24px] border border-border/40 bg-warm-surface shadow-[var(--elevation-3)] overflow-hidden">
            {/* Pinned header: heading + filter pills (layers above the scrolling cards) */}
            <div className="relative z-30 flex-none bg-warm-surface px-5 pt-5 pb-3">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-2xl font-bold tracking-tight text-ink">
                  {new Intl.NumberFormat("en-ZA").format(visibleListings.length)} {mapLocationName || "Cape Town"} Rentals.
                </h2>

                {/* Sort dropdown */}
                <div ref={sortMenuRef} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsSortOpen((open) => !open)}
                    aria-haspopup="listbox"
                    aria-expanded={isSortOpen}
                    aria-label={`Sort listings by ${sortBy}`}
                    className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-panel px-3 py-1.5 text-xs font-semibold text-ink shadow-sm transition-colors hover:border-forest hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
                  >
                    <ArrowUpDown className="size-3.5" />
                    <span className="max-w-[7.5rem] truncate">{sortBy}</span>
                    <ChevronDown className={cn("size-3.5 transition-transform", isSortOpen && "rotate-180")} />
                  </button>

                  {isSortOpen ? (
                    <ul
                      role="listbox"
                      aria-label="Sort options"
                      className="absolute right-0 top-full z-40 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-panel py-1 shadow-[var(--elevation-3)]"
                    >
                      {SORT_OPTIONS.map((option) => {
                        const isActive = option === sortBy;
                        return (
                          <li key={option}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={isActive}
                              onClick={() => {
                                setSortBy(option);
                                setIsSortOpen(false);
                              }}
                              className={cn(
                                "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-warm-surface",
                                isActive ? "font-semibold text-forest" : "text-ink",
                              )}
                            >
                              {option}
                              {isActive ? <Check className="size-4 shrink-0" /> : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              </div>

              {/* Filter pills */}
              <div className="mt-4">
                <FilterBar
                  filters={filters}
                  onFilterChange={handleFilterChange}
                  resultCount={visibleListings.length}
                  isLoading={isLoadingListings}
                  dropdownPlacement="bottom"
                  condensed
                />
                {isLoadingDetail || listingError ? (
                  <div
                    className={cn(
                      "mt-3 rounded-md border px-3 py-2 text-xs font-medium",
                      listingError
                        ? "border-status-warning-border bg-status-warning-surface text-status-warning-text"
                        : "border-border bg-panel text-muted-foreground",
                    )}
                    role={listingError ? "alert" : "status"}
                  >
                    {listingError ?? "Loading listing details..."}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Scrollable listing grid (2 columns) */}
            <div onScroll={handlePanelScroll} className="flex-1 min-h-0 overflow-y-auto px-5 pb-4 pt-1">
              {/* Desktop grid renders here */}

              {!isLoadingListings && visibleListings.length === 0 ? (
                <div className="py-10 flex justify-center">
                  <EmptyStateCapture bbox={viewportBounds} filters={filters} compact />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {sortedVisibleListings
                    .filter((listing) => !dismissedIds.has(listing.id))
                    .map((listing, index) => (
                      <ListingPropertyCard
                        key={listing.id}
                        listing={listing}
                        compact
                        isSelected={listing.id === selectedListingId}
                        onSelect={() => handleViewDetail(listing.id)}
                        onClose={() => handleDismissListing(listing.id)}
                        revealIndex={Math.min(index, 12)}
                      />
                    ))}
                </div>
              )}

              {/* Docked discovery band (Maps-style "Explore nearby" sections),
                  moved below the listings grid so it doesn't displace primary content. */}
              {visibleListings.length > 0 && (
                <div className="-mx-5 mt-10 mb-6 flex flex-col gap-6">
                  <LifestyleStrip
                    onSelect={(id) => setSearchQuery(id.replace(/-/g, " "))}
                  />
                  <OpenHousesSection
                    openHouses={exploreOpenHouses}
                    onSelect={handleViewDetail}
                  />
                  <CollectionsSection
                    onSelect={(id) => setSearchQuery(id.replace(/-/g, " "))}
                  />
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Map Area */}
        <div className={cn(
          "relative h-full w-full lg:bg-muted",
          "absolute inset-0 z-[var(--z-map)] lg:static lg:inset-auto lg:z-auto",
          isGridView ? "lg:w-full" : "lg:flex-1"
        )}>
          <MapViewLoader
            apiKey={googleMapsApiKey}
            listings={markerListings}
            selectedListingId={selectedListingId}
            onSelectListing={handleSelectListing}
            onViewListing={handleViewDetail}
            onBoundsChange={setViewportBounds}
            onCenterNameChange={setMapLocationName}
            initialCenter={initialCenter}
            searchQuery={urlQuery}
            poiMarkers={pois}
            detailOpen={Boolean(detailListing)}
          >
            {isGridView && (
              <div className="hidden lg:block absolute inset-0 z-[var(--z-list-view)] bg-warm-surface overflow-y-auto px-8 pt-8 pb-12">
                <div className="mx-auto max-w-7xl">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h2 className="text-3xl font-bold tracking-tight text-ink">Homes in view</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {isLoadingListings ? "Loading homes..." : `${cards.length} ${cards.length === 1 ? "home" : "homes"} found`}
                      </p>
                    </div>
                  </div>
                  
                  {!isLoadingListings && cards.length === 0 ? (
                    <div className="py-12 flex justify-center">
                      <EmptyStateCapture bbox={viewportBounds} filters={filters} />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {cards.map((card, index) => (
                        <ListingCard
                          key={card.id}
                          card={card}
                          variant="grid"
                          selected={card.id === selectedListingId}
                          onActivate={() => handleViewDetail(card.id)}
                          revealIndex={Math.min(index, 12)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <MapControls 
              className={cn(
                "absolute top-[9.5rem] z-[var(--z-controls)] lg:top-8",
                isGridView ? "max-lg:hidden" : "",
              )}
              onLayersClick={() => setIsLayersPanelOpen(!isLayersPanelOpen)}
              activeLayerCount={activeLayers.size}
            />
            <div ref={mobileLayerPanelRef} className={cn(
              "fixed inset-x-3 top-[8.75rem] z-[var(--z-chrome)] lg:absolute lg:inset-x-auto lg:right-[5.5rem] lg:top-6 lg:z-[var(--z-controls)]",
              isGridView ? "max-lg:hidden" : "",
            )}>
              <LayerTogglePanel 
                isOpen={isLayersPanelOpen}
                onClose={() => setIsLayersPanelOpen(false)}
                activeLayers={activeLayers}
                onToggleLayer={toggleLayer}
                className="w-full max-h-[min(46dvh,360px)] rounded-xl lg:w-[320px] lg:max-h-[80vh] lg:rounded-2xl"
              />
            </div>
          </MapViewLoader>

        </div>
      </div>

      {/* Mobile Shell (<1024px) */}
      <div className="lg:hidden">
        <MobileDiscoveryShell
          onBack={handleBack}
          screenTitle="Listings Near You"
          searchQuery={searchQuery}
          onSearchChange={(value) => setSearchQuery(value)}
          onSearchSubmit={submitSearch}
          onClearSearch={handleClearSearch}
          onToggleFilters={() => setShowFilters((value) => !value)}
          filtersActive={showFilters}
          isGridView={isGridView}
          onToggleView={setIsGridView}
          searchInputRef={mobileSearchInputRef}
          cards={cards}
          selectedListingId={selectedListingId}
          isLoading={isLoadingListings}
          error={listingError}
          onRetry={handleRetry}
          onSelectCard={handleViewDetail}
          onSeeAll={handleSeeAll}
          emptyState={<EmptyStateCapture bbox={viewportBounds} filters={filters} compact />}
          heroSlot={
            !detailListing && selectedListing ? (
              <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-chrome)] flex justify-center bg-gradient-to-t from-background/80 via-background/30 to-transparent px-3 pt-32 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
                <div
                  key={selectedListing.id}
                  className="pointer-events-auto w-full max-w-[480px] animate-in fade-in slide-in-from-bottom-4 duration-200 ease-[var(--ease-out-quart)]"
                >
                  <div className="max-h-[48dvh] overflow-y-auto rounded-[24px] shadow-[var(--elevation-3)] scrollbar-hide">
                    <ListingPropertyCard
                      listing={selectedListing}
                      isSelected
                      compact
                      onSelect={() => handleViewDetail(selectedListing.id)}
                      onClose={() => setSelectedListingId(undefined)}
                    />
                  </div>
                </div>
              </div>
            ) : null
          }
        >
        </MobileDiscoveryShell>

        {/* Mobile Bottom_Sheet — three-snap, drag-aware listings sheet. Rendered
            outside the heroSlot wrapper so it can self-anchor to the viewport
            bottom and manage its own drag/scroll/scrim behaviour. */}
        {!detailListing && !selectedListing ? (
          <MobileBottomSheet
            snap={sheetSnap}
            onSnapChange={handleSheetSnapChange}
            aria-label={sheetSnap === "expanded" ? "Collapse listings sheet" : "Expand listings sheet"}
            header={
              <div className="px-4 pt-1">
                <h2 className="text-lg font-bold tracking-tight text-ink">
                  {new Intl.NumberFormat("en-ZA").format(visibleListings.length)} {mapLocationName || "Cape Town"} Rentals.
                </h2>
                <div className="mt-3">
                  <FilterBar
                    filters={filters}
                    onFilterChange={handleFilterChange}
                    resultCount={visibleListings.length}
                    isLoading={isLoadingListings}
                    condensed
                  />
                </div>
              </div>
            }
          >
            <div className="mt-3 px-2">
              <ListingCarousel
                cards={cards}
                selectedListingId={selectedListingId}
                isLoading={isLoadingListings}
                error={listingError}
                onRetry={handleRetry}
                onSelectCard={handleViewDetail}
                emptyState={<EmptyStateCapture bbox={viewportBounds} filters={filters} compact />}
              />

              {/* Docked discovery band (Maps-style "Explore nearby" sections)
                  below the carousel, mirroring desktop. */}
              {visibleListings.length > 0 && (
                <div className="mt-4 mb-4 flex flex-col gap-5">
                  <LifestyleStrip onSelect={(id) => setSearchQuery(id.replace(/-/g, " "))} />
                  <OpenHousesSection openHouses={exploreOpenHouses} onSelect={handleViewDetail} />
                  <CollectionsSection onSelect={(id) => setSearchQuery(id.replace(/-/g, " "))} />
                </div>
              )}
            </div>
          </MobileBottomSheet>
        ) : null}

        {/* Detail Panel */}
        {detailListing ? (
          <div
            className="fixed inset-x-0 bottom-0 z-[var(--z-detail-mobile)] overflow-hidden rounded-t-2xl bg-panel shadow-[var(--elevation-3)] animate-in fade-in slide-in-from-bottom-12 duration-300 ease-[var(--ease-out-quart)]"
            style={{ top: "max(env(safe-area-inset-top), 0.25rem)" }}
          >
            <div className="h-full overflow-y-auto">
              <ListingDetailPanel listing={detailListing} initialIntent={initialIntent} onBack={() => setDetailListing(null)} />
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
