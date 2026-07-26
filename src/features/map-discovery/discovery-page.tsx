"use client";

import { Search, SlidersHorizontal, ArrowUpDown, Check, ChevronDown, ChevronUp, Maximize2, Minimize2, X } from "lucide-react";
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
import {
  DesktopGlobalHeader,
  DiscoveryPrimaryNavigation,
} from "@/components/navigation/navigation";
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
import { MapControls } from "./map-controls";
import { MapViewLoader } from "./map-view-loader";
import type { ClusterPreviewPayload } from "./map-view";
import type { ViewportContext } from "./lib/viewport-context";
import { EmptyStateCapture } from "./empty-state-capture";
import { QuickFilterEmptyState } from "./quick-filter-empty-state";
import { useFavorites } from "./hooks/use-favorites";
import { FilterBar, type FilterState } from "./filter-bar";
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
import type { GeoPoint, ListingCardModel, QuickFilterKey } from "./lib/types";
import type { BlogPostSummary } from "@/features/blog/types";
import type { LandlordTrustSummary } from "@/features/trust/landlord-signals";
import type { PresenceBadge } from "@/features/presence/presence-status";
import type { ListingLiveActivity } from "./live-activity";
import { MobileDiscoveryShell } from "./mobile/mobile-discovery-shell";
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
  googleMapsApiKey?: string;
  googleMapsMapId?: string;
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

export function DiscoveryPage({ googleMapsApiKey, googleMapsMapId, initialListing, initialIntent, initialBlogPosts = [] }: DiscoveryPageProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [showRenterWelcome, setShowRenterWelcome] = useState(() => searchParams.get("welcome") === "renter");

  const urlQuery = normalizeListingSearchQuery(searchParams.get("q"));
  const urlPlaceId = searchParams.get("placeId") ?? "";
  const listingMode = searchParams.get("mode") === "buy" ? "buy" : "rent";
  const listingModeLabel = listingMode === "buy" ? "Properties" : "Rentals";
  const activeQuickFilter = parseQuickFilter(searchParams.get("quick"), listingMode);
  useEffect(() => {
    if (searchParams.get("welcome") !== "renter") return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("welcome");
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }, [pathname, router, searchParams]);
  const viewportQueryString = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("quick");
    params.delete("placeId");
    params.delete("listingId");
    if (urlQuery) params.set("q", urlQuery);
    else params.delete("q");
    return params.toString();
  }, [searchParams, urlQuery]);
  const listingRequestRef = useRef<AbortController | null>(null);
  const hasLoadedViewportListingsRef = useRef(false);
  const detailRequestRef = useRef<AbortController | null>(null);
  const [visibleListings, setVisibleListings] = useState<Listing[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedEntry[]>(loadRecentlyViewed);
  const [selectedListingId, setSelectedListingId] = useState<string | undefined>(initialListing?.id);
  const [previewedListingId, setPreviewedListingId] = useState<string | undefined>();
  const [clusterPreview, setClusterPreview] = useState<ClusterPreviewPayload | null>(null);
  const searchUrlKey = `${urlQuery}\u0000${urlPlaceId}`;
  const [searchDraftState, setSearchDraftState] = useState(() => ({
    urlKey: searchUrlKey,
    value: urlQuery,
  }));
  const [activeSearchSurface, setActiveSearchSurface] = useState<"desktop" | "mobile" | null>(null);
  const [activeSearchSuggestionIndex, setActiveSearchSuggestionIndex] = useState(-1);
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([]);
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
  const [recentSearches, setRecentSearches] = useState<string[]>(loadRecentSearches);
  const [viewportContext, setViewportContext] = useState<ViewportContext | null>(null);
  const resultLocationLabel = viewportContext?.label || urlQuery || "this area";
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds | null>(null);
  // The first viewport request cannot begin until the map reports its bounds.
  // Start in a loading state so the results rail has useful structure while
  // the map bundle and Google Maps SDK initialize.
  const [isLoadingListings, setIsLoadingListings] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [listingError, setListingError] = useState<string | null>(null);
  const [detailListing, setDetailListing] = useState<ListingDetail | null>(initialListing ?? null);
  const [isDetailPanelExpanded, setIsDetailPanelExpanded] = useState(false);
  const clearDetailPanel = useCallback(() => {
    detailRequestRef.current?.abort();
    setDetailListing(null);
    setSelectedListingId(undefined);
    setPreviewedListingId(undefined);
    setClusterPreview(null);
    setIsDetailPanelExpanded(false);
  }, []);
  const closeDetailPanel = useCallback(() => {
    clearDetailPanel();
    if (pathname.startsWith("/listing/")) {
      router.push(listingMode === "buy" ? "/?mode=buy" : "/");
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
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
  const [sortBy, setSortBy] = useState<DiscoverySortOption>(DISCOVERY_SORT_OPTIONS[0]);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const desktopListingsScrollRef = useRef<HTMLDivElement>(null);
  const desktopQuickFilterNavigation = useHorizontalScrollAffordance<HTMLUListElement>();
  const mobileQuickFilterNavigation = useHorizontalScrollAffordance<HTMLUListElement>();
  useOnClickOutside(sortMenuRef, () => setIsSortOpen(false));
  const desktopSearchSurfaceRef = useRef<HTMLDivElement>(null);

  const closeSearchSuggestions = useCallback(() => {
    setActiveSearchSurface(null);
    setActiveSearchSuggestionIndex(-1);
  }, []);

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
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

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
  const [draftFilters, setDraftFilters] = useState<FilterState>(filters);

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

  const draftResultCount = useMemo(() => filteredListings.filter((listing) => {
    const min = draftFilters.price?.min;
    const max = draftFilters.price?.max;
    return (
      (min === undefined || listing.priceValue >= min) &&
      (max === undefined || listing.priceValue <= max) &&
      (draftFilters.beds === undefined || listing.beds >= draftFilters.beds) &&
      (draftFilters.baths === undefined || listing.baths >= draftFilters.baths) &&
      (!draftFilters.propertyTypes?.length || draftFilters.propertyTypes.includes(listing.propertyType ?? "")) &&
      (!draftFilters.availableNow || listing.landlordPresence === "available") &&
      (!draftFilters.liveTours || Boolean(listing.liveTourId)) &&
      (!draftFilters.instantViewings || listing.hasInstantViewing) &&
      (!draftFilters.repliesUnder5 ||
        (listing.landlordTrust?.predictedResponseSeconds !== null &&
          listing.landlordTrust?.predictedResponseSeconds !== undefined &&
          listing.landlordTrust.predictedResponseSeconds <= 300))
    );
  }).length, [draftFilters, filteredListings]);

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
  const draftActiveFilterCount = useMemo(
    () =>
      Number(Boolean(draftFilters.price?.min || draftFilters.price?.max)) +
      Number(draftFilters.beds !== undefined) +
      Number(draftFilters.baths !== undefined) +
      Number(Boolean(draftFilters.propertyTypes?.length)) +
      Number(Boolean(draftFilters.availableNow)) +
      Number(Boolean(draftFilters.liveTours)) +
      Number(Boolean(draftFilters.instantViewings)) +
      Number(Boolean(draftFilters.repliesUnder5)),
    [draftFilters],
  );

  const handleQuickFilterChange = useCallback((quickFilter: QuickFilterKey) => {
    const params = new URLSearchParams(searchParams.toString());
    const clearsAdvancedFilters = quickFilter === "all";
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
      setDraftFilters({});
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
  }, [activeFilterCount, clearDetailPanel, pathname, router, searchParams]);

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

  const locationSuggestions = useMemo(
    () => buildLocationSuggestions({
      query: draftSearchQuery,
      recentSearches,
      placeSuggestions,
      inViewCandidates: [
        viewportContext?.label ?? "",
        ...visibleListings.flatMap((listing) => [listing.title, listing.area]),
      ],
    }),
    [draftSearchQuery, placeSuggestions, recentSearches, viewportContext?.label, visibleListings],
  );

  const resolvedActiveSearchSuggestionIndex =
    activeSearchSuggestionIndex < locationSuggestions.length
      ? activeSearchSuggestionIndex
      : -1;

  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
    setPreviewedListingId(undefined);
    setClusterPreview(null);
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
  }, [searchParams, pathname, router]);

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
      const params = new URLSearchParams(searchParams.toString());
      params.set("listingId", listingId);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }

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
        setRecentlyViewed((current) => recordRecentlyViewed(current, listingId));
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
  }, [listingMode, pathname, router, searchParams]);

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
  }, []);

  useEffect(() => {
    const listingIdParam = searchParams.get("listingId");
    if (listingIdParam) {
      if (detailListing?.id === listingIdParam || (selectedListingId === listingIdParam && isLoadingDetail)) return;
      const timeoutId = window.setTimeout(() => handleViewDetail(listingIdParam, false), 0);
      return () => window.clearTimeout(timeoutId);
    }
    if (pathname === "/" && detailListing && !initialListing) {
      const timeoutId = window.setTimeout(clearDetailPanel, 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [clearDetailPanel, detailListing, handleViewDetail, initialListing, isLoadingDetail, pathname, searchParams, selectedListingId]);

  const replaceSearchQuery = useCallback((nextQuery: string, placeId?: string) => {
    setPreviewedListingId(undefined);
    setClusterPreview(null);
    const params = new URLSearchParams(searchParams.toString());
    const normalizedQuery = normalizeListingSearchQuery(nextQuery);
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
  }, []);

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
    replaceSearchQuery("");
  };

  const handleSearchChange = useCallback((value: string, surface: "desktop" | "mobile") => {
    const limitedValue = limitListingSearchDraft(value);
    setDraftSearchQuery(limitedValue);
    setActiveSearchSuggestionIndex(-1);
    const shouldOpen =
      limitedValue.trim().length >= 2 ||
      (!limitedValue.trim() && recentSearches.length > 0);
    setActiveSearchSurface(shouldOpen ? surface : null);
  }, [recentSearches.length, setDraftSearchQuery]);

  const handleSuggestionSelect = useCallback((suggestion: LocationSuggestion) => {
    const normalizedLabel = normalizeListingSearchQuery(suggestion.label);
    setDraftSearchQuery(normalizedLabel);
    closeSearchSuggestions();
    rememberSearch(normalizedLabel);
    replaceSearchQuery(normalizedLabel, suggestion.placeId);
  }, [closeSearchSuggestions, rememberSearch, replaceSearchQuery, setDraftSearchQuery]);

  const handleSearchFocus = useCallback((surface: "desktop" | "mobile") => {
    const hasRecentSearches = !draftSearchQuery.trim() && recentSearches.length > 0;
    setActiveSearchSurface(
      draftSearchQuery.trim().length >= 2 || hasRecentSearches ? surface : null,
    );
  }, [draftSearchQuery, recentSearches.length]);

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
  }, [activeSearchSurface, closeSearchSuggestions, handleSuggestionSelect, locationSuggestions, resolvedActiveSearchSuggestionIndex]);

  const handleListingModeChange = useCallback((mode: "rent" | "buy") => {
    const params = new URLSearchParams(searchParams.toString());
    if (mode === "buy") params.set("mode", "buy");
    else params.delete("mode");
    if (mode === "buy" && activeQuickFilter === "nsfas-approved") params.delete("quick");
    clearDetailPanel();
    setSelectedListingId(undefined);
    router.replace(`${pathname}?${params.toString()}`);
  }, [activeQuickFilter, clearDetailPanel, pathname, router, searchParams]);

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

    const queryParams = new URLSearchParams(viewportQueryString);
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
  }, [viewportBounds, viewportQueryString]);

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
  }, []);

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
  }, []);

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
    openLocked: isSortOpen,
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
  const handleSeeAll = useCallback(() => {
    // No-op beyond the sheet's own expand; in-place expansion is handled in the
    // shell/sheet. Kept as a named handler for future wiring.
  }, []);

  const desktopListingPanelHeader = (
    <div
      data-chrome={desktopPanelScroll.chrome}
      className={cn(
        "adaptive-chrome relative z-30 flex-none bg-surface-results px-5 pt-5 pb-3",
        desktopPanelScroll.chrome === "compact" && "pt-4",
        desktopPanelScroll.chrome === "minimal" && "pt-3 pb-2",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={cn("font-heading text-2xl font-semibold tracking-tight text-ink", desktopPanelScroll.chrome !== "expanded" && "text-xl")}>
            <AnimatedNumber value={filteredListings.length} /> {listingModeLabel.toLowerCase()} in {resultLocationLabel}
          </h2>
          <p className={cn("mt-0.5 text-sm text-muted-foreground", desktopPanelScroll.chrome === "minimal" && "hidden")}>{resultUpdateCopy}</p>
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
              {DISCOVERY_SORT_OPTIONS.map((option) => {
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
    <EmptyStateCapture bbox={viewportBounds} filters={filters} compact />
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
      onScroll={handlePanelScroll}
      className="scroll-contained min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-1"
    >
      <div>
        {showRenterWelcome && favorites.size === 0 ? (
          <div className="mb-4 rounded-xl border border-forest/20 bg-accent px-4 py-3">
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
        {renderExploreSections(
          "mb-4",
          { showQuickFilters: true, showBlogs: false },
          { navigation: desktopQuickFilterNavigation, showControls: true },
        )}

        {clusterPreviewPanel}

        <ListingCarousel
          cards={desktopCards}
          selectedListingId={selectedListingId}
          previewedListingId={previewedListingId}
          isLoading={isLoadingResults}
          error={listingError}
          onRetry={handleRetry}
          onSelectCard={handleViewDetail}
          onPreviewCardChange={setPreviewedListingId}
          emptyState={listingEmptyState}
        />
      </div>

      {renderExploreSections("mt-4", { showQuickFilters: false, showBlogs: true })}
    </div>
  );

  const renderDesktopListingsPanel = () => (
    <aside
      aria-label="Listings near the map"
      className="relative z-[var(--z-controls)] hidden w-[440px] shrink-0 flex-col overflow-hidden border-r border-border/70 bg-surface-results lg:flex xl:w-[500px]"
    >
      {desktopListingPanelHeader}
      {renderDesktopListingPanelBody()}
      <div
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
      </div>
    </aside>
  );

  const mobileSheetHeader = (
    <div
      data-chrome={mobileSheetScroll.chrome}
      className={cn("adaptive-chrome px-4 pt-1", mobileSheetScroll.chrome === "minimal" && "pt-0")}
    >
      <h2 className={cn("font-heading text-lg font-semibold tracking-tight text-ink", mobileSheetScroll.chrome !== "expanded" && "text-base")}>
        <AnimatedNumber value={filteredListings.length} /> {listingModeLabel.toLowerCase()} in {resultLocationLabel}
      </h2>
      <p className={cn("mt-0.5 text-sm text-muted-foreground", mobileSheetScroll.chrome === "minimal" && "hidden")}>{resultUpdateCopy}</p>
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
    </div>
  );

  const mobileSheetPeek = (
    <div className="text-left">
      <p className="font-heading text-lg font-semibold tracking-tight text-ink">
        <AnimatedNumber value={filteredListings.length} /> {listingModeLabel.toLowerCase()}
      </p>
      <p className="truncate text-sm text-muted-foreground">{resultLocationLabel}</p>
    </div>
  );

  const mobileSheetContent = (
    <div className="mt-3 px-2">
      {showRenterWelcome && favorites.size === 0 ? (
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
      {renderExploreSections(
        "mb-3",
        { showQuickFilters: true, showBlogs: false },
        { navigation: mobileQuickFilterNavigation, showControls: true },
      )}

      {clusterPreviewPanel}

      <ListingCarousel
        cards={cards}
        selectedListingId={selectedListingId}
        previewedListingId={previewedListingId}
        isLoading={isLoadingResults}
        error={listingError}
        onRetry={handleRetry}
        onSelectCard={handleViewMobileDetail}
        onPreviewCardChange={setPreviewedListingId}
        emptyState={listingEmptyState}
      />

      {renderExploreSections("mb-4 mt-4", { showQuickFilters: false, showBlogs: true })}
    </div>
  );



  return (
    <main className="relative h-dvh overflow-hidden bg-warm-surface text-ink flex flex-col">
      <h1 className="sr-only" tabIndex={-1}>Homes in view</h1>
      <p className="sr-only" aria-live="polite">
        {filteredListings.length} homes shown for {activeQuickFilter.replaceAll("-", " ")}.
      </p>

      {/* Shared desktop navigation with discovery-specific browse controls. */}
      <DesktopGlobalHeader>
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
        <div ref={desktopSearchSurfaceRef} className="relative min-w-0 flex-1">
          <form role="search" className="flex min-w-0 items-center gap-3 rounded-full border border-border/60 bg-warm-surface px-4 py-2 shadow-sm transition-colors focus-within:border-forest focus-within:ring-1 focus-within:ring-forest" onSubmit={handleSearchSubmit}>
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              ref={desktopSearchInputRef}
              type="search"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted-foreground"
              placeholder="Search neighbourhood or city"
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
            {draftSearchQuery || urlPlaceId ? (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Clear search"
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="submit"
              aria-label="Search"
              aria-busy={isLoadingListings}
              className="flex h-8 shrink-0 items-center justify-center rounded-full bg-forest px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-forest/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-70"
            >
              Search
            </button>
            <button
              type="button"
              aria-label={activeFilterCount > 0 ? `Filter listings, ${activeFilterCount} active` : "Filter listings"}
              aria-expanded={showFilters}
              onClick={() => {
                closeSearchSuggestions();
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
            open={activeSearchSurface === "desktop"}
            activeIndex={resolvedActiveSearchSuggestionIndex}
            onActiveIndexChange={setActiveSearchSuggestionIndex}
            onSelect={handleSuggestionSelect}
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
                resultCount={filteredListings.length}
                isLoading={isLoadingResults}
                dropdownPlacement="bottom"
                showSearchButton={false}
              />
            </section>
          ) : null}
        </div>

        <DiscoveryPrimaryNavigation />

      </DesktopGlobalHeader>


      {/* Desktop and mobile surfaces are both mounted at once (one hidden via
          `display:none` at the `lg` breakpoint). Motion ignores `display:none`
          when measuring layout, so without separate LayoutGroups the shared
          `listing-<id>` layoutIds on each surface's cards collide and Motion can
          project a visible card onto the hidden duplicate's 0×0 box, collapsing
          it to nothing. Namespacing the groups keeps the card→detail morph
          working within each surface while eliminating the cross-surface clash. */}
      <LayoutGroup id="discovery-desktop">
      <div className="flex-1 min-h-0 relative flex flex-col lg:flex-row">
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
            apiKey={googleMapsApiKey}
            mapId={googleMapsMapId}
            listings={markerListings}
            selectedListingId={selectedListingId}
            previewedListingId={previewedListingId}
            onSelectListing={handleSelectListing}
            onPreviewListingChange={setPreviewedListingId}
            onViewListing={handleViewDetail}
            onBoundsChange={handleMapBoundsChange}
            onViewportContextChange={setViewportContext}
            onClusterPreview={handleClusterPreview}
            onPlaceSuggestionsChange={setPlaceSuggestions}
            initialCenter={initialCenter}
            searchQuery={urlQuery}
            searchPlaceId={urlPlaceId}
            suggestionQuery={draftSearchQuery}
            mobileBottomPadding={mobileSheetHeight}
            fitListingsRequest={fitListingsRequest}
            clusterFitRequest={clusterFitRequest}
            detailOpen={Boolean(detailListing)}
            detailPanelExpanded={isDetailPanelExpanded}
          >
            {!isLoadingResults && !listingError && filteredListings.length === 0 ? (
              <QuickFilterEmptyState
                filter={activeQuickFilter}
                authenticated={favoritesAuthenticated}
                favoritesError={favoritesError}
                onClear={() => handleQuickFilterChange("all")}
                overlay
              />
            ) : null}
            <MapControls className="absolute top-[9.5rem] z-[var(--z-controls)] lg:top-8" />
          </MapViewLoader>

        </div>
      </div>
      </LayoutGroup>

      {/* Mobile Shell (<1024px) */}
      <LayoutGroup id="discovery-mobile">
      <div className="lg:hidden">
        <MobileDiscoveryShell
          onBack={handleBack}
          screenTitle="Listings Near You"
          searchQuery={draftSearchQuery}
          onSearchChange={(value) => handleSearchChange(value, "mobile")}
          onSearchSubmit={submitSearch}
          onClearSearch={handleClearSearch}
          searchActive={Boolean(draftSearchQuery || urlPlaceId)}
          onToggleFilters={() => {
            closeSearchSuggestions();
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
          searchSuggestionsOpen={activeSearchSurface === "mobile"}
          onSearchFocus={() => handleSearchFocus("mobile")}
          onSearchKeyDown={(event) => handleSearchKeyDown(event, "mobile")}
          onDismissSearchSuggestions={closeSearchSuggestions}
          activeSearchSuggestionIndex={resolvedActiveSearchSuggestionIndex}
          onActiveSearchSuggestionIndexChange={setActiveSearchSuggestionIndex}
          onSuggestionSelect={handleSuggestionSelect}
          isSearchLoading={isLoadingListings}
          searchInputRef={mobileSearchInputRef}
          cards={cards}
          selectedListingId={selectedListingId}
           isLoading={isLoadingResults}
          error={listingError}
          onRetry={handleRetry}
          onSelectCard={handleViewDetail}
          onSeeAll={handleSeeAll}
           emptyState={listingEmptyState}
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
                      {isLoadingResults ? "Updating preview..." : `${draftResultCount} homes in view`}
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
                  isLoading={isLoadingResults}
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

        {/* Mobile Bottom_Sheet — three-snap, drag-aware listings sheet. */}
        {!detailListing ? (
          <MobileBottomSheet
            snap={sheetSnap}
            onSnapChange={handleSheetSnapChange}
            aria-label={sheetSnap === "full" ? "Show map" : sheetSnap === "browse" ? "Open full listings list" : "Browse listings"}
            peek={mobileSheetPeek}
            resultCount={filteredListings.length}
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
            className="fixed inset-x-0 bottom-0 z-[var(--z-detail-mobile)] overflow-hidden rounded-t-2xl bg-panel shadow-[var(--elevation-3)] animate-in fade-in slide-in-from-bottom-12 duration-300 ease-[var(--ease-out-quart)]"
            style={{ top: "max(env(safe-area-inset-top), 0.25rem)" }}
          >
            <div className="h-full overflow-y-auto">
              <ListingDetailPanel listing={detailListing} initialIntent={initialIntent} onBack={closeDetailPanel} />
            </div>
          </div>
        ) : null}
      </div>
      </LayoutGroup>
    </main>
  );
}
