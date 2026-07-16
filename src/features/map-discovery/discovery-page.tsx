"use client";

import { Search, SlidersHorizontal, List, Map as MapIcon, ArrowUpDown, Check, ChevronDown, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";

import { useOnClickOutside } from "@/lib/hooks/use-on-click-outside";
import { useScrollAdaptation } from "@/lib/hooks/use-scroll-adaptation";
import type { Role } from "@/lib/roles";
import { cn, formatPrice } from "@/lib/utils";

import type { ListingDetail } from "./listing-detail-panel";
import { ListingCarouselSkeleton } from "./discovery-loading";

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
import { useOverpassPois } from "./hooks/use-overpass-pois";
import { FilterBar, type FilterState } from "./filter-bar";
import { LayerTogglePanel } from "./layer-toggle-panel";
import {
  buildLocationSuggestions,
  moveSuggestionIndex,
  SearchSuggestions,
  type LocationSuggestion,
  type PlaceSuggestion,
} from "./search-suggestions";
import { capListings } from "./lib/cap";
import { haversineKm, resolveDistanceOrigin } from "./lib/distance";
import { formatBboxParam } from "./lib/format";
import { discoveryRequestErrorMessage } from "./lib/request-status";
import { deriveMarkerListings } from "./lib/marker-sync";
import type { SheetSnap } from "./lib/sheet";
import { latestSort, mostNearestSort } from "./lib/sort";
import type { GeoPoint, ListingCardModel } from "./lib/types";
import type { BlogPostSummary } from "@/features/blog/types";
import { MobileDiscoveryShell } from "./mobile/mobile-discovery-shell";
import { MobileBottomSheet } from "./mobile/bottom-sheet";

const ListingCarousel = dynamic(
  () => import("./mobile/listing-carousel").then((module) => module.ListingCarousel),
  {
    loading: () => <ListingCarouselSkeleton />,
  },
);

// Lifestyle/editorial discovery sits below the map-first results experience.
// Keep its rich card content out of the route's critical JS path and hydrate it
// independently when React reaches the section.
const DiscoveryExploreSections = dynamic(
  () => import("./mobile/explore-sections").then((module) => module.DiscoveryExploreSections),
);

/** sessionStorage key for persisting the mobile Bottom_Sheet snap position. */
const SHEET_SNAP_STORAGE_KEY = "roomza:mobile-sheet-snap";
const RECENT_SEARCHES_STORAGE_KEY = "roomza:discovery-recent-searches";

function loadRecentSearches() {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string").slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

type Listing = {
  id: string;
  title: string;
  area: string;
  price: string;
  fullPrice: string;
  /** Numeric price source (Listing.price is formatted) used by the card model pipeline. */
  priceValue: number;
  salePrice: number | null;
  displayPrice: number;
  listingType: "rent" | "sale";
  beds: number;
  baths: number;
  parkingCount: number;
  propertyType: string | null;
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
  initialBlogPosts?: BlogPostSummary[];
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

type ApiFailureResponse = {
  ok: false;
  error?: { code?: string; message?: string };
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
    salePrice?: number | null;
    displayPrice?: number | null;
    listingType?: "rent" | "sale";
    latitude: number;
    longitude: number;
    bedrooms: number;
    bathrooms: number;
    parkingCount?: number | null;
    propertyType?: string | null;
    imageUrls: string[];
    availabilityDate: string | null;
    created_at: string | null;
};

const VIEWPORT_QUERY_TIMEOUT_MS = 8000;
// A cold discovery load can take longer while the API/database connection is
// warming up. Do not turn that normal first response into a failed empty state.
const INITIAL_VIEWPORT_QUERY_TIMEOUT_MS = 12_000;
const LISTING_DETAIL_TIMEOUT_MS = 2000;

function formatFullPrice(price: number) {
  return `R ${new Intl.NumberFormat("en-ZA").format(price)}`;
}



function toListing(pin: ViewportListing): Listing {
  const listingType = pin.listingType ?? "rent";
  const displayPrice = Number(pin.displayPrice ?? (listingType === "sale" ? pin.salePrice ?? pin.price : pin.price));
  return {
    id: pin.id,
    title: pin.title,
    area: pin.area,
    price: formatPrice(displayPrice),
    fullPrice: formatFullPrice(displayPrice),
    priceValue: displayPrice,
    salePrice: pin.salePrice ?? null,
    displayPrice,
    listingType,
    beds: Number(pin.bedrooms),
    baths: Number(pin.bathrooms),
    parkingCount: Number(pin.parkingCount ?? 0),
    propertyType: pin.propertyType ?? null,
    coordinates: { lat: pin.latitude, lng: pin.longitude },
    imageUrls: pin.imageUrls || [],
    availabilityDate: pin.availabilityDate,
    createdAt: pin.created_at,
  };
}

export function DiscoveryPage({ googleMapsApiKey, initialListing, initialIntent, initialBlogPosts = [] }: DiscoveryPageProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const urlQuery = searchParams.get("q") ?? "";
  const urlPlaceId = searchParams.get("placeId") ?? "";
  const listingMode = searchParams.get("mode") === "buy" ? "buy" : "rent";
  const listingModeLabel = listingMode === "buy" ? "Properties" : "Rentals";
  const mobileLayerPanelRef = useRef<HTMLDivElement | null>(null);
  const listingRequestRef = useRef<AbortController | null>(null);
  const hasLoadedViewportListingsRef = useRef(false);
  const detailRequestRef = useRef<AbortController | null>(null);
  const [visibleListings, setVisibleListings] = useState<Listing[]>([]);
  const [selectedListingId, setSelectedListingId] = useState<string | undefined>(initialListing?.id);
  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [searchSuggestionsOpen, setSearchSuggestionsOpen] = useState(false);
  const [activeSearchSuggestionIndex, setActiveSearchSuggestionIndex] = useState(-1);
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>(loadRecentSearches);
  const [mapLocationName, setMapLocationName] = useState("");
  const resultLocationLabel = urlQuery || mapLocationName || "this area";
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds | null>(null);
  // The first viewport request cannot begin until the map reports its bounds.
  // Start in a loading state so the results rail has useful structure while
  // the map bundle and Google Maps SDK initialize.
  const [isLoadingListings, setIsLoadingListings] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [listingError, setListingError] = useState<string | null>(null);
  const [detailListing, setDetailListing] = useState<ListingDetail | null>(initialListing ?? null);
  const [activeLayers, setActiveLayers] = useState<Set<string>>(new Set());
  const [isLayersPanelOpen, setIsLayersPanelOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  // Start collapsed (peek) so the map is visible on load; the user drags/taps
  // the handle to expand the listings sheet.
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>("collapsed");
  const [mobileSheetHeight, setMobileSheetHeight] = useState(0);
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
  const [draftFilters, setDraftFilters] = useState<FilterState>(filters);

  const draftResultCount = useMemo(() => visibleListings.filter((listing) => {
    const min = draftFilters.price?.min;
    const max = draftFilters.price?.max;
    return (
      (min === undefined || listing.priceValue >= min) &&
      (max === undefined || listing.priceValue <= max) &&
      (draftFilters.beds === undefined || listing.beds >= draftFilters.beds) &&
      (draftFilters.baths === undefined || listing.baths >= draftFilters.baths) &&
      (!draftFilters.propertyTypes?.length || draftFilters.propertyTypes.includes(listing.propertyType ?? ""))
    );
  }).length, [draftFilters, visibleListings]);

  const activeFilterCount = useMemo(
    () =>
      Number(Boolean(filters.price?.min || filters.price?.max)) +
      Number(filters.beds !== undefined) +
      Number(filters.baths !== undefined) +
      Number(Boolean(filters.propertyTypes?.length)),
    [filters],
  );
  const draftActiveFilterCount = useMemo(
    () =>
      Number(Boolean(draftFilters.price?.min || draftFilters.price?.max)) +
      Number(draftFilters.beds !== undefined) +
      Number(draftFilters.baths !== undefined) +
      Number(Boolean(draftFilters.propertyTypes?.length)),
    [draftFilters],
  );

  const locationSuggestions = useMemo(
    () => buildLocationSuggestions({
      query: searchQuery,
      recentSearches,
      placeSuggestions,
      inViewCandidates: [mapLocationName],
    }),
    [mapLocationName, placeSuggestions, recentSearches, searchQuery],
  );

  const resolvedActiveSearchSuggestionIndex =
    activeSearchSuggestionIndex < locationSuggestions.length
      ? activeSearchSuggestionIndex
      : -1;

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

    const detailUrl = listingMode === "buy" ? `/api/listings/${listingId}?mode=buy` : `/api/listings/${listingId}`;
    fetch(detailUrl, { signal: controller.signal })
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
  }, [listingMode]);

  const handleSelectListing = useCallback((listingId: string) => {
    setSelectedListingId(listingId);
    if (listingId) setSheetSnap("half");
  }, []);

  const hasAutoOpened = useRef(false);
  useEffect(() => {
    const listingIdParam = searchParams.get("listingId");
    if (listingIdParam && !hasAutoOpened.current) {
      hasAutoOpened.current = true;
      handleViewDetail(listingIdParam);
    }
  }, [searchParams, handleViewDetail]);

  const replaceSearchQuery = useCallback((nextQuery: string, placeId?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const normalizedQuery = nextQuery.trim();
    if (normalizedQuery) {
      params.set("q", normalizedQuery);
    } else {
      params.delete("q");
    }
    if (placeId) params.set("placeId", placeId);
    else params.delete("placeId");
    router.replace(`${pathname}?${params.toString()}`);
  }, [searchParams, router, pathname]);

  const rememberSearch = useCallback((value: string) => {
    const normalized = value.trim();
    if (!normalized) return;
    setRecentSearches((current) => {
      const next = [
        normalized,
        ...current.filter((item) => item.toLocaleLowerCase("en-ZA") !== normalized.toLocaleLowerCase("en-ZA")),
      ].slice(0, 5);
      try {
        window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Search history is a progressive enhancement.
      }
      return next;
    });
  }, []);

  const submitSearch = useCallback(() => {
    setSearchSuggestionsOpen(false);
    setActiveSearchSuggestionIndex(-1);
    rememberSearch(searchQuery);
    replaceSearchQuery(searchQuery);
  }, [rememberSearch, replaceSearchQuery, searchQuery]);

  useEffect(() => {
    if (searchQuery.trim() === urlQuery.trim()) return;

    const timeoutId = window.setTimeout(() => {
      replaceSearchQuery(searchQuery);
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [replaceSearchQuery, searchQuery, urlQuery]);

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    submitSearch();
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setSearchSuggestionsOpen(false);
    setActiveSearchSuggestionIndex(-1);
    setPlaceSuggestions([]);
    replaceSearchQuery("");
  };

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setActiveSearchSuggestionIndex(-1);
    setSearchSuggestionsOpen(value.trim().length >= 2 || (!value.trim() && recentSearches.length > 0));
  }, [recentSearches.length]);

  const handleSuggestionSelect = useCallback((suggestion: LocationSuggestion) => {
    setSearchQuery(suggestion.label);
    setSearchSuggestionsOpen(false);
    setActiveSearchSuggestionIndex(-1);
    rememberSearch(suggestion.label);
    replaceSearchQuery(suggestion.label, suggestion.placeId);
  }, [rememberSearch, replaceSearchQuery]);

  const handleSearchFocus = useCallback(() => {
    const hasRecentSearches = !searchQuery.trim() && recentSearches.length > 0;
    setSearchSuggestionsOpen(searchQuery.trim().length >= 2 || hasRecentSearches);
  }, [recentSearches.length, searchQuery]);

  const handleSearchKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      if (searchSuggestionsOpen) event.preventDefault();
      setSearchSuggestionsOpen(false);
      setActiveSearchSuggestionIndex(-1);
      event.currentTarget.focus();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (locationSuggestions.length === 0) return;
      event.preventDefault();
      setSearchSuggestionsOpen(true);
      setActiveSearchSuggestionIndex((current) =>
        moveSuggestionIndex(current, locationSuggestions.length, event.key === "ArrowDown" ? 1 : -1),
      );
      return;
    }

    if (
      event.key === "Enter" &&
      searchSuggestionsOpen &&
      resolvedActiveSearchSuggestionIndex >= 0
    ) {
      const suggestion = locationSuggestions[resolvedActiveSearchSuggestionIndex];
      if (!suggestion) return;
      event.preventDefault();
      handleSuggestionSelect(suggestion);
      event.currentTarget.focus();
    }
  }, [handleSuggestionSelect, locationSuggestions, resolvedActiveSearchSuggestionIndex, searchSuggestionsOpen]);

  const handleListingModeChange = useCallback((mode: "rent" | "buy") => {
    const params = new URLSearchParams(searchParams.toString());
    if (mode === "buy") params.set("mode", "buy");
    else params.delete("mode");
    setDetailListing(null);
    setSelectedListingId(undefined);
    router.replace(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchParams]);

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

    // Keep later viewport refreshes snappy, but allow the initial discovery
    // request enough time to warm up and populate the page automatically.
    // The original two-second cutoff routinely aborted a valid cold response,
    // leaving first-time visitors with an error banner and no listings.
    const queryTimeoutMs = hasLoadedViewportListingsRef.current
      ? VIEWPORT_QUERY_TIMEOUT_MS
      : INITIAL_VIEWPORT_QUERY_TIMEOUT_MS;
    let didTimeOut = false;
    const timeoutId = setTimeout(() => {
      didTimeOut = true;
      controller.abort();
    }, queryTimeoutMs);

    fetch(`/api/listings?${queryParams.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as ViewportListingResponse | ApiFailureResponse;
        if (!response.ok || !payload.ok) {
          throw new Error("error" in payload ? payload.error?.code ?? "server_error" : "server_error");
        }
        return payload;
      })
      .then((payload) => {
        const nextListings = payload.data.listings.map(toListing);
        hasLoadedViewportListingsRef.current = true;
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
        const errorCode = error instanceof Error ? error.message : "server_error";
        setListingError(discoveryRequestErrorMessage(
          errorCode,
          typeof navigator === "undefined" || navigator.onLine,
        ));
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
      salePrice: listing.salePrice,
      displayPrice: listing.displayPrice,
      listingType: listing.listingType,
      bedrooms: listing.beds,
      bathrooms: listing.baths,
      parkingCount: listing.parkingCount,
      propertyType: listing.propertyType,
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

  const desktopCards = useMemo<ListingCardModel[]>(
    () =>
      capListings(sortedVisibleListings).map((listing) => ({
        id: listing.id,
        title: listing.title,
        imageUrls: listing.imageUrls,
        price: listing.priceValue,
        salePrice: listing.salePrice,
        displayPrice: listing.displayPrice,
        listingType: listing.listingType,
        bedrooms: listing.beds,
        bathrooms: listing.baths,
        parkingCount: listing.parkingCount,
        propertyType: listing.propertyType,
        rating: null,
        reviewCount: null,
        distanceKm: distanceOrigin
          ? haversineKm(distanceOrigin, {
              lat: listing.coordinates.lat,
              lng: listing.coordinates.lng,
            })
          : null,
      })),
    [distanceOrigin, sortedVisibleListings],
  );

  const desktopPanelScroll = useScrollAdaptation({
    neverHidden: true,
    focusLocked: showFilters,
    openLocked: isSortOpen || isLayersPanelOpen,
  });
  const mobileSheetScroll = useScrollAdaptation({
    neverHidden: true,
    focusLocked: showFilters,
    openLocked: isLayersPanelOpen,
  });
  const desktopPanelDensity = desktopPanelScroll.chrome === "minimal" ? "minimal" : desktopPanelScroll.chrome === "compact" ? "compact" : "expanded";
  const mobileSheetDensity = mobileSheetScroll.chrome === "minimal" ? "minimal" : mobileSheetScroll.chrome === "compact" ? "compact" : "expanded";
  const handleDesktopPanelAdaptation = desktopPanelScroll.onScroll;
  const handlePanelScroll = useCallback((event: React.UIEvent<HTMLElement>) => {
    handleDesktopPanelAdaptation(event);
  }, [handleDesktopPanelAdaptation]);

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

  const desktopListingPanelHeader = (
    <div
      data-chrome={desktopPanelScroll.chrome}
      className={cn(
        "adaptive-chrome relative z-30 flex-none bg-warm-surface px-5 pt-5 pb-3",
        desktopPanelScroll.chrome === "compact" && "pt-4",
        desktopPanelScroll.chrome === "minimal" && "pt-3 pb-2",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={cn("font-heading text-2xl font-semibold tracking-tight text-ink", desktopPanelScroll.chrome !== "expanded" && "text-xl")}>
            {new Intl.NumberFormat("en-ZA").format(visibleListings.length)} {listingModeLabel.toLowerCase()} in {resultLocationLabel}
          </h2>
          <p className={cn("mt-0.5 text-sm text-muted-foreground", desktopPanelScroll.chrome === "minimal" && "hidden")}>Find your perfect place.</p>
        </div>

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

      <div className="mt-4">
        <FilterBar
          filters={filters}
          onFilterChange={handleFilterChange}
          resultCount={visibleListings.length}
          isLoading={isLoadingListings}
          dropdownPlacement="bottom"
          condensed
          density={desktopPanelDensity}
          className="min-w-0 flex-1"
        />
      </div>
      <div>
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
  );

  const renderExploreSections = (className?: string) => (
    <DiscoveryExploreSections
      onSelect={(id) => setSearchQuery(id.replace(/-/g, " "))}
      className={className}
      blogs={initialBlogPosts.map((post) => ({
        id: post.id,
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        category: post.topic,
        imageUrl: post.cover?.publicUrl ?? null,
      }))}
    />
  );

  const renderDesktopListingPanelBody = (variant: "floating" | "fullscreen") => (
    <div
      onScroll={handlePanelScroll}
      className={cn(
        "scroll-contained min-h-0 flex-1 overflow-y-auto pb-8 pt-1",
        variant === "floating" ? "px-5" : "px-6 xl:px-10",
      )}
    >
      <div className={cn(variant === "fullscreen" && "mx-auto max-w-[1560px]")}>
        <ListingCarousel
          cards={desktopCards}
          selectedListingId={selectedListingId}
          isLoading={isLoadingListings}
          error={listingError}
          onRetry={handleRetry}
          onSelectCard={handleViewDetail}
          emptyState={<EmptyStateCapture bbox={viewportBounds} filters={filters} compact />}
        />
      </div>

      {renderExploreSections(
        cn(
          "mt-4",
          variant === "fullscreen" && "mx-auto max-w-[1560px]",
        ),
      )}
    </div>
  );

  const renderDesktopListingsPanel = (variant: "floating" | "fullscreen") => (
    <aside
      aria-label={variant === "fullscreen" ? "Listings list view" : "Listings near the map"}
      className={cn(
        "hidden lg:flex flex-col overflow-hidden bg-surface-panel",
        variant === "floating"
          ? "relative z-[var(--z-controls)] w-[440px] shrink-0 border-r border-border/70 xl:w-[500px]"
          : "absolute inset-0 z-[var(--z-list-view)] border-0",
      )}
    >
      {desktopListingPanelHeader}
      {renderDesktopListingPanelBody(variant)}
    </aside>
  );

  const mobileSheetHeader = (
    <div
      data-chrome={mobileSheetScroll.chrome}
      className={cn("adaptive-chrome px-4 pt-1", mobileSheetScroll.chrome === "minimal" && "pt-0")}
    >
      <h2 className={cn("font-heading text-lg font-semibold tracking-tight text-ink", mobileSheetScroll.chrome !== "expanded" && "text-base")}>
        {new Intl.NumberFormat("en-ZA").format(visibleListings.length)} {listingModeLabel.toLowerCase()} in {resultLocationLabel}
      </h2>
      <p className={cn("mt-0.5 text-sm text-muted-foreground", mobileSheetScroll.chrome === "minimal" && "hidden")}>Find your perfect place.</p>
      <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-border/60 bg-panel p-1" aria-label="Listing market">
        {(["rent", "buy"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => handleListingModeChange(mode)}
            aria-pressed={listingMode === mode}
            className={cn(
              "h-8 rounded-full px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest",
              listingMode === mode ? "bg-warm-surface text-ink shadow-sm" : "text-muted-foreground",
            )}
          >
            {mode === "rent" ? "Rent" : "Buy"}
          </button>
        ))}
      </div>
      <div className="mt-3">
        <FilterBar
          filters={filters}
          onFilterChange={handleFilterChange}
          resultCount={visibleListings.length}
          isLoading={isLoadingListings}
          dropdownPlacement={isGridView ? "bottom" : "top"}
          condensed
          density={mobileSheetDensity}
        />
      </div>
    </div>
  );

  const mobileSheetContent = (
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

      {renderExploreSections("mb-4 mt-4")}
    </div>
  );



  return (
    <main className="relative h-dvh overflow-hidden bg-warm-surface text-ink flex flex-col">
      <h1 className="sr-only">Homes in view</h1>

      {/* Sticky desktop top navigation, logo + search + Map/List toggle */}
      <header className="hidden lg:flex flex-none items-center gap-5 pl-9 pr-28 py-3 bg-panel border-b border-border/40 z-[var(--z-chrome)] relative shadow-sm">
        {/* Logo + rental context */}
        <Link href="/" aria-label="Pinpoints home" className="flex items-center gap-3 shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" aria-hidden="true" className="h-8 w-auto" />
          <span className="ml-1 hidden items-center gap-1.5 rounded-full bg-warm-surface px-2.5 py-1 text-xs font-semibold text-ink xl:inline-flex">
            <span className="inline-flex size-2 rounded-full bg-forest" aria-hidden="true" />
            {listingModeLabel}
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-1 rounded-full border border-border/60 bg-warm-surface p-1" aria-label="Listing market">
          {(["rent", "buy"] as const).map((mode) => {
            const active = listingMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => handleListingModeChange(mode)}
                aria-pressed={active}
                className={cn(
                  "h-8 rounded-full px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest",
                  active ? "bg-panel text-ink shadow-sm" : "text-muted-foreground hover:text-ink",
                )}
              >
                {mode === "rent" ? "Rent" : "Buy"}
              </button>
            );
          })}
        </div>

        {/* Search — primary action, takes the flexible middle */}
        <div className="relative min-w-0 flex-1">
          <form role="search" className="flex min-w-0 items-center gap-3 rounded-full border border-border/60 bg-warm-surface px-4 py-2 shadow-sm transition-colors focus-within:border-forest focus-within:ring-1 focus-within:ring-forest" onSubmit={handleSearchSubmit}>
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              ref={desktopSearchInputRef}
              type="search"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted-foreground"
              placeholder="Search neighbourhood or city"
              value={searchQuery}
              onChange={(event) => handleSearchChange(event.target.value)}
              onFocus={handleSearchFocus}
              onKeyDown={handleSearchKeyDown}
              aria-label="Search listings"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={searchSuggestionsOpen && locationSuggestions.length > 0}
              aria-controls="desktop-location-suggestions"
              aria-activedescendant={
                searchSuggestionsOpen && resolvedActiveSearchSuggestionIndex >= 0
                  ? `desktop-location-suggestions-option-${resolvedActiveSearchSuggestionIndex}`
                  : undefined
              }
            />
            <button
              type="button"
              aria-label={activeFilterCount > 0 ? `Filter listings, ${activeFilterCount} active` : "Filter listings"}
              aria-expanded={showFilters}
              onClick={() => {
                setSearchSuggestionsOpen(false);
                setShowFilters((value) => !value);
              }}
              className={cn(
                "relative flex size-8 items-center justify-center rounded-full border border-border/60 shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                showFilters || activeFilterCount > 0 ? "bg-forest text-primary-foreground" : "bg-panel text-muted-foreground",
              )}
            >
              <SlidersHorizontal className="size-3.5" aria-hidden="true" />
              {activeFilterCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-clay text-[10px] font-bold text-primary-foreground">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          </form>

          <SearchSuggestions
            id="desktop-location-suggestions"
            suggestions={locationSuggestions}
            open={searchSuggestionsOpen}
            activeIndex={resolvedActiveSearchSuggestionIndex}
            onActiveIndexChange={setActiveSearchSuggestionIndex}
            onSelect={(suggestion) => {
              handleSuggestionSelect(suggestion);
              desktopSearchInputRef.current?.focus();
            }}
          />

          {showFilters ? (
            <section
              aria-label="Listing filters"
              className="absolute right-0 top-[calc(100%+0.75rem)] z-[var(--z-filter-dropdown,35)] w-[min(46rem,calc(100vw-4rem))] rounded-2xl border border-border/60 bg-panel p-4 shadow-[var(--elevation-3)]"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-ink">Refine homes in view</h2>
                  <p className="text-xs text-muted-foreground">Results update as filters change.</p>
                </div>
                <div className="flex items-center gap-2">
                  {activeFilterCount > 0 ? (
                    <button type="button" onClick={() => handleFilterChange({})} className="min-h-10 rounded-full px-3 text-xs font-semibold text-forest hover:bg-warm-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      Clear all
                    </button>
                  ) : null}
                  <button type="button" onClick={() => setShowFilters(false)} aria-label="Close filters" className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-warm-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <FilterBar
                filters={filters}
                onFilterChange={handleFilterChange}
                resultCount={visibleListings.length}
                isLoading={isLoadingListings}
                dropdownPlacement="bottom"
                showSearchButton={false}
              />
            </section>
          ) : null}
        </div>

        {/* Map/List segmented control */}
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
            <List className="size-4" />
            List
          </button>
        </div>

      </header>


      <div className="flex-1 min-h-0 relative flex flex-col lg:flex-row">
        {isLoadingListings && visibleListings.length > 0 ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[calc(var(--z-chrome)+1)] h-0.5 overflow-hidden bg-forest/10" role="status" aria-label="Updating homes in this area">
            <div className="h-full w-1/3 animate-[discovery-loading-track_1.1s_var(--ease-out-quart)_infinite] bg-forest motion-reduce:animate-pulse" />
          </div>
        ) : null}
        {detailListing && (
          <div className={cn(
            "hidden lg:flex flex-col overflow-hidden bg-warm-surface border-r border-border/40 z-10 relative shadow-[var(--elevation-2)]",
            "w-[30%] min-w-[340px]"
          )}>
            <div
              key={detailListing.id}
              className="flex h-full flex-col animate-in fade-in slide-in-from-left-4 duration-300 ease-[var(--ease-out-quart)] motion-reduce:animate-none"
            >
              <ListingDetailPanel listing={detailListing} initialIntent={initialIntent} onBack={() => setDetailListing(null)} compact />
            </div>
          </div>
        )}

        {/* Left Listings Panel (desktop) — floating rounded bento card over the full-width map */}
        {!detailListing && !isGridView ? renderDesktopListingsPanel("floating") : null}
        {!detailListing && isGridView ? renderDesktopListingsPanel("fullscreen") : null}

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
            onPlaceSuggestionsChange={setPlaceSuggestions}
            initialCenter={initialCenter}
            searchQuery={urlQuery}
            searchPlaceId={urlPlaceId}
            mobileBottomPadding={mobileSheetHeight}
            poiMarkers={pois}
            detailOpen={Boolean(detailListing)}
          >
            <MapControls 
              className={cn(
                "absolute top-[9.5rem] z-[var(--z-controls)] lg:top-8",
                isGridView ? "hidden" : "",
              )}
              onLayersClick={() => setIsLayersPanelOpen(!isLayersPanelOpen)}
              activeLayerCount={activeLayers.size}
            />
            <div ref={mobileLayerPanelRef} className={cn(
              "fixed inset-x-3 top-[8.75rem] z-[var(--z-chrome)] lg:absolute lg:inset-x-auto lg:right-[5.5rem] lg:top-6 lg:z-[var(--z-controls)]",
              isGridView ? "hidden" : "",
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
          onSearchChange={handleSearchChange}
          onSearchSubmit={submitSearch}
          onClearSearch={handleClearSearch}
          onToggleFilters={() => {
            setSearchSuggestionsOpen(false);
            if (showFilters) {
              setShowFilters(false);
            } else {
              setDraftFilters(filters);
              setShowFilters(true);
            }
          }}
          filtersActive={showFilters}
          activeFilterCount={activeFilterCount}
          searchSuggestions={locationSuggestions}
          searchSuggestionsOpen={searchSuggestionsOpen}
          onSearchFocus={handleSearchFocus}
          onSearchKeyDown={handleSearchKeyDown}
          activeSearchSuggestionIndex={resolvedActiveSearchSuggestionIndex}
          onActiveSearchSuggestionIndexChange={setActiveSearchSuggestionIndex}
          onSuggestionSelect={(suggestion) => {
            handleSuggestionSelect(suggestion);
            mobileSearchInputRef.current?.focus();
          }}
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
          heroSlot={null}
        >
          {showFilters ? (
            <>
              <button
                type="button"
                aria-label="Close filters"
                onClick={() => setShowFilters(false)}
                className="pointer-events-auto fixed inset-0 z-[calc(var(--z-chrome)+1)] bg-ink/10"
              />
              <section
                role="dialog"
                aria-modal="true"
                aria-label="Listing filters"
                className="pointer-events-auto fixed inset-x-3 bottom-3 z-[calc(var(--z-chrome)+2)] rounded-2xl border border-border/60 bg-panel p-4 shadow-[var(--elevation-3)]"
                style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-ink">Refine homes in view</h2>
                    <p className="text-xs text-muted-foreground">
                      {isLoadingListings ? "Updating preview..." : `${draftResultCount} homes in view`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {draftActiveFilterCount > 0 ? (
                      <button type="button" onClick={() => setDraftFilters({})} className="min-h-10 rounded-full px-3 text-xs font-semibold text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        Clear all
                      </button>
                    ) : null}
                    <button type="button" onClick={() => setShowFilters(false)} aria-label="Close filters" className="flex size-10 items-center justify-center rounded-full bg-warm-surface text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <FilterBar
                  filters={draftFilters}
                  onFilterChange={setDraftFilters}
                  resultCount={draftResultCount}
                  isLoading={isLoadingListings}
                  showSearchButton={false}
                />
                <div className="mt-4 flex gap-2 border-t border-border/60 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowFilters(false)}
                    className="min-h-11 flex-1 rounded-full border border-border bg-panel px-4 text-sm font-semibold text-ink hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleFilterChange(draftFilters);
                      setShowFilters(false);
                    }}
                    className="min-h-11 flex-[1.4] rounded-full bg-forest px-4 text-sm font-semibold text-primary-foreground hover:bg-forest/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Show {draftResultCount} homes
                  </button>
                </div>
              </section>
            </>
          ) : null}
        </MobileDiscoveryShell>

        {/* Mobile Bottom_Sheet — three-snap, drag-aware listings sheet. Rendered
            outside the heroSlot wrapper so it can self-anchor to the viewport
            bottom and manage its own drag/scroll/scrim behaviour. */}
        {!detailListing && isGridView ? (
          <section
            aria-label="Listings list view"
            className="fixed inset-0 z-[var(--z-list-view)] flex flex-col bg-warm-surface lg:hidden"
          >
            <div
              className="flex-none bg-warm-surface pb-3"
              style={{ paddingTop: "calc(var(--mobile-safe-top) + 6.75rem)" }}
            >
              {mobileSheetHeader}
            </div>
            <div
              className="scroll-contained min-h-0 flex-1 overflow-y-auto px-2"
              style={{ paddingBottom: "calc(var(--mobile-safe-bottom) + 1rem)" }}
              onScroll={mobileSheetScroll.onScroll}
            >
              {mobileSheetContent}
            </div>
          </section>
        ) : null}

        {!detailListing && !isGridView ? (
          <MobileBottomSheet
            snap={sheetSnap}
            onSnapChange={handleSheetSnapChange}
            aria-label={sheetSnap === "expanded" ? "Collapse listings sheet" : "Expand listings sheet"}
            header={mobileSheetHeader}
            onContentScroll={mobileSheetScroll.onScroll}
            onVisibleHeightChange={setMobileSheetHeight}
          >
            {mobileSheetContent}
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
