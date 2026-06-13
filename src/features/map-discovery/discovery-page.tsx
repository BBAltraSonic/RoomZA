"use client";

import { AlertTriangle, Search, ChevronDown, SlidersHorizontal, LayoutGrid, Map as MapIcon, Bell, MessageSquare, Home, Compass, Heart, List, User, LogOut, Check } from "lucide-react";
import { Component, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { PropertyCard, SaveIconButton } from "@/components/premium/property-card";
import { useOnClickOutside } from "@/lib/hooks/use-on-click-outside";
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
  /** Display name for the signed-in user (e.g. derived from their email or profile). */
  userName?: string | null;
  /** Email for the signed-in user, shown beneath the name in the profile menu. */
  userEmail?: string | null;
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
  return `R ${new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 }).format(price)}`;
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
  revealIndex,
}: {
  listing: Listing;
  isSelected?: boolean;
  onSelect: () => void;
  compact?: boolean;
  revealIndex?: number | null;
}) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorited = isFavorite(listing.id);

  const reveal = revealIndex != null;

  return (
    <div
      className={reveal ? "discovery-card-reveal" : undefined}
      style={reveal ? ({ "--stagger-index": revealIndex } as React.CSSProperties) : undefined}
    >
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
    </div>
  );
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



export function DiscoveryPage({ googleMapsApiKey, initialListing, initialIntent, isAuthenticated = false, userName, userEmail }: DiscoveryPageProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const urlQuery = searchParams.get("q") ?? "";
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

  // Housi UI State
  const [isGridView, setIsGridView] = useState(false);
  const [sortBy, setSortBy] = useState("Latest");
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(sortMenuRef, () => setIsSortOpen(false));
  useOnClickOutside(profileMenuRef, () => setIsProfileMenuOpen(false));
  const SORT_OPTIONS = ["Latest", "Price: Low to High", "Price: High to Low", "Most Nearest"] as const;

  const handleSignOut = useCallback(() => {
    setIsProfileMenuOpen(false);
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/auth/sign-out";
    document.body.appendChild(form);
    form.submit();
  }, []);

  const desktopNavItems = [
    { href: "/", label: "Discovery", icon: Compass },
    { href: "/listings", label: "List", icon: List },
    { href: "/saved", label: "Saved", icon: Heart },
    { href: "/profile", label: "Profile", icon: User },
  ];
  // Distance origin for the card model pipeline (Req 6.3, Data Gap 2):
  // best-effort visitor geolocation; falls back to the current map center
  // (derived from viewportBounds), else null => distanceKm is null.
  const [geoOrigin, setGeoOrigin] = useState<GeoPoint | null>(null);
  // Recenter target forwarded to MapView when the visitor uses the Locate_Button.
  // The nonce increments on every successful locate so repeated clicks to the
  // same coordinates still trigger a recenter (Req 2.5).
  const [recenterTarget] = useState<
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

  // Desktop listing grid order driven by the "Sort by" control (Housi desktop UI).
  const sortedVisibleListings = useMemo(() => {
    const list = [...visibleListings];
    switch (sortBy) {
      case "Price: Low to High":
        return list.sort((a, b) => a.priceValue - b.priceValue);
      case "Price: High to Low":
        return list.sort((a, b) => b.priceValue - a.priceValue);
      case "Most Nearest": {
        if (!distanceOrigin) return list;
        return list.sort(
          (a, b) =>
            haversineKm(distanceOrigin, { lat: a.coordinates.lat, lng: a.coordinates.lng }) -
            haversineKm(distanceOrigin, { lat: b.coordinates.lat, lng: b.coordinates.lng }),
        );
      }
      case "Latest":
      default:
        return list.sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        });
    }
  }, [visibleListings, sortBy, distanceOrigin]);

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

  // See_All: the BottomSheet already expands itself to its max snap and switches
  // the carousel to the in-place full list (Data Gap 3 default). No route change.
  const handleSeeAll = useCallback(() => {
    // No-op beyond the sheet's own expand; in-place expansion is handled in the
    // shell/sheet. Kept as a named handler for future wiring.
  }, []);

  // Profile menu identity. Falls back gracefully when signed out or when no
  // name is available, rather than rendering a hardcoded placeholder person.
  const profileDisplayName = userName?.trim()
    || (userEmail ? userEmail.split("@")[0] : null)
    || (isAuthenticated ? "Your account" : "Guest");
  const profileEmail = userEmail?.trim() || (isAuthenticated ? null : "Not signed in");
  const profileInitials = profileDisplayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "?";

  return (
    <main className="relative h-screen overflow-hidden bg-warm-surface text-ink flex flex-col">
      <h1 className="sr-only">Homes in view</h1>

      {/* Retracting desktop chrome: both top bars collapse out of flow on
          scroll-down so the left panel reclaims the vertical space, and slide
          back in on scroll-up. */}
      <div
        className={cn(
          "hidden lg:flex flex-none flex-col overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out",
          isChromeHidden ? "max-h-0 opacity-0 pointer-events-none" : "max-h-60 opacity-100",
        )}
      >
      {/* Housi Desktop Top App Bar */}
      <header className="hidden lg:grid flex-none grid-cols-[minmax(180px,1fr)_auto_minmax(280px,1fr)] items-center gap-6 px-9 py-4 bg-panel border-b border-border/40 z-[var(--z-chrome)] relative">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-self-start">
          <div className="flex items-center justify-center size-8 bg-forest rounded text-primary-foreground">
            <Home className="size-5" />
          </div>
          <span className="text-xl font-bold tracking-tight">Housi</span>
        </div>

        {/* Primary desktop navigation */}
        <nav aria-label="Primary" className="flex items-center gap-2 rounded-full border border-border/60 bg-warm-surface p-1 justify-self-center">
          {desktopNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                  isActive ? "bg-panel shadow-sm border border-border/40 text-forest" : "text-muted-foreground hover:text-ink"
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Profile/Nav */}
        <div className="flex items-center gap-4 justify-self-end">
          <Link
            href="/messages"
            aria-label="Messages"
            className="flex items-center justify-center size-10 rounded-full border border-border/60 hover:bg-muted transition-colors"
          >
            <MessageSquare className="size-4 text-muted-foreground" />
          </Link>
          <button
            type="button"
            aria-label="Notifications"
            onClick={() => toast("No new notifications")}
            className="flex items-center justify-center size-10 rounded-full border border-border/60 hover:bg-muted transition-colors"
          >
            <Bell className="size-4 text-muted-foreground" />
          </button>
          <div ref={profileMenuRef} className="relative pl-4 border-l border-border/40">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={isProfileMenuOpen}
              aria-label="Open profile menu"
              onClick={() => setIsProfileMenuOpen((open) => !open)}
              className="flex items-center gap-3 rounded-full p-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-forest ring-1 ring-forest/15">
                {profileInitials}
              </div>
              <div className="flex flex-col items-start">
                <span className="text-sm font-bold leading-tight">{profileDisplayName}</span>
                {profileEmail ? <span className="text-xs text-muted-foreground">{profileEmail}</span> : null}
              </div>
              <ChevronDown className={cn("size-4 text-muted-foreground ml-2 transition-transform", isProfileMenuOpen && "rotate-180")} />
            </button>
            {isProfileMenuOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+0.5rem)] z-[var(--z-chrome)] w-56 origin-top-right animate-in fade-in zoom-in-95 rounded-xl border border-border bg-panel p-1.5 shadow-[var(--elevation-2)]"
              >
                <Link
                  href="/profile"
                  role="menuitem"
                  onClick={() => setIsProfileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-muted"
                >
                  <User className="size-4" />
                  Profile
                </Link>
                <Link
                  href="/saved"
                  role="menuitem"
                  onClick={() => setIsProfileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-muted"
                >
                  <Heart className="size-4" />
                  Saved
                </Link>
                <Link
                  href="/dashboard"
                  role="menuitem"
                  onClick={() => setIsProfileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-muted"
                >
                  <LayoutGrid className="size-4" />
                  Dashboard
                </Link>
                <div className="my-1 h-px bg-border" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-muted"
                >
                  <LogOut className="size-4" />
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* Housi Desktop Sub App Bar */}
      <div className="hidden lg:grid flex-none grid-cols-[minmax(180px,1fr)_minmax(360px,600px)_minmax(220px,1fr)] items-center gap-6 px-9 py-3 bg-panel border-b border-border/40 z-[var(--z-chrome)] relative shadow-sm">
        {/* Context label — this is a rental discovery surface, not a buy/sell marketplace. */}
        <div className="flex items-center gap-2 text-sm font-semibold text-ink h-full justify-self-start">
          <span className="inline-flex size-2 rounded-full bg-forest" aria-hidden="true" />
          Rentals
        </div>

        {/* Search */}
        <form role="search" className="flex w-full items-center gap-3 rounded-full border border-border/60 bg-warm-surface px-4 py-2 shadow-sm transition-colors focus-within:border-forest focus-within:ring-1 focus-within:ring-forest" onSubmit={handleSearchSubmit}>
          <Search className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <input
            ref={desktopSearchInputRef}
            type="search"
            className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted-foreground"
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

        {/* Map/Grid Toggle */}
        <div className="flex items-center gap-1 rounded-full border border-border/60 bg-warm-surface p-1 justify-self-end">
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
      </div>
      </div>

      {/* Desktop Filter Bar (toggled by the search-bar sliders button) */}
      {showFilters ? (
        <div className="hidden lg:block flex-none border-b border-border/40 bg-panel px-9 py-3 z-[var(--z-chrome)] relative shadow-sm">
          <FilterBar filters={filters} onFilterChange={handleFilterChange} className="lg:flex-row lg:items-center" />
        </div>
      ) : null}

      <div className="flex-1 min-h-0 relative flex flex-col lg:flex-row">
        <div className={cn(
          "hidden lg:flex flex-col overflow-hidden bg-warm-surface",
          isGridView ? "w-full" : "w-[50%] xl:w-[55%] border-r border-border/40"
        )}>
          {detailListing ? (
            <div
              key={detailListing.id}
              className="flex h-full flex-col animate-in fade-in slide-in-from-right-4 duration-300 ease-[var(--ease-out-quart)] motion-reduce:animate-none"
            >
              <ListingDetailPanel listing={detailListing} initialIntent={initialIntent} onBack={() => setDetailListing(null)} onScroll={handlePanelScroll} />
            </div>
          ) : (
            <>
              <div className="flex-none px-12 pt-10 pb-5">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-2xl font-bold tracking-tight text-ink">
                    {searchQuery || mapLocationName
                      ? `${searchQuery || mapLocationName} Accommodation`
                      : "Accommodation in South Africa"}
                  </h2>
                  <div ref={sortMenuRef} className="relative flex items-center gap-2 text-sm font-medium">
                    <span className="text-muted-foreground">Sort by:</span>
                    <button
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={isSortOpen}
                      onClick={() => setIsSortOpen((open) => !open)}
                      className="flex items-center gap-1 text-forest hover:text-forest/80 transition-colors"
                    >
                      {sortBy} <ChevronDown className={cn("size-4 transition-transform", isSortOpen && "rotate-180")} />
                    </button>
                    {isSortOpen ? (
                      <div
                        role="menu"
                        className="absolute right-0 top-[calc(100%+0.5rem)] z-[var(--z-chrome)] w-56 origin-top-right animate-in fade-in zoom-in-95 rounded-xl border border-border bg-panel p-1.5 shadow-[var(--elevation-2)]"
                      >
                        {SORT_OPTIONS.map((option) => (
                          <button
                            key={option}
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setSortBy(option);
                              setIsSortOpen(false);
                            }}
                            className={cn(
                              "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
                              sortBy === option ? "text-forest" : "text-ink",
                            )}
                          >
                            {option}
                            {sortBy === option ? <Check className="size-4" /> : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{visibleListings.length} homes found</p>
              </div>
              
              <div className="flex-1 overflow-y-auto px-12 pb-10 scrollbar-hide" onScroll={handlePanelScroll}>
                {listingError ? (
                  <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <p>{listingError}</p>
                  </div>
                ) : null}

                {isLoadingListings && visibleListings.length === 0 ? (
                  <div className={cn("grid gap-6", isGridView ? "grid-cols-3 xl:grid-cols-4" : "grid-cols-2")}>
                    {[1, 2, 3, 4, 5, 6].map((item) => (
                      <div key={item} className="aspect-[4/3] animate-pulse rounded-[24px] border border-border bg-muted" />
                    ))}
                  </div>
                ) : null}

                {visibleListings.length === 0 && !isLoadingListings && !listingError ? (
                  <EmptyStateCapture bbox={viewportBounds} filters={filters} compact={false} />
                ) : null}

                <div className={cn(
                  "grid gap-7 auto-rows-max",
                  isGridView ? "grid-cols-3 xl:grid-cols-4" : "grid-cols-2"
                )}>
                  {sortedVisibleListings.map((listing, index) => (
                    <ListingPropertyCard
                      key={listing.id}
                      listing={listing}
                      isSelected={selectedListingId === listing.id}
                      onSelect={() => handleViewDetail(listing.id)}
                      revealIndex={Math.min(index, 8)}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Map Area */}
        <div className={cn(
          "relative h-full w-full lg:bg-muted",
          "absolute inset-0 z-[var(--z-map)] lg:static lg:inset-auto lg:z-auto",
          isGridView ? "lg:hidden" : "lg:w-[50%] xl:w-[45%]"
        )}>
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
              className={cn(
                "absolute top-36 z-[var(--z-controls)] lg:top-6",
                isGridView ? "max-lg:hidden" : "",
              )}
              onLayersClick={() => setIsLayersPanelOpen(!isLayersPanelOpen)}
              activeLayerCount={activeLayers.size}
            />
            <div ref={mobileLayerPanelRef} className={cn(
              "fixed inset-x-3 top-[5.75rem] z-[var(--z-chrome)] lg:absolute lg:inset-x-auto lg:right-[5.5rem] lg:top-6 lg:z-[var(--z-controls)]",
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
          </MapView>

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
          activeNav="discovery"
        >
          {/* Mobile Filter Bar overlay */}
          {showFilters ? (
            <div
              className="pointer-events-none fixed inset-x-0 z-[var(--z-chrome)] px-4"
              style={{ top: "calc(var(--mobile-safe-top) + 4.75rem)" }}
            >
              <div className="pointer-events-auto mx-auto w-full max-w-[440px] animate-in fade-in slide-in-from-top-2 duration-200 ease-[var(--ease-out-quart)]">
                <div className="rounded-2xl border border-border/60 bg-panel/95 p-3 shadow-lg backdrop-blur-md">
                  <FilterBar filters={filters} onFilterChange={handleFilterChange} />
                </div>
              </div>
            </div>
          ) : null}
        </MobileDiscoveryShell>

        {/* Discovery Spotlight — map-first welcome panel; hidden in Grid view. */}
        {showSpotlight && !isGridView ? (
          <SpotlightErrorBoundary>
            <DiscoverySpotlight
              onDismiss={() => setShowSpotlight(false)}
              onSearchFocus={() => {
                requestAnimationFrame(() => {
                  mobileSearchInputRef.current?.focus();
                });
              }}
              locationName={searchQuery || mapLocationName || "South Africa"}
              homesCount={visibleListings.length}
              isLoading={isLoadingListings}
            />
          </SpotlightErrorBoundary>
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
