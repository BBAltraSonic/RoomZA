"use client";

import {
  AlertTriangle,
  Bath,
  BedDouble,
  Building2,
  CalendarDays,
  List,
  Map as MapIcon,
  MapPin,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

import { NavigationTabs } from "@/components/navigation/navigation";
import { StatusBadge } from "@/components/premium/primitives";
import { SaveIconButton } from "@/components/premium/property-card";
import { cn } from "@/lib/utils";

import { ListingDetailPanel, type ListingDetail } from "./listing-detail-panel";
import { MapControls } from "./map-controls";
import { MapView } from "./map-view";
import { useFavorites } from "./hooks/use-favorites";

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
  }[];
};

function formatPrice(price: number) {
  return `R${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(price)}`;
}

function formatFullPrice(price: number) {
  return `R ${new Intl.NumberFormat("en-ZA").format(price)}`;
}

function getAvailabilityLabel(dateStr: string | null) {
  if (!dateStr) return "Available";
  const availDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (availDate <= today) return "Available now";

  return `From ${availDate.toLocaleDateString("en-ZA", {
    month: "short",
    day: "numeric",
  })}`;
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
  };
}

function ListingCard({
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
  const imageUrl = listing.imageUrls[0];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-panel shadow-[var(--elevation-1)] transition-colors hover:border-forest/35",
        compact ? "flex h-36 w-[320px] shrink-0 snap-center" : "flex flex-col",
        isSelected ? "border-forest ring-2 ring-forest/15" : "border-border",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className={cn("flex min-w-0 flex-1 text-left", compact ? "flex-row" : "flex-col")}
      >
        <div className={cn("relative shrink-0 overflow-hidden bg-muted", compact ? "h-full w-32" : "aspect-[4/3] w-full")}>
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={listing.title}
              fill
              unoptimized
              sizes={compact ? "128px" : "(min-width: 1024px) 480px, 100vw"}
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <Building2 className="size-8" />
            </div>
          )}
          <StatusBadge tone="forest" className="absolute left-3 top-3">
            {getAvailabilityLabel(listing.availabilityDate)}
          </StatusBadge>
        </div>

        <div className="flex min-w-0 flex-1 flex-col p-4">
          <div className="min-w-0 flex-1">
            <h2 className="line-clamp-2 text-base font-semibold leading-snug text-ink">
              {listing.title}
            </h2>
            <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
              <MapPin className="size-3.5 shrink-0 text-clay" />
              <span className="truncate">{listing.area}</span>
            </p>
          </div>

          <div className="mt-3 flex items-end justify-between gap-2">
            <p className="text-lg font-semibold text-ink">
              {listing.fullPrice}
              <span className="ml-1 text-xs font-medium text-muted-foreground">/mo</span>
            </p>
            <div className="flex shrink-0 items-center gap-2 rounded-md bg-warm-surface px-2 py-1 text-xs font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <BedDouble className="size-3.5 text-forest" />
                {listing.beds}
              </span>
              <span className="inline-flex items-center gap-1">
                <Bath className="size-3.5 text-forest" />
                {listing.baths}
              </span>
            </div>
          </div>
        </div>
      </button>

      <div className="absolute right-3 top-3">
        <SaveIconButton
          saved={favorited}
          onClick={(event) => {
            event.stopPropagation();
            toggleFavorite(listing.id);
          }}
        />
      </div>
    </div>
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
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const [mapLocationName, setMapLocationName] = useState("");
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds | null>(null);
  const [isLoadingListings, setIsLoadingListings] = useState(false);
  const [listingError, setListingError] = useState<string | null>(null);
  const [detailListing, setDetailListing] = useState<ListingDetail | null>(initialListing ?? null);

  const initialCenter = useMemo(() => {
    if (!initialListing) return undefined;
    return { lat: initialListing.latitude, lng: initialListing.longitude };
  }, [initialListing]);

  const handleViewDetail = useCallback((listingId: string) => {
    setSelectedListingId(listingId);
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

    const queryParams = new URLSearchParams();
    queryParams.set("bbox", bbox);
    if (urlQuery) queryParams.set("q", urlQuery);

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
  }, [viewportBounds, urlQuery]);

  useEffect(() => {
    return () => listingRequestRef.current?.abort();
  }, []);

  const homesLabel = isLoadingListings
    ? "Loading homes in view"
    : `${visibleListings.length} ${visibleListings.length === 1 ? "home" : "homes"} in view`;

  return (
    <main className="relative h-screen overflow-hidden bg-background text-ink">
      <h1 className="sr-only">Homes in view</h1>

      <div className={cn("absolute inset-0 z-[var(--z-map)]", viewMode === "list" && "hidden")}>
        <MapView
          apiKey={googleMapsApiKey}
          listings={visibleListings}
          selectedListingId={selectedListingId}
          onSelectListing={setSelectedListingId}
          onBoundsChange={setViewportBounds}
          onCenterNameChange={setMapLocationName}
          initialCenter={initialCenter}
          searchQuery={urlQuery}
        >
          <MapControls className="absolute top-24 z-[var(--z-controls)]" />
        </MapView>
      </div>

      <header
        className={cn(
          "pointer-events-none absolute left-0 top-0 z-[var(--z-chrome)] pb-4 pl-4 pr-16 pt-4 md:px-4",
          hideSidebar ? "right-0" : "right-0 lg:right-[var(--sidebar-w-lg)] xl:right-[var(--sidebar-w-xl)]",
        )}
      >
        <div className="pointer-events-auto grid gap-3 rounded-lg border border-border bg-panel p-3 shadow-[var(--elevation-2)] md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
          <NavigationTabs className="hidden md:flex" />

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
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-ink"
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
            <button
              type="button"
              onClick={() => setViewMode((prev) => (prev === "map" ? "list" : "map"))}
              className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-panel text-ink transition-colors hover:bg-warm-surface"
              aria-label={viewMode === "map" ? "Show list" : "Show map"}
            >
              {viewMode === "map" ? <List className="size-4" /> : <MapIcon className="size-4" />}
            </button>
          </div>
        </div>
      </header>

      {viewMode === "list" ? (
        <section className="absolute inset-x-0 bottom-0 top-28 z-[var(--z-list-view)] overflow-y-auto bg-background p-4 md:p-6 lg:p-8">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-clay">Discovery</p>
              <h2 className="mt-1 text-2xl font-semibold text-ink">Listings</h2>
            </div>
            <button
              type="button"
              className="flex size-9 items-center justify-center rounded-md border border-border bg-panel text-muted-foreground"
              aria-label="Viewing calendar"
            >
              <CalendarDays className="size-4" />
            </button>
          </div>

          {listingError ? (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>{listingError}</p>
            </div>
          ) : null}

          {isLoadingListings && visibleListings.length === 0 ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-64 animate-pulse rounded-lg border border-border bg-muted" />
              ))}
            </div>
          ) : null}

          {visibleListings.length === 0 && !isLoadingListings && !listingError ? (
            <div className="rounded-lg border border-dashed border-border bg-panel p-8 text-center">
              <Search className="mx-auto size-8 text-muted-foreground" />
              <h3 className="mt-4 text-base font-semibold text-ink">No homes in view</h3>
              <p className="mt-2 text-sm text-muted-foreground">Move the map or search another area.</p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {visibleListings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                isSelected={selectedListingId === listing.id}
                onSelect={() => handleViewDetail(listing.id)}
              />
            ))}
            <LandlordCta />
          </div>
        </section>
      ) : null}

      <aside
        className={cn(
          "absolute bottom-0 right-0 top-0 z-[var(--z-controls)] hidden w-[var(--sidebar-w-lg)] flex-col overflow-hidden border-l border-border bg-panel shadow-[var(--elevation-3)] lg:flex xl:w-[var(--sidebar-w-xl)]",
          ((!detailListing && viewMode !== "map") || hideSidebar) && "lg:hidden",
        )}
      >
        {detailListing ? (
          <ListingDetailPanel listing={detailListing} onBack={() => setDetailListing(null)} />
        ) : (
          <>
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
                <div className="rounded-lg border border-dashed border-border bg-panel p-8 text-center">
                  <Search className="mx-auto size-8 text-muted-foreground" />
                  <h3 className="mt-4 text-base font-semibold text-ink">No homes in view</h3>
                  <p className="mt-2 text-sm text-muted-foreground">Move the map or search another area.</p>
                </div>
              ) : null}

              {visibleListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  isSelected={selectedListingId === listing.id}
                  onSelect={() => handleViewDetail(listing.id)}
                />
              ))}
              <LandlordCta />
            </div>
          </>
        )}
      </aside>

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-4 z-[var(--z-controls)] lg:hidden",
          viewMode !== "map" && "hidden",
        )}
      >
        <div className="pointer-events-auto flex gap-3 overflow-x-auto px-4 pb-1 snap-x snap-mandatory scrollbar-hide">
          {visibleListings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              compact
              isSelected={selectedListingId === listing.id}
              onSelect={() => handleViewDetail(listing.id)}
            />
          ))}
          <div className="w-1 shrink-0" />
        </div>
      </div>

      {detailListing ? (
        <div className={cn("fixed inset-0 z-[var(--z-detail-mobile)] bg-panel lg:hidden", viewMode === "map" ? "" : "")}>
          <div className="h-full overflow-y-auto">
            <ListingDetailPanel listing={detailListing} onBack={() => setDetailListing(null)} />
          </div>
        </div>
      ) : null}
    </main>
  );
}
