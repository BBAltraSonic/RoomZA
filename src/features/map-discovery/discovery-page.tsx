"use client";

import { Search, ArrowRight, ChevronDown, ChevronUp, Maximize2, Minimize2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { LayoutGroup } from "motion/react";

import { useOnClickOutside } from "@/lib/hooks/use-on-click-outside";
import { useHorizontalScrollAffordance } from "@/lib/hooks/use-horizontal-scroll-affordance";
import { useScrollAdaptation } from "@/lib/hooks/use-scroll-adaptation";
import { AnimatedNumber } from "@/lib/motion/primitives";
import type { Role } from "@/lib/roles";
import { cn, formatPrice } from "@/lib/utils";
import { forwardGeocode } from "@/lib/maptiler";
import type { DiscoveryPlace } from "@/features/places/place";
import { DiscoverySearchProvider } from "@/components/navigation/discovery-search-dock";
import { DiscoverySortSelect, PinpointHeader } from "@/components/navigation/pinpoint-header";
import {
  LISTING_SEARCH_QUERY_MAX_LENGTH,
  limitListingSearchDraft,
  normalizeListingSearchQuery,
} from "@/features/listings/search-query";
import { isNewListing } from "@/features/listings/listing-freshness";

import type { ListingDetail } from "./listing-detail-panel";
import { ListingCarouselSkeleton } from "./discovery-loading";
import { DISCOVERY_SORT_OPTIONS, type DiscoverySortOption } from "./ranking";

// The detail panel is only rendered once a listing is selected (or deep-linked),
// and it pulls in the application modal, chat actions, image lightbox, and the
// Supabase client. Load it lazily so none of that ships in the `/` initial
// bundle (keeps the route within the 300 KB initial-JS budget, Req 9.5).
const ListingDetailPanel = dynamic(
  () => import("./listing-detail-panel").then((m) => m.ListingDetailPanel),
  { ssr: false },
);
import { useDiscoveryControls } from "@/features/discovery/url-controls";
import { MapViewLoader } from "./map-view-loader";
import type { ClusterPreviewPayload } from "./map-view";
import type { ViewportContext } from "./lib/viewport-context";
import { EmptyStateCapture } from "./empty-state-capture";
import { QuickFilterEmptyState } from "./quick-filter-empty-state";
import { useFavorites } from "./hooks/use-favorites";
import { PropertyQuickFilters } from "./desktop-filter-row";
import { FilterBar, type FilterState } from "./filter-bar";
import { PropertyEmptyState } from "./property-empty-state";
import { LocationSelector } from "./location-selector";
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
import { applyQuickFilter, loadRecentlyViewed, parseQuickFilter, recordRecentlyViewed, type RecentlyViewedEntry } from "./lib/quick-filters";
import type { SheetSnap } from "./lib/sheet";
import { latestSort, mostNearestSort } from "./lib/sort";
import type { GeoPoint, ListingCardModel, MapSearchTarget, QuickFilterKey } from "./lib/types";
import type { BlogPostSummary } from "@/features/blog/types";
import type { LandlordTrustSummary } from "@/features/trust/landlord-signals";
import type { PresenceBadge } from "@/features/presence/presence-status";
import type { ListingLiveActivity } from "./live-activity";
import { MobileBottomSheet } from "./mobile/bottom-sheet";
import type { QuickFilterNavigation } from "./mobile/explore-sections";

const ListingCarousel = dynamic(
  () => import("./mobile/listing-carousel").then((module) => module.ListingCarousel),
  {
    loading: () => <ListingCarouselSkeleton />,
  },
);

// Quick filters and editorial discovery sit below the map-first results experience.
// Keep its rich card content out of the route's critical JS path and hydrate it
// independently when React reaches the section.
const DiscoveryExploreSections = dynamic(
  () => import("./mobile/explore-sections").then((module) => module.DiscoveryExploreSections),
);

/** sessionStorage key for persisting the mobile Bottom_Sheet snap position. */
const SHEET_SNAP_STORAGE_KEY = "roomza:mobile-sheet-snap";
const RECENT_SEARCHES_STORAGE_KEY = "roomza:discovery-recent-searches";
const PLACE_LOOKUP_ERROR = "This place could not be loaded. Choose a location again.";

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

function createDiscoveryParams(searchParams: Pick<URLSearchParams, "toString">) {
  const params = new URLSearchParams(searchParams.toString());
  params.delete("placeId");
  return params;
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
  nsfasApproved: boolean;
  listingReviewedAt: string | null;
  furnished: boolean;
  landlordTrust: LandlordTrustSummary | null;
  landlordPresence: PresenceBadge;
  liveTourId: string | null;
  hasInstantViewing: boolean;
  liveActivity: ListingLiveActivity;
  agent: {
    id: string;
    name: string;
    avatarUrl?: string;
    isVerified?: boolean;
  } | null;
};

type DiscoveryPageProps = {
  mapApiKey?: string;
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
    nsfasApproved?: boolean;
    listingReviewedAt?: string | null;
    furnished?: boolean;
    landlordTrust?: LandlordTrustSummary | null;
    landlordPresence?: PresenceBadge;
    liveTourId?: string | null;
    hasInstantViewing?: boolean;
    liveActivity?: ListingLiveActivity;
    agent?: Listing["agent"];
};

const VIEWPORT_QUERY_TIMEOUT_MS = 8000;
// A cold discovery load can take longer while the API/database connection is
// warming up. Do not turn that normal first response into a failed empty state.
const INITIAL_VIEWPORT_QUERY_TIMEOUT_MS = 12_000;
const LISTING_DETAIL_TIMEOUT_MS = 12_000;

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
    nsfasApproved: Boolean(pin.nsfasApproved),
    listingReviewedAt: pin.listingReviewedAt ?? null,
    furnished: Boolean(pin.furnished),
    landlordTrust: pin.landlordTrust ?? null,
    landlordPresence: pin.landlordPresence ?? "offline",
    liveTourId: pin.liveTourId ?? null,
    hasInstantViewing: Boolean(pin.hasInstantViewing),
    liveActivity: pin.liveActivity ?? {
      viewedToday: 0,
      viewingNow: 0,
      lastScheduledAt: null,
      lastRentedAt: null,
    },
    agent: pin.agent ?? null,
  };
}

export function DiscoveryPage({ mapApiKey, initialListing, initialIntent, initialBlogPosts = [] }: DiscoveryPageProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [showRenterWelcome, setShowRenterWelcome] = useState(() => searchParams.get("welcome") === "renter");

  const urlQuery = normalizeListingSearchQuery(searchParams.get("q"));
  const selectedArea = searchParams.get("area");
  const selectedAreaId = searchParams.get("areaId");
  const selectedAreaKey = `${selectedAreaId ?? ""}:${selectedArea ?? ""}`;
  const [areaResolution, setAreaResolution] = useState<{ key: string; center: GeoPoint } | null>(null);
  const lastViewportAreaRef = useRef("");
  const listingMode = searchParams.get("mode") === "buy" ? "buy" : "rent";
  const listingModeLabel = listingMode === "buy" ? "Properties" : "Rentals";
  const activeQuickFilter = parseQuickFilter(searchParams.get("quick"), listingMode);
  useEffect(() => {
    if (searchParams.get("welcome") !== "renter") return;
    const params = createDiscoveryParams(searchParams);
    params.delete("welcome");
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }, [pathname, router, searchParams]);
  const viewportQueryString = useMemo(() => {
    const params = createDiscoveryParams(searchParams);
    params.delete("quick");
    params.delete("placeId");
    params.delete("area");
    params.delete("areaId");
    params.delete("listingId");
    if (urlQuery) params.set("q", urlQuery);
    else params.delete("q");
    return params.toString();
  }, [searchParams, urlQuery]);
  const listingRequestRef = useRef<AbortController | null>(null);
  const discoveryHeaderRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = discoveryHeaderRef.current;
    if (!node) return;
    const update = () => node.style.setProperty("--pinpoint-header-height", node.getBoundingClientRect().height + "px");
    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(node);
    return () => observer?.disconnect();
  }, []);
  const hasLoadedViewportListingsRef = useRef(false);
  const detailRequestRef = useRef<AbortController | null>(null);
  const detailLinkAttemptRef = useRef<string | null>(null);
  const [visibleListings, setVisibleListings] = useState<Listing[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedEntry[]>([]);
  const [selectedListingId, setSelectedListingId] = useState<string | undefined>(initialListing?.id);
  const [previewedListingId, setPreviewedListingId] = useState<string | undefined>();
  const [clusterPreview, setClusterPreview] = useState<ClusterPreviewPayload | null>(null);
  const searchUrlKey = urlQuery;
  const [searchDraftState, setSearchDraftState] = useState(() => ({
    urlKey: searchUrlKey,
    value: urlQuery,
  }));
  const [activeSearchSurface, setActiveSearchSurface] = useState<"desktop" | "mobile" | null>(null);
  const [activeSearchSuggestionIndex, setActiveSearchSuggestionIndex] = useState(-1);
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searchTarget, setSearchTarget] = useState<MapSearchTarget | null>(null);
  const searchTargetNonceRef = useRef(0);
  const lastResolvedSearchQueryRef = useRef("");
  const lastResolvedAreaRef = useRef("");
  if (searchDraftState.urlKey !== searchUrlKey) {
    setSearchDraftState({ urlKey: searchUrlKey, value: urlQuery });
    setActiveSearchSurface(null);
    setActiveSearchSuggestionIndex(-1);
    setPlaceSuggestions([]);
  }
  const draftSearchQuery =
    searchDraftState.urlKey === searchUrlKey ? searchDraftState.value : urlQuery;
  const setDraftSearchQuery = useCallback((value: string) => {
    setSearchDraftState({ urlKey: searchUrlKey, value });
  }, [searchUrlKey]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setRecentlyViewed(loadRecentlyViewed());
      setRecentSearches(loadRecentSearches());
    });
    return () => { active = false; };
  }, []);
  const [viewportContext, setViewportContext] = useState<ViewportContext | null>(null);
  const resultLocationLabel = selectedArea?.split(",")[0] || viewportContext?.label || urlQuery || "this area";
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds | null>(null);
  // The first viewport request cannot begin until the map reports its bounds.
  // Start in a loading state so the results rail has useful structure while
  // the MapLibre bundle and MapTiler style initialize.
  const [isLoadingListings, setIsLoadingListings] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [listingError, setListingError] = useState<string | null>(null);
  const [detailListing, setDetailListing] = useState<ListingDetail | null>(initialListing ?? null);
  const [isDetailPanelExpanded, setIsDetailPanelExpanded] = useState(false);
  const clearDetailPanel = useCallback(() => {
    detailRequestRef.current?.abort();
    detailRequestRef.current = null;
    setIsLoadingDetail(false);
    setDetailListing(null);
    setSelectedListingId(undefined);
    setPreviewedListingId(undefined);
    setClusterPreview(null);
    setIsDetailPanelExpanded(false);
  }, [setSelectedListingId, setPreviewedListingId, setClusterPreview]);
  const closeDetailPanel = useCallback(() => {
    clearDetailPanel();
    if (pathname.startsWith("/listing/")) {
      router.push(listingMode === "buy" ? "/?mode=buy" : "/");
      return;
    }
    const params = createDiscoveryParams(searchParams);
    if (!params.has("listingId")) return;
    params.delete("listingId");
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }, [clearDetailPanel, listingMode, pathname, router, searchParams]);
  const [showFilters, setShowFilters] = useState(false);
  // Start in Peek so the map owns the first impression. Intentful actions
  // promote the sheet to Browse; Full List is reserved for deeper browsing.
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>("peek");
  const [mobileSheetHeight, setMobileSheetHeight] = useState(0);
  const mobileSheetScrollTopRef = useRef(0);
  const fitRequestNonceRef = useRef(0);
  const [fitListingsRequest, setFitListingsRequest] = useState<{ nonce: number } | null>(null);
  const clusterFitNonceRef = useRef(0);
  const [clusterFitRequest, setClusterFitRequest] = useState<{ bounds: ViewportBounds; nonce: number } | null>(null);
  const [pendingQuickFit, setPendingQuickFit] = useState<{
    key: QuickFilterKey;
    waitForFetch: boolean;
    sawLoading: boolean;
  } | null>(null);
  // Discovery sort UI state
  const { sort, setSort } = useDiscoveryControls(DISCOVERY_SORT_OPTIONS);
  const sortBy = sort as DiscoverySortOption;
  const setSortBy = setSort;
  const desktopListingsScrollRef = useRef<HTMLDivElement>(null);
  const mobileQuickFilterNavigation = useHorizontalScrollAffordance<HTMLUListElement>();
  const desktopSearchSurfaceRef = useRef<HTMLDivElement>(null);

  const closeSearchSuggestions = useCallback(() => {
    setActiveSearchSurface(null);
    setActiveSearchSuggestionIndex(-1);
  }, [setActiveSearchSurface, setActiveSearchSuggestionIndex]);

  useOnClickOutside(desktopSearchSurfaceRef, () => {
    if (activeSearchSurface === "desktop") closeSearchSuggestions();
  });

  useEffect(() => {
    if (detailListing) document.body.dataset.navigationFocus = "true";
    else delete document.body.dataset.navigationFocus;
    return () => {
      delete document.body.dataset.navigationFocus;
    };
  }, [detailListing]);

  // Distance origin for the card model pipeline (Req 6.3, Data Gap 2):
  // best-effort visitor geolocation; falls back to the current map center
  // (derived from viewportBounds), else null => distanceKm is null.
  const [geoOrigin, setGeoOrigin] = useState<GeoPoint | null>(null);
  const desktopSearchInputRef = useRef<HTMLInputElement>(null);


  const {
    favorites,
    isLoading: isLoadingFavorites,
    error: favoritesError,
    authenticated: favoritesAuthenticated,
  } = useFavorites();

  const [filters, setFilters] = useState<FilterState>(() => ({
    price: {
      min: searchParams.has("minPrice") ? Number(searchParams.get("minPrice")) : undefined,
      max: searchParams.has("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined,
    },
    beds: searchParams.has("beds") ? Number(searchParams.get("beds")) : undefined,
    baths: searchParams.has("baths") ? Number(searchParams.get("baths")) : undefined,
    propertyTypes: searchParams.get("type") ? searchParams.get("type")!.split(",") : undefined,
    ...(searchParams.has("availableNow") ? { availableNow: true } : {}),
    ...(searchParams.has("liveTours") ? { liveTours: true } : {}),
    ...(searchParams.has("instantViewings") ? { instantViewings: true } : {}),
    ...(searchParams.has("repliesUnder5") ? { repliesUnder5: true } : {}),
  }));

  const filteredListings = useMemo(
    () => capListings(applyQuickFilter(visibleListings, activeQuickFilter, { favoriteIds: favorites, recentlyViewed })),
    [activeQuickFilter, favorites, recentlyViewed, visibleListings],
  );
  const isLoadingResults = isLoadingListings || (activeQuickFilter === "favourites" && isLoadingFavorites);
  const recentlyAddedCount = useMemo(
    () => filteredListings.filter((listing) => isNewListing(listing.createdAt)).length,
    [filteredListings],
  );
  const resultUpdateCopy = isLoadingResults && filteredListings.length > 0
    ? "Updating this map view..."
    : recentlyAddedCount > 0
      ? `${recentlyAddedCount} added in the last 7 days`
      : "Updated for this map view";

  const activeFilterCount = useMemo(
    () =>
      Number(Boolean(filters.price?.min || filters.price?.max)) +
      Number(filters.beds !== undefined) +
      Number(filters.baths !== undefined) +
      Number(Boolean(filters.propertyTypes?.length)) +
      Number(Boolean(filters.availableNow)) +
      Number(Boolean(filters.liveTours)) +
      Number(Boolean(filters.instantViewings)) +
      Number(Boolean(filters.repliesUnder5)),
    [filters],
  );

  const handleQuickFilterChange = useCallback((quickFilter: QuickFilterKey, clearSearch = false) => {
    const params = createDiscoveryParams(searchParams);
    const clearsAdvancedFilters = quickFilter === "all";
    if (clearSearch) {
      params.delete("q");
      setDraftSearchQuery("");
      setActiveSearchSurface(null);
      setActiveSearchSuggestionIndex(-1);
      setPlaceSuggestions([]);
      setSearchTarget(null);
      lastResolvedSearchQueryRef.current = "";
    }
    if (clearsAdvancedFilters) {
      params.delete("quick");
      params.delete("minPrice");
      params.delete("maxPrice");
      params.delete("beds");
      params.delete("baths");
      params.delete("type");
      params.delete("availableNow");
      params.delete("liveTours");
      params.delete("instantViewings");
      params.delete("repliesUnder5");
      setFilters({});
    } else {
      params.set("quick", quickFilter);
    }
    params.delete("listingId");
    setSelectedListingId(undefined);
    setPreviewedListingId(undefined);
    setClusterPreview(null);
    clearDetailPanel();
    setPendingQuickFit({
      key: quickFilter,
      waitForFetch: clearsAdvancedFilters && activeFilterCount > 0,
      sawLoading: false,
    });
    router.replace(`${pathname}?${params.toString()}`);
  }, [activeFilterCount, clearDetailPanel, pathname, router, searchParams, setDraftSearchQuery, setActiveSearchSurface, setActiveSearchSuggestionIndex, setPlaceSuggestions, setSearchTarget, setSelectedListingId, setPreviewedListingId, setClusterPreview]);

  useEffect(() => {
    if (!pendingQuickFit || pendingQuickFit.key !== activeQuickFilter) return;
    if (pendingQuickFit.waitForFetch && !pendingQuickFit.sawLoading) {
      if (!isLoadingListings) return;
      const timeoutId = window.setTimeout(() => {
        setPendingQuickFit((current) => current ? { ...current, sawLoading: true } : current);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }
    if (isLoadingResults) return;
    const timeoutId = window.setTimeout(() => {
      fitRequestNonceRef.current += 1;
      setFitListingsRequest({ nonce: fitRequestNonceRef.current });
      if (filteredListings.length === 1) setSelectedListingId(filteredListings[0]?.id);
      setPendingQuickFit(null);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [activeQuickFilter, filteredListings, isLoadingListings, isLoadingResults, pendingQuickFit]);

  useEffect(() => {
    if (activeQuickFilter === "all" || isLoadingResults) return;
    const ids = new Set(filteredListings.map((listing) => listing.id));
    const timeoutId = window.setTimeout(() => {
      setSelectedListingId((current) => current && !ids.has(current) ? undefined : current);
      if (detailListing && !ids.has(detailListing.id)) closeDetailPanel();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [activeQuickFilter, closeDetailPanel, detailListing, filteredListings, isLoadingResults]);

  useEffect(() => {
    const query = draftSearchQuery.trim();
    if (!mapApiKey || query.length < 2) return;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      forwardGeocode({
        apiKey: mapApiKey,
        query,
        limit: 6,
        proximity: viewportBounds
          ? {
            lat: (viewportBounds.south + viewportBounds.north) / 2,
            lng: (viewportBounds.west + viewportBounds.east) / 2,
          }
          : undefined,
        types: ["address", "road", "neighbourhood", "locality", "place", "municipality"],
        signal: controller.signal,
      }).then((locations) => {
        if (controller.signal.aborted) return;
        const next = locations.slice(0, 6).map((location) => ({
          providerId: location.id,
          label: location.label,
          secondaryLabel: location.secondaryLabel,
          target: {
            center: location.center,
            bounds: location.bounds,
          },
        }));
        setPlaceSuggestions(next);
      }).catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPlaceSuggestions([]);
      });
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [draftSearchQuery, mapApiKey, viewportBounds]);

  useEffect(() => {
    if (!mapApiKey || selectedArea || !urlQuery || lastResolvedSearchQueryRef.current === urlQuery) return;
    const controller = new AbortController();
    forwardGeocode({
      apiKey: mapApiKey,
      query: urlQuery,
      limit: 1,
      autocomplete: false,
      types: ["address", "road", "neighbourhood", "locality", "place", "municipality"],
      signal: controller.signal,
    }).then((locations) => {
      const location = locations[0];
      if (!location || controller.signal.aborted) return;
      lastResolvedSearchQueryRef.current = urlQuery;
      searchTargetNonceRef.current += 1;
      setSearchTarget({
        center: location.center,
        bounds: location.bounds,
        nonce: searchTargetNonceRef.current,
      });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      if (error instanceof DOMException && error.name === "AbortError") return;
    });
    return () => controller.abort();
  }, [mapApiKey, selectedArea, urlQuery]);

  useEffect(() => {
    if (!selectedAreaId && !selectedArea) return;
    const areaKey = `${selectedAreaId ?? ""}:${selectedArea}`;
    if (lastResolvedAreaRef.current === areaKey) return;
    const controller = new AbortController();
    const stableId = selectedAreaId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedAreaId);
    const lookupParams = new URLSearchParams();
    if (selectedArea) lookupParams.set("q", selectedArea);
    if (selectedAreaId && !stableId) lookupParams.set("providerId", selectedAreaId);
    const url = stableId ? `/api/places/${selectedAreaId}` : `/api/places?${lookupParams.toString()}`;
    fetch(url, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("Place lookup failed");
      return response.json() as Promise<{ data: { place?: DiscoveryPlace; places?: DiscoveryPlace[] } }>;
    }).then((payload) => {
      if (controller.signal.aborted) return;
      const normalizedArea = selectedArea?.trim().toLocaleLowerCase("en-ZA");
      const matchingPlaces = payload.data.places?.filter((item) =>
        item.fullAddress.toLocaleLowerCase("en-ZA") === normalizedArea ||
        item.label.toLocaleLowerCase("en-ZA") === normalizedArea,
      ) ?? [];
      const location = stableId ? payload.data.place : selectedAreaId
        ? payload.data.places?.find((item) => item.providerId === selectedAreaId)
        : matchingPlaces.length === 1 ? matchingPlaces[0] : undefined;
      if (!location) {
        setVisibleListings([]);
        setListingError(PLACE_LOOKUP_ERROR);
        setIsLoadingListings(false);
        return;
      }
      lastResolvedAreaRef.current = areaKey;
      setAreaResolution({ key: selectedAreaKey, center: location.center });
      searchTargetNonceRef.current += 1;
      setSearchTarget({ center: location.center, bounds: location.bounds, nonce: searchTargetNonceRef.current });
      if (!stableId || selectedArea !== location.fullAddress) {
        const params = createDiscoveryParams(searchParams);
        params.set("area", location.fullAddress);
        params.set("areaId", location.id);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }
    }).catch(() => {
      if (!controller.signal.aborted) {
        setVisibleListings([]);
        setListingError(PLACE_LOOKUP_ERROR);
        setIsLoadingListings(false);
      }
    });
    return () => controller.abort();
  }, [pathname, router, searchParams, selectedArea, selectedAreaId, selectedAreaKey]);

  const locationSuggestions = useMemo(
    () => buildLocationSuggestions({
      query: draftSearchQuery,
      recentSearches,
      placeSuggestions:
        mapApiKey && draftSearchQuery.trim().length >= 2 ? placeSuggestions : [],
      inViewCandidates: [
        viewportContext?.label ?? "",
        ...visibleListings.flatMap((listing) => [listing.title, listing.area]),
      ],
    }),
    [
      draftSearchQuery,
      mapApiKey,
      placeSuggestions,
      recentSearches,
      viewportContext?.label,
      visibleListings,
    ],
  );

  const resolvedActiveSearchSuggestionIndex =
    activeSearchSuggestionIndex < locationSuggestions.length
      ? activeSearchSuggestionIndex
      : -1;

  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
    setPreviewedListingId(undefined);
    setClusterPreview(null);
    const params = createDiscoveryParams(searchParams);

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

    for (const [key, active] of [
      ["availableNow", newFilters.availableNow],
      ["liveTours", newFilters.liveTours],
      ["instantViewings", newFilters.instantViewings],
      ["repliesUnder5", newFilters.repliesUnder5],
    ] as const) {
      if (active) params.set(key, "1");
      else params.delete(key);
    }

    router.replace(`${pathname}?${params.toString()}`);
  }, [searchParams, pathname, router, setPreviewedListingId, setClusterPreview]);

  const initialCenter = useMemo(() => {
    if (!initialListing) return undefined;
    return { lat: initialListing.latitude, lng: initialListing.longitude };
  }, [initialListing]);

  const handleViewDetail = useCallback((listingId: string, syncHistory = true) => {
    setSelectedListingId(listingId);
    setPreviewedListingId(undefined);
    setClusterPreview(null);
    setListingError(null);
    detailRequestRef.current?.abort();

    if (syncHistory && pathname === "/" && searchParams.get("listingId") !== listingId) {
      const params = createDiscoveryParams(searchParams);
      params.set("listingId", listingId);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }

    const controller = new AbortController();
    detailRequestRef.current = controller;
    setIsLoadingDetail(true);

    let didTimeOut = false;
    const timeoutId = setTimeout(() => {
      if (detailRequestRef.current !== controller) return;
      didTimeOut = true;
      controller.abort();
    }, LISTING_DETAIL_TIMEOUT_MS);

    const detailUrl = listingMode === "buy" ? `/api/listings/${listingId}?mode=buy` : `/api/listings/${listingId}`;
    fetch(detailUrl, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("Listing details could not be loaded.");
        const payload = (await res.json()) as ListingDetailResponse;
        if (detailRequestRef.current !== controller || controller.signal.aborted) return;
        if (payload.data.id !== listingId) throw new Error("Listing details did not match the selected home.");
        setDetailListing(payload.data);
        setRecentlyViewed((current) => recordRecentlyViewed(current, listingId));
      })
      .catch((error: unknown) => {
        if (detailRequestRef.current !== controller || (controller.signal.aborted && !didTimeOut)) return;
        if (error instanceof DOMException && error.name === "AbortError" && !didTimeOut) {
          return;
        }
        setListingError(didTimeOut ? "Listing details could not be loaded within 12 seconds." : "Listing details could not be loaded.");
      })
      .finally(() => {
        clearTimeout(timeoutId);
        if (detailRequestRef.current === controller) {
          detailRequestRef.current = null;
          setIsLoadingDetail(false);
        }
      });
  }, [listingMode, pathname, router, searchParams, setSelectedListingId, setPreviewedListingId, setClusterPreview, setRecentlyViewed]);

  // A market switch invalidates every read started for the previous market.
  useEffect(() => () => {
    detailRequestRef.current?.abort();
    detailRequestRef.current = null;
  }, [listingMode]);

  const handleViewMobileDetail = useCallback((listingId: string) => {
    // Detail is a separate mental state. Closing it returns to Browse at the
    // exact list position captured by the sheet scroll callback.
    setSheetSnap("browse");
    try {
      window.sessionStorage.setItem(SHEET_SNAP_STORAGE_KEY, "browse");
    } catch {
      /* ignore persistence failures */
    }
    handleViewDetail(listingId);
  }, [handleViewDetail]);

  const handleSelectListing = useCallback((listingId: string) => {
    detailRequestRef.current?.abort();
    detailRequestRef.current = null;
    setIsLoadingDetail(false);
    setDetailListing(null);
    setSelectedListingId(listingId);
    setPreviewedListingId(undefined);
    setClusterPreview(null);
    if (listingId) {
      setSheetSnap("browse");
      try {
        window.sessionStorage.setItem(SHEET_SNAP_STORAGE_KEY, "browse");
      } catch {
        /* ignore persistence failures */
      }
    }
  }, [setSelectedListingId, setPreviewedListingId, setClusterPreview]);

  useEffect(() => {
    const listingIdParam = searchParams.get("listingId");
    if (listingIdParam) {
      const attemptKey = `${listingMode}:${listingIdParam}`;
      if (detailListing?.id === listingIdParam || detailLinkAttemptRef.current === attemptKey || (selectedListingId === listingIdParam && isLoadingDetail)) return;
      const timeoutId = window.setTimeout(() => {
        detailLinkAttemptRef.current = attemptKey;
        handleViewDetail(listingIdParam, false);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }
    detailLinkAttemptRef.current = null;
    if (pathname === "/" && detailListing && !initialListing) {
      const timeoutId = window.setTimeout(clearDetailPanel, 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [clearDetailPanel, detailListing, handleViewDetail, initialListing, isLoadingDetail, listingMode, pathname, searchParams, selectedListingId]);

  const replaceSearchQuery = useCallback((nextQuery: string) => {
    setPreviewedListingId(undefined);
    setClusterPreview(null);
    const params = createDiscoveryParams(searchParams);
    const normalizedQuery = normalizeListingSearchQuery(nextQuery);
    if (normalizedQuery) {
      params.set("q", normalizedQuery);
    } else {
      params.delete("q");
    }
    params.delete("placeId");
    router.replace(`${pathname}?${params.toString()}`);
  }, [searchParams, router, pathname, setPreviewedListingId, setClusterPreview]);

  const rememberSearch = useCallback((value: string) => {
    const normalized = normalizeListingSearchQuery(value);
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
  }, [setRecentSearches]);

  const submitSearch = useCallback(() => {
    closeSearchSuggestions();
    const normalizedQuery = normalizeListingSearchQuery(draftSearchQuery);
    setDraftSearchQuery(normalizedQuery);
    rememberSearch(normalizedQuery);
    replaceSearchQuery(normalizedQuery);
  }, [closeSearchSuggestions, draftSearchQuery, rememberSearch, replaceSearchQuery, setDraftSearchQuery]);

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    submitSearch();
  };

  const handleClearSearch = () => {
    setDraftSearchQuery("");
    closeSearchSuggestions();
    setPlaceSuggestions([]);
    setSearchTarget(null);
    lastResolvedSearchQueryRef.current = "";
    replaceSearchQuery("");
  };

  const handleSearchChange = useCallback((value: string, surface: "desktop" | "mobile") => {
    const limitedValue = limitListingSearchDraft(value);
    setDraftSearchQuery(limitedValue);
    setActiveSearchSuggestionIndex(-1);
    if (limitedValue.trim().length < 2) {
      setPlaceSuggestions([]);
    }
    const shouldOpen =
      limitedValue.trim().length >= 2 ||
      (!limitedValue.trim() && recentSearches.length > 0);
    setActiveSearchSurface(shouldOpen ? surface : null);
  }, [recentSearches.length, setDraftSearchQuery, setActiveSearchSuggestionIndex, setPlaceSuggestions, setActiveSearchSurface]);

  const handleSuggestionSelect = useCallback((suggestion: LocationSuggestion) => {
    const normalizedLabel = normalizeListingSearchQuery(suggestion.label);
    setDraftSearchQuery(normalizedLabel);
    closeSearchSuggestions();
    rememberSearch(normalizedLabel);
    if (suggestion.target) {
      searchTargetNonceRef.current += 1;
      lastResolvedSearchQueryRef.current = normalizedLabel;
      setSearchTarget({
        ...suggestion.target,
        nonce: searchTargetNonceRef.current,
      });
    }
    replaceSearchQuery(normalizedLabel);
  }, [closeSearchSuggestions, rememberSearch, replaceSearchQuery, setDraftSearchQuery, setSearchTarget]);

  const handleLocationSelect = useCallback((location: DiscoveryPlace) => {
    clearDetailPanel();
    const params = createDiscoveryParams(searchParams);
    params.delete("listingId");
    params.set("area", location.fullAddress);
    params.set("areaId", location.id);
    lastResolvedAreaRef.current = `${location.id}:${location.fullAddress}`;
    searchTargetNonceRef.current += 1;
    setSearchTarget({ center: location.center, bounds: location.bounds, nonce: searchTargetNonceRef.current });
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [clearDetailPanel, pathname, router, searchParams, setSearchTarget]);

  const handleSearchFocus = useCallback((surface: "desktop" | "mobile") => {
    const hasRecentSearches = !draftSearchQuery.trim() && recentSearches.length > 0;
    setActiveSearchSurface(
      draftSearchQuery.trim().length >= 2 || hasRecentSearches ? surface : null,
    );
  }, [draftSearchQuery, recentSearches.length, setActiveSearchSurface]);

  const handleSearchKeyDown = useCallback((
    event: React.KeyboardEvent<HTMLInputElement>,
    surface: "desktop" | "mobile",
  ) => {
    const suggestionsOpen = activeSearchSurface === surface;
    if (event.key === "Escape") {
      if (suggestionsOpen) event.preventDefault();
      closeSearchSuggestions();
      event.currentTarget.focus();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (locationSuggestions.length === 0) return;
      event.preventDefault();
      setActiveSearchSurface(surface);
      setActiveSearchSuggestionIndex((current) =>
        moveSuggestionIndex(current, locationSuggestions.length, event.key === "ArrowDown" ? 1 : -1),
      );
      return;
    }

    if (
      event.key === "Enter" &&
      suggestionsOpen &&
      resolvedActiveSearchSuggestionIndex >= 0
    ) {
      const suggestion = locationSuggestions[resolvedActiveSearchSuggestionIndex];
      if (!suggestion) return;
      event.preventDefault();
      handleSuggestionSelect(suggestion);
    }
  }, [activeSearchSurface, closeSearchSuggestions, handleSuggestionSelect, locationSuggestions, resolvedActiveSearchSuggestionIndex, setActiveSearchSurface, setActiveSearchSuggestionIndex]);

  const handleListingModeChange = useCallback((mode: "rent" | "buy") => {
    const params = createDiscoveryParams(searchParams);
    if (mode === "buy") params.set("mode", "buy");
    else params.delete("mode");
    if (mode === "buy" && activeQuickFilter === "nsfas-approved") params.delete("quick");
    clearDetailPanel();
    setSelectedListingId(undefined);
    router.replace(`${pathname}?${params.toString()}`);
  }, [activeQuickFilter, clearDetailPanel, pathname, router, searchParams, setSelectedListingId]);

  useEffect(() => {
    listingRequestRef.current?.abort();
    if (!viewportBounds) return;
    if ((selectedAreaId || selectedArea) && (
      areaResolution?.key !== selectedAreaKey ||
      (lastViewportAreaRef.current !== selectedAreaKey && viewportBounds && areaResolution &&
        (areaResolution.center.lng < viewportBounds.west || areaResolution.center.lng > viewportBounds.east ||
         areaResolution.center.lat < viewportBounds.south || areaResolution.center.lat > viewportBounds.north))
    )) {
      let active = true;
      queueMicrotask(() => { if (active) setVisibleListings([]); });
      return () => { active = false; };
    }
    lastViewportAreaRef.current = selectedAreaKey;
    const controller = new AbortController();
    listingRequestRef.current = controller;
    const bbox = viewportBounds ? formatBboxParam(viewportBounds) : null;

    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setIsLoadingListings(true);
      setListingError(null);
    });

    const queryParams = new URLSearchParams(viewportQueryString);
    if (bbox) queryParams.set("bbox", bbox);
    else if (selectedAreaId) queryParams.set("areaId", selectedAreaId);

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
        if (listingRequestRef.current !== controller || controller.signal.aborted) return;
        const nextListings = payload.data.listings.map(toListing);
        hasLoadedViewportListingsRef.current = true;
        setVisibleListings(nextListings);
        setSelectedListingId((currentId) =>
          nextListings.some((listing) => listing.id === currentId) ? currentId : undefined,
        );
      })
      .catch((error: unknown) => {
        if (listingRequestRef.current !== controller || (controller.signal.aborted && !didTimeOut)) return;
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
    return () => controller.abort();
  }, [areaResolution, selectedArea, selectedAreaId, selectedAreaKey, viewportBounds, viewportQueryString]);

  useEffect(() => {
    return () => {
      listingRequestRef.current?.abort();
      detailRequestRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const refreshLiveSignals = () => {
      if (document.visibilityState !== "visible") return;
      setViewportBounds((current) => current ? { ...current } : current);
    };
    const intervalId = window.setInterval(refreshLiveSignals, 45_000);
    document.addEventListener("visibilitychange", refreshLiveSignals);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshLiveSignals);
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
    const capped = capListings(filteredListings);
    const models = capped.map<ListingCardModel>((listing) => ({
      id: listing.id,
      title: listing.title,
      area: listing.area,
      imageUrls: listing.imageUrls,
      price: listing.priceValue,
      salePrice: listing.salePrice,
      displayPrice: listing.displayPrice,
      listingType: listing.listingType,
      bedrooms: listing.beds,
      bathrooms: listing.baths,
      parkingCount: listing.parkingCount,
      propertyType: listing.propertyType,
      availabilityDate: listing.availabilityDate,
      createdAt: listing.createdAt,
      nsfasApproved: listing.nsfasApproved,
      listingReviewedAt: listing.listingReviewedAt,
      furnished: listing.furnished,
      landlordTrust: listing.landlordTrust,
      landlordPresence: listing.landlordPresence,
      liveTourId: listing.liveTourId,
      hasInstantViewing: listing.hasInstantViewing,
      liveActivity: listing.liveActivity,
      agent: listing.agent,
      // Data Gap 1: rating/reviewCount are not in the API today — nullable,
      // hidden by the card when absent.
      rating: null,
      reviewCount: null,
      distanceKm: distanceOrigin
        ? haversineKm(distanceOrigin, { lat: listing.coordinates.lat, lng: listing.coordinates.lng })
        : null,
    }));
    return activeQuickFilter === "recently-listed" || activeQuickFilter === "recently-viewed"
      ? models
      : mostNearestSort(models);
  }, [activeQuickFilter, filteredListings, distanceOrigin]);

  // Derive the map markers from the SAME sorted+capped order as the cards so
  // marker and card indices align (Req 3.4). Markers carry a single thumbnail
  // (imageUrl) for the rounded ListingMarker visual (Req 3.3), ordered to match
  // `cards`.
  const markerListings = useMemo(
    () => deriveMarkerListings(cards, filteredListings),
    [cards, filteredListings],
  );

  // Desktop listing grid order driven by the "Sort by" control.
  const sortedVisibleListings = useMemo(() => {
    const list = [...filteredListings];
    if (activeQuickFilter === "recently-listed" || activeQuickFilter === "recently-viewed") return list;
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
  }, [activeQuickFilter, filteredListings, sortBy, distanceOrigin]);

  const desktopCards = useMemo<ListingCardModel[]>(
    () =>
      capListings(sortedVisibleListings).map((listing) => ({
        id: listing.id,
        title: listing.title,
        area: listing.area,
        imageUrls: listing.imageUrls,
        price: listing.priceValue,
        salePrice: listing.salePrice,
        displayPrice: listing.displayPrice,
        listingType: listing.listingType,
        bedrooms: listing.beds,
        bathrooms: listing.baths,
        parkingCount: listing.parkingCount,
        propertyType: listing.propertyType,
        availabilityDate: listing.availabilityDate,
        createdAt: listing.createdAt,
        nsfasApproved: listing.nsfasApproved,
        listingReviewedAt: listing.listingReviewedAt,
        furnished: listing.furnished,
        landlordTrust: listing.landlordTrust,
        landlordPresence: listing.landlordPresence,
        liveTourId: listing.liveTourId,
        hasInstantViewing: listing.hasInstantViewing,
        liveActivity: listing.liveActivity,
        agent: listing.agent,
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

  const clusterPreviewCards = useMemo(() => {
    if (!clusterPreview) return [];
    const byId = new Map(cards.map((card) => [card.id, card]));
    return clusterPreview.listingIds
      .map((listingId) => byId.get(listingId))
      .filter((card): card is ListingCardModel => Boolean(card))
      .slice(0, 3);
  }, [cards, clusterPreview]);

  const handleMapBoundsChange = useCallback((bounds: ViewportBounds) => {
    setViewportBounds(bounds);
    setClusterPreview(null);
  }, [setClusterPreview]);

  const handleClusterPreview = useCallback((preview: ClusterPreviewPayload) => {
    setSelectedListingId(undefined);
    setPreviewedListingId(undefined);
    setClusterPreview(preview);
    setSheetSnap("browse");
    try {
      window.sessionStorage.setItem(SHEET_SNAP_STORAGE_KEY, "browse");
    } catch {
      /* sessionStorage is a progressive enhancement */
    }
  }, [setSelectedListingId, setPreviewedListingId, setClusterPreview]);

  const handleClusterZoom = useCallback(() => {
    if (!clusterPreview) return;
    clusterFitNonceRef.current += 1;
    setClusterFitRequest({
      bounds: clusterPreview.bounds,
      nonce: clusterFitNonceRef.current,
    });
  }, [clusterPreview]);

  const desktopPanelScroll = useScrollAdaptation({
    neverHidden: true,
    focusLocked: showFilters,
    openLocked: showFilters,
  });
  const mobileSheetScroll = useScrollAdaptation({
    neverHidden: true,
    focusLocked: showFilters,
  });
  const handleMobileSheetScrollPositionChange = useCallback((scrollTop: number) => {
    mobileSheetScrollTopRef.current = scrollTop;
  }, []);
  const getMobileSheetScrollTop = useCallback(() => mobileSheetScrollTopRef.current, []);
  const handleDesktopPanelAdaptation = desktopPanelScroll.onScroll;
  const measureDesktopPanel = desktopPanelScroll.measure;
  useEffect(() => {
    const element = desktopListingsScrollRef.current;
    if (!element) return;

    const frameId = window.requestAnimationFrame(() => measureDesktopPanel(element));
    if (typeof ResizeObserver === "undefined") {
      return () => window.cancelAnimationFrame(frameId);
    }

    const observer = new ResizeObserver(() => measureDesktopPanel(element));
    observer.observe(element);
    if (element.firstElementChild instanceof HTMLElement) {
      observer.observe(element.firstElementChild);
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [measureDesktopPanel]);
  const handlePanelScroll = useCallback((event: React.UIEvent<HTMLElement>) => {
    handleDesktopPanelAdaptation(event);
  }, [handleDesktopPanelAdaptation]);
  const scrollDesktopListings = useCallback((direction: "previous" | "next") => {
    const element = desktopListingsScrollRef.current;
    if (!element) return;

    const distance = Math.max(240, element.clientHeight * 0.75);
    element.scrollBy({
      top: direction === "next" ? distance : -distance,
      behavior: "smooth",
    });
  }, []);

  // App_Bar Back_Button: return to the previous page when there is history,
  // otherwise fall back to the home route (Req 1.4).

  // Carousel retry (Req 5.9): re-trigger the bbox fetch by re-setting
  // viewportBounds to a fresh object copy so the fetch effect re-runs. The
  // effect aborts any in-flight request, creates a new AbortController, and via
  // the queueMicrotask sets isLoadingListings true + clears the error, so the
  // loading indication shows. Previous cards remain in visibleListings until a
  // successful response replaces them (Req 5.8 retention).
  const handleRetry = useCallback(() => {
    setListingError(null);
    setViewportBounds((prev) => (prev ? { ...prev } : prev));
  }, [setListingError, setViewportBounds]);

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
    const restoredSnap: SheetSnap | null =
      saved === "peek" || saved === "browse" || saved === "full"
        ? saved
        : saved === "collapsed"
          ? "peek"
          : saved === "half"
            ? "browse"
            : saved === "expanded"
              ? "full"
              : null;
    if (restoredSnap) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time external-store hydration
      setSheetSnap(restoredSnap);
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

  const desktopListingPanelHeader = (
    <div
      className={cn(
        "relative z-30 bg-surface-results pb-3 pl-6 pr-4 pt-5",
        desktopPanelScroll.chrome === "compact" && "pt-3",
        desktopPanelScroll.chrome === "minimal" && "pb-2 pt-2",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={cn("font-heading text-2xl font-semibold tracking-tight text-ink", desktopPanelScroll.chrome !== "expanded" && "text-xl")}>
            <AnimatedNumber value={filteredListings.length} /> {listingModeLabel.toLowerCase()} in {selectedArea ? resultLocationLabel : "this map area"}
          </h2>
          <p className={cn("mt-0.5 text-sm text-muted-foreground", desktopPanelScroll.chrome === "minimal" && "hidden")}>{!selectedArea ? <><span className="block">Viewing {resultLocationLabel} on the map.</span><span>{resultUpdateCopy}</span></> : resultUpdateCopy}</p>
        </div>


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

  const renderExploreSections = (
    className?: string,
    sections?: { showQuickFilters?: boolean; showBlogs?: boolean },
    quickFilterOptions?: { navigation?: QuickFilterNavigation; showControls?: boolean },
  ) => (
    <DiscoveryExploreSections
      activeQuickFilter={activeQuickFilter}
      onQuickFilterChange={handleQuickFilterChange}
      listingMode={listingMode}
      className={className}
      showQuickFilters={sections?.showQuickFilters ?? true}
      showBlogs={sections?.showBlogs ?? true}
      quickFilterNavigation={quickFilterOptions?.navigation}
      showQuickFilterControls={quickFilterOptions?.showControls}
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

  const listingEmptyState = activeQuickFilter === "all" ? (
    <><PropertyEmptyState hasFilters={activeFilterCount > 0 || Boolean(urlQuery)} onClear={() => handleQuickFilterChange("all", true)} location={resultLocationLabel} selectedPlace={Boolean(selectedArea)} />{viewportBounds ? <details className="mx-5 border-t border-border"><summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-forest">Get alerts for this area</summary><EmptyStateCapture bbox={viewportBounds} filters={filters} compact /></details> : null}</>
  ) : (
    <QuickFilterEmptyState
      filter={activeQuickFilter}
      authenticated={favoritesAuthenticated}
      favoritesError={favoritesError}
      onClear={() => handleQuickFilterChange("all")}
    />
  );

  const clusterPreviewPanel = clusterPreview && clusterPreviewCards.length > 0 ? (
    <section
      aria-label={`${clusterPreview.count} homes in this cluster`}
      className="mx-4 mb-3 rounded-xl border border-border/70 bg-surface-floating p-3 shadow-[var(--elevation-1)] lg:mx-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-ink">{clusterPreview.count} homes here</h3>
          <p className="text-xs text-muted-foreground">Preview a home or move closer.</p>
        </div>
        <button
          type="button"
          onClick={() => setClusterPreview(null)}
          aria-label="Dismiss cluster preview"
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-warm-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-2 grid gap-1">
        {clusterPreviewCards.map((card) => {
          const cardPrice = card.displayPrice ?? (card.listingType === "sale" ? card.salePrice ?? card.price : card.price);
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => handleViewDetail(card.id)}
              onMouseEnter={() => setPreviewedListingId(card.id)}
              onMouseLeave={() => setPreviewedListingId(undefined)}
              onFocus={() => setPreviewedListingId(card.id)}
              onBlur={() => setPreviewedListingId(undefined)}
              className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-warm-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">{card.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{card.area ?? "Location to confirm"}</span>
              </span>
              <span className="shrink-0 text-sm font-bold text-ink">{formatPrice(cardPrice)}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={handleClusterZoom}
        className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-forest px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-forest/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Zoom to all {clusterPreview.count}
      </button>
    </section>
  ) : null;

  const renderDesktopListingPanelBody = () => (
    <div
      ref={desktopListingsScrollRef}
      data-slot="desktop-listings-scroll"
      data-orientation="vertical"
      data-at-start={desktopPanelScroll.atStart}
      onScroll={handlePanelScroll}
      className="scroll-edge-fade scroll-contained min-h-0 flex-1 overflow-y-auto pb-8"
    >
      <div>
        <div data-slot="desktop-scroll-intro">
          {desktopListingPanelHeader}
        </div>

        {clusterPreviewPanel}

        <ListingCarousel
          cards={desktopCards}
          selectedListingId={selectedListingId}
          previewedListingId={previewedListingId}
          isLoading={isLoadingResults}
          error={listingError}
        errorMessage={listingError === PLACE_LOOKUP_ERROR ? PLACE_LOOKUP_ERROR : undefined}
          onRetry={handleRetry}
          onSelectCard={handleViewDetail}
          onPreviewCardChange={setPreviewedListingId}
          emptyState={listingEmptyState}
          cardPresentation="desktop-results"
        />
      </div>

      {desktopCards.length > 0 ? renderExploreSections("mt-4", { showQuickFilters: false, showBlogs: true }) : null}
    </div>
  );

  const renderDesktopListingsPanel = () => (
    <aside
      aria-label="Listings near the map"
      className="relative z-[var(--z-controls)] hidden w-[440px] shrink-0 flex-col overflow-hidden border-r border-border/70 bg-surface-results lg:flex xl:w-[465px]"
    >
      {renderDesktopListingPanelBody()}
      {cards.length > 0 ? <div
        aria-label="Listing card navigation"
        className="absolute bottom-5 right-4 z-20 flex flex-col gap-1 rounded-full border border-border/70 bg-panel p-1 shadow-[var(--elevation-2)]"
      >
        <button
          type="button"
          aria-label="Scroll listing cards up"
          disabled={desktopPanelScroll.atStart}
          onClick={() => scrollDesktopListings("previous")}
          className="flex size-11 items-center justify-center rounded-full text-ink transition-[background-color,color,transform,opacity] duration-[220ms] ease-[var(--ease-out-expo)] hover:bg-surface-floating hover:text-forest active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-colors"
        >
          <ChevronUp className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Scroll listing cards down"
          disabled={desktopPanelScroll.atEnd}
          onClick={() => scrollDesktopListings("next")}
          className="flex size-11 items-center justify-center rounded-full text-ink transition-[background-color,color,transform,opacity] duration-[220ms] ease-[var(--ease-out-expo)] hover:bg-surface-floating hover:text-forest active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-colors"
        >
          <ChevronDown className="size-5" aria-hidden="true" />
        </button>
      </div> : null}
    </aside>
  );

  const mobileSheetHeader = (
    <div
      data-chrome={mobileSheetScroll.chrome}
      className={cn("adaptive-chrome px-4 pt-1", mobileSheetScroll.chrome === "minimal" && "pt-0")}
    >
      <h2 className={cn("font-heading text-lg font-semibold tracking-tight text-ink", mobileSheetScroll.chrome !== "expanded" && "text-base")}>
        <AnimatedNumber value={filteredListings.length} /> {listingModeLabel.toLowerCase()} in {selectedArea ? resultLocationLabel : "this map area"}
      </h2>
      <p className={cn("mt-0.5 text-sm text-muted-foreground", mobileSheetScroll.chrome === "minimal" && "hidden")}>{!selectedArea ? <><span className="block">Viewing {resultLocationLabel} on the map.</span><span>{resultUpdateCopy}</span></> : resultUpdateCopy}</p>
      <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-border/60 bg-panel p-1" aria-label="Listing market">
        {(["rent", "buy"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => handleListingModeChange(mode)}
            aria-pressed={listingMode === mode}
            className={cn(
              "min-h-11 rounded-full px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest",
              listingMode === mode ? "bg-panel text-ink shadow-[var(--shadow-control)]" : "text-muted-foreground",
            )}
          >
            {mode === "rent" ? "Rent" : "Buy"}
          </button>
        ))}
      </div>
    </div>
  );

  const mobileSheetPeek = !isLoadingResults && !listingError && cards.length === 0 ? (
    <PropertyEmptyState compact hasFilters={activeFilterCount > 0 || Boolean(urlQuery) || activeQuickFilter !== "all"} onClear={() => handleQuickFilterChange("all", true)} location={resultLocationLabel} selectedPlace={Boolean(selectedArea)} />
  ) : (
    <div className="text-left">
      <p className="font-heading text-lg font-semibold tracking-tight text-ink">
        <AnimatedNumber value={filteredListings.length} /> {listingModeLabel.toLowerCase()}
      </p>
      <p className="truncate text-sm text-muted-foreground">{resultLocationLabel}</p>
    </div>
  );

  const mobileSheetContent = (
    <div className="mt-3 px-2">
      {renderExploreSections(
        "mb-3",
        { showQuickFilters: true, showBlogs: false },
        { navigation: mobileQuickFilterNavigation, showControls: false },
      )}

      {cards.length > 0 && showRenterWelcome && favorites.size === 0 ? (
        <div className="mb-3 rounded-xl border border-forest/20 bg-accent px-4 py-3 text-left">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-forest">Start a focused shortlist</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">Search an area, open a home, then tap Save on the places worth comparing.</p>
            </div>
            <button type="button" onClick={() => setShowRenterWelcome(false)} aria-label="Dismiss getting started tip" className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-panel hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

      {clusterPreviewPanel}

      <ListingCarousel
        cards={cards}
        selectedListingId={selectedListingId}
        previewedListingId={previewedListingId}
        isLoading={isLoadingResults}
        error={listingError}
        errorMessage={listingError === PLACE_LOOKUP_ERROR ? PLACE_LOOKUP_ERROR : undefined}
        onRetry={handleRetry}
        onSelectCard={handleViewMobileDetail}
        onPreviewCardChange={setPreviewedListingId}
        emptyState={listingEmptyState}
      />

      {cards.length > 0 ? renderExploreSections("mb-4 mt-4", { showQuickFilters: false, showBlogs: true }) : null}
    </div>
  );



  return (
    <DiscoverySearchProvider onSearchFocus={() => handleSheetSnapChange("full")}><main className="relative h-dvh min-h-0 overflow-hidden bg-warm-surface text-ink flex flex-col">
      <h1 className="sr-only" tabIndex={-1}>Homes in view</h1>
      <p className="sr-only" aria-live="polite">
        {filteredListings.length} homes shown for {activeQuickFilter.replaceAll("-", " ")}.
      </p>

      {/* Shared desktop navigation with discovery-specific browse controls. */}
      <div ref={discoveryHeaderRef} className={cn("relative z-[var(--z-chrome)] shrink-0", detailListing && "hidden lg:block")}>
        <PinpointHeader category="property" areaId={selectedAreaId} area={selectedArea}
          propertyHref={`${pathname}?${searchParams.toString()}`}
          count={!isLoadingResults && !listingError ? filteredListings.length : undefined}
          location={<LocationSelector idPrefix="desktop" selectedLocation={selectedArea?.split(",")[0]} viewingArea={!selectedArea ? resultLocationLabel : undefined} onSelect={handleLocationSelect} />}
          view="map" searchActive={Boolean(draftSearchQuery)}
          search={<div
          ref={desktopSearchSurfaceRef}
          data-slot="desktop-search-surface"
          className="relative min-w-0 flex-1 xl:max-w-[520px]"
        >
          <form role="search" className="flex h-12 min-w-0 items-center gap-3 rounded-full border border-border/70 bg-panel px-4 shadow-[var(--shadow-control)] transition-colors focus-within:border-forest focus-within:ring-1 focus-within:ring-forest" onSubmit={handleSearchSubmit}>
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              ref={desktopSearchInputRef}
              type="search"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted-foreground"
              placeholder="Search homes, suburbs or cities"
              value={draftSearchQuery}
              onChange={(event) => handleSearchChange(event.target.value, "desktop")}
              onFocus={() => handleSearchFocus("desktop")}
              onKeyDown={(event) => handleSearchKeyDown(event, "desktop")}
              maxLength={LISTING_SEARCH_QUERY_MAX_LENGTH}
              aria-label="Search listings"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={activeSearchSurface === "desktop" && locationSuggestions.length > 0}
              aria-controls="desktop-location-suggestions"
              aria-activedescendant={
                activeSearchSurface === "desktop" && resolvedActiveSearchSuggestionIndex >= 0
                  ? `desktop-location-suggestions-option-${resolvedActiveSearchSuggestionIndex}`
                  : undefined
              }
            />
            {draftSearchQuery ? (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Clear search"
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="submit"
              aria-label="Search"
              aria-busy={isLoadingListings}
              className="flex min-h-11 shrink-0 items-center justify-center rounded-full bg-forest px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-forest/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-70"
            >
              <span className="sr-only">Search</span><ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </form>

          <SearchSuggestions
            id="desktop-location-suggestions"
            suggestions={locationSuggestions}
            open={activeSearchSurface === "desktop"}
            activeIndex={resolvedActiveSearchSuggestionIndex}
            onActiveIndexChange={setActiveSearchSuggestionIndex}
            onSelect={handleSuggestionSelect}
          />

        </div>}
          toolbar={<><div className="flex shrink-0 gap-1" aria-label="Listing market">{(["rent", "buy"] as const).map((mode) => <button key={mode} type="button" aria-pressed={listingMode === mode} onClick={() => handleListingModeChange(mode)} className={cn("min-h-11 rounded-full px-3 text-sm font-semibold", listingMode === mode ? "bg-forest text-primary-foreground" : "border border-border bg-panel text-ink")}>{mode === "rent" ? "Rent" : "Buy"}</button>)}</div><button type="button" aria-expanded={showFilters} aria-controls="desktop-more-filters" onClick={() => { closeSearchSuggestions(); setShowFilters(!showFilters); }} className="min-h-11 rounded-full border border-border bg-panel px-3 text-sm font-semibold">Filters{activeFilterCount ? " · " + activeFilterCount : ""}</button><DiscoverySortSelect options={DISCOVERY_SORT_OPTIONS} value={sortBy} onChange={value => setSortBy(value as DiscoverySortOption)} /></>}
        />


      {showFilters ? (
        <section
          id="desktop-more-filters"
          aria-label="More listing filters"
          className="absolute right-3 top-full z-[var(--z-filter-dropdown,35)] mt-2 max-h-[min(65dvh,calc(100dvh-var(--pinpoint-header-height,12rem)-1rem))] overflow-y-auto w-[min(46rem,calc(100vw-1.5rem))] rounded-2xl border border-border/70 bg-panel p-4 shadow-[var(--elevation-3)]"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">More filters</h2>
              <p className="text-xs text-muted-foreground">
                Results update as filters change.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={() => handleFilterChange({})}
                  className="min-h-11 rounded-full px-3 text-xs font-semibold text-forest hover:bg-warm-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Clear all
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                aria-label="Close more filters"
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-warm-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="mb-4"><PropertyQuickFilters listingMode={listingMode} activeQuickFilter={activeQuickFilter} onQuickFilterChange={handleQuickFilterChange} /></div>
          <FilterBar
            filters={filters}
            onFilterChange={handleFilterChange}
            resultCount={filteredListings.length}
            isLoading={isLoadingResults}
            dropdownPlacement="bottom"
            showSearchButton={false}
          />
        </section>
      ) : null}
      </div>


      <>
      {/* Desktop and mobile surfaces are both mounted at once (one hidden via
          `display:none` at the `lg` breakpoint). Motion ignores `display:none`
          when measuring layout, so without separate LayoutGroups the shared
          `listing-<id>` layoutIds on each surface's cards collide and Motion can
          project a visible card onto the hidden duplicate's 0×0 box, collapsing
          it to nothing. Namespacing the groups keeps the card→detail morph
          working within each surface while eliminating the cross-surface clash. */}
      <LayoutGroup id="discovery-desktop">
      <div className="flex-1 min-h-0 relative isolate flex flex-col overflow-hidden lg:flex-row [container-type:size]" data-discovery-map-body>
        {isLoadingResults && filteredListings.length > 0 ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[calc(var(--z-chrome)+1)] h-0.5 overflow-hidden bg-forest/10" role="status" aria-label="Updating homes in this area">
            <div className="h-full w-1/3 animate-[discovery-loading-track_1.1s_var(--ease-out-quart)_infinite] bg-forest motion-reduce:animate-pulse" />
          </div>
        ) : null}
        {detailListing && (
          <aside
            aria-label="Property details"
            data-expanded={isDetailPanelExpanded ? "true" : "false"}
            className={cn(
              "relative z-10 hidden shrink-0 overflow-hidden border-r border-border/40 bg-panel shadow-[var(--elevation-2)] lg:flex",
              isDetailPanelExpanded
                ? "w-[clamp(560px,50vw,760px)]"
                : "w-[clamp(340px,30vw,480px)]",
            )}
          >
            <button
              type="button"
              aria-expanded={isDetailPanelExpanded}
              aria-label={isDetailPanelExpanded ? "Collapse property details" : "Expand property details"}
              onClick={() => setIsDetailPanelExpanded((expanded) => !expanded)}
              className="absolute right-3 top-3 z-20 flex size-11 items-center justify-center rounded-full border border-border bg-panel text-ink shadow-[var(--elevation-1)] transition-colors hover:border-forest hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {isDetailPanelExpanded ? (
                <Minimize2 className="size-4" aria-hidden="true" />
              ) : (
                <Maximize2 className="size-4" aria-hidden="true" />
              )}
            </button>
            <div
              key={detailListing.id}
              data-slot="desktop-detail-content"
              className="flex h-full w-[clamp(340px,30vw,480px)] max-w-full shrink-0 flex-col animate-in fade-in slide-in-from-left-4 duration-300 ease-[var(--ease-out-quart)] motion-reduce:animate-none"
            >
              <ListingDetailPanel listing={detailListing} initialIntent={initialIntent} onBack={closeDetailPanel} compact />
            </div>
          </aside>
        )}

        {/* Left Listings Panel (desktop) */}
        {!detailListing ? renderDesktopListingsPanel() : null}

        {/* Map Area */}
        <div className="absolute inset-0 z-[var(--z-map)] h-full min-w-0 w-full lg:static lg:inset-auto lg:z-auto lg:flex-1 lg:bg-muted">
          <MapViewLoader
            mapApiKey={mapApiKey}
            listings={markerListings}
            selectedListingId={selectedListingId}
            previewedListingId={previewedListingId}
            onSelectListing={handleSelectListing}
            onPreviewListingChange={setPreviewedListingId}
            onViewListing={handleViewDetail}
            onBoundsChange={handleMapBoundsChange}
            onViewportContextChange={setViewportContext}
            onClusterPreview={handleClusterPreview}
            initialCenter={initialCenter}
            searchQuery={selectedArea || urlQuery}
            searchTarget={searchTarget}
            mobileBottomPadding={mobileSheetHeight}
            fitListingsRequest={fitListingsRequest}
            clusterFitRequest={clusterFitRequest}
            detailOpen={Boolean(detailListing)}
            detailPanelExpanded={isDetailPanelExpanded}
          >

          </MapViewLoader>

        </div>
      <LayoutGroup id="discovery-mobile">
      <div className="lg:hidden">
        {/* Mobile Bottom_Sheet — three-snap, drag-aware listings sheet. */}
        {!detailListing ? (
          <MobileBottomSheet
            contained
            snap={sheetSnap}
            onSnapChange={handleSheetSnapChange}
            aria-label={sheetSnap === "full" ? "Show map" : sheetSnap === "browse" ? "Open full listings list" : "Browse listings"}
            peek={mobileSheetPeek}
            resultCount={isLoadingResults || listingError ? undefined : filteredListings.length}
            header={mobileSheetHeader}
            onContentScroll={mobileSheetScroll.onScroll}
            onContentScrollPositionChange={handleMobileSheetScrollPositionChange}
            getInitialScrollTop={getMobileSheetScrollTop}
            onVisibleHeightChange={setMobileSheetHeight}
          >
            {mobileSheetContent}
          </MobileBottomSheet>
        ) : null}

        {/* Detail Panel */}
        {detailListing ? (
          <div
            data-slot="mobile-detail-sheet"
            className="absolute inset-x-0 bottom-0 z-[var(--z-detail-mobile)] overflow-hidden rounded-t-2xl bg-panel shadow-[var(--elevation-3)] animate-in fade-in slide-in-from-bottom-12 duration-300 ease-[var(--ease-out-quart)] motion-reduce:animate-none"
            style={{ top: "max(0.5rem, env(safe-area-inset-top))" }}
          >
            <div className="h-full min-h-0">
              <ListingDetailPanel listing={detailListing} initialIntent={initialIntent} onBack={closeDetailPanel} />
            </div>
          </div>
        ) : null}
      </div>
      </LayoutGroup>
      </div>
      </LayoutGroup>
      </>
    </main></DiscoverySearchProvider>
  );
}
