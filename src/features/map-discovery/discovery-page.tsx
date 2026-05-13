"use client";

import { AlertTriangle, Bath, BedDouble, CalendarDays, Heart, MapPin, Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ListingDetailPanel, type ListingDetail } from "./listing-detail-panel";
import { MapView } from "./map-view";
import { MapControls } from "./map-controls";
import { ApplicationModal } from "@/features/applications/application-modal";

type Listing = {
  id: string;
  title: string;
  area: string;
  price: string;
  fullPrice: string;
  beds: number;
  baths: number;
  match: string;
  coordinates: { lat: number; lng: number };
  imageUrls: string[];
  availabilityDate: string | null;
};

type DiscoveryPageProps = {
  googleMapsApiKey?: string;
  initialListing?: ListingDetail | null;
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

function getAvailabilityLabel(dateStr: string | null): { label: string; isAvailableNow: boolean } {
  if (!dateStr) return { label: "Available", isAvailableNow: true };
  const availDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (availDate <= today) {
    return { label: "Available Now", isAvailableNow: true };
  }
  return {
    label: `From ${availDate.toLocaleDateString("en-ZA", { month: "short", day: "numeric" })}`,
    isAvailableNow: false,
  };
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
    match: pin.imageUrls && pin.imageUrls.length > 0 ? "Photo ready" : "Published listing",
    coordinates: { lat: pin.latitude, lng: pin.longitude },
    imageUrls: pin.imageUrls || [],
    availabilityDate: pin.availabilityDate,
  };
}

/* ─── Luxury Availability Badge ─── */
function AvailabilityBadge({ dateStr, className }: { dateStr: string | null; className?: string }) {
  const { label } = getAvailabilityLabel(dateStr);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium tracking-wide text-slate-700 shadow-sm",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-slate-800" />
      {label}
    </span>
  );
}

function ImageCarousel({ imageUrls, alt }: { imageUrls: string[]; alt: string }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!imageUrls || imageUrls.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <MapPin className="size-10 text-gray-300" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 group/carousel">
      <Image
        src={imageUrls[currentIndex]}
        alt={alt}
        fill
        sizes="(min-width: 1024px) 400px, 100vw"
        className="object-cover transition-transform duration-700 ease-in-out group-hover:scale-105"
      />

      {imageUrls.length > 1 && (
        <>
          {/* Controls */}
          <div className="absolute inset-0 flex items-center justify-between p-2 opacity-0 group-hover/carousel:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex((prev) => (prev === 0 ? imageUrls.length - 1 : prev - 1));
              }}
              className="size-7 rounded-full bg-white/80 flex items-center justify-center hover:bg-white text-slate-800 shadow-sm transition-transform hover:scale-105"
              aria-label="Previous image"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex((prev) => (prev === imageUrls.length - 1 ? 0 : prev + 1));
              }}
              className="size-7 rounded-full bg-white/80 flex items-center justify-center hover:bg-white text-slate-800 shadow-sm transition-transform hover:scale-105"
              aria-label="Next image"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* Indicators */}
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
            {imageUrls.map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300 shadow-sm",
                  idx === currentIndex ? "w-4 bg-white" : "w-1.5 bg-white/60"
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Dark Luxury Listing Card ─── */
function ListingCard({
  listing,
  isSelected,
  compact,
  onSelect,
}: {
  listing: Listing;
  isSelected?: boolean;
  compact?: boolean;
  onSelect?: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.();
        }
      }}
      className={cn(
        "group relative w-full overflow-hidden rounded-[24px] text-left transition-all duration-300 ease-out flex flex-col",
        isSelected
          ? "ring-2 ring-slate-900 shadow-xl translate-y-[-4px] bg-white"
          : "hover:ring-1 hover:ring-gray-300 hover:shadow-lg hover:translate-y-[-2px] bg-white shadow-sm ring-1 ring-gray-100",
      )}
    >
      {/* Top Image Section */}
      <div className={cn("relative w-full overflow-hidden bg-gray-100 shrink-0", compact ? "h-[120px]" : "aspect-[4/3] sm:aspect-[16/10]")}>
        <ImageCarousel imageUrls={listing.imageUrls} alt={listing.title} />

        {/* Top right action buttons */}
        <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-full border border-gray-200 bg-white/90 text-slate-900 shadow-sm transition-all duration-300 hover:bg-white hover:text-red-500 hover:border-red-200"
            aria-label="Save listing"
            onClick={(e) => e.stopPropagation()}
          >
            <Heart className="size-4" />
          </button>
        </div>
      </div>

      {/* Card content (bottom) */}
      <div className="relative z-10 p-5 bg-white flex flex-col gap-1 shrink-0">
        <AvailabilityBadge dateStr={listing.availabilityDate} className="self-start mb-2" />

        <h2 className="text-lg font-semibold tracking-tight text-slate-900 truncate">
          {listing.title}
        </h2>

        <div className="flex items-end justify-between gap-3 mt-1">
          <p className="text-sm font-medium text-slate-600 tracking-wide truncate">{listing.area}</p>
          <div className="flex shrink-0 items-baseline gap-1 font-bold text-slate-900">
            <span className="text-xl whitespace-nowrap">{listing.fullPrice}</span>
            <span className="text-xs font-normal text-slate-500 whitespace-nowrap">/mo</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Compact glass card for mobile carousel ─── */
function CarouselCard({
  listing,
  isSelected,
  onSelect,
}: {
  listing: Listing;
  isSelected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.();
        }
      }}
      className={cn(
        "group relative flex-none w-[300px] h-[150px] flex flex-row overflow-hidden rounded-[20px] text-left snap-center transition-all duration-300 ease-out shadow-md",
        isSelected
          ? "ring-2 ring-slate-900 bg-white"
          : "hover:shadow-lg ring-1 ring-gray-100 hover:ring-gray-300 bg-white",
      )}
    >
      {/* Left image section */}
      <div className="relative w-[110px] shrink-0 overflow-hidden bg-gray-100">
        {listing.imageUrls && listing.imageUrls.length > 0 ? (
          <Image
            src={listing.imageUrls[0]}
            alt=""
            fill
            sizes="110px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <MapPin className="size-8 text-gray-300" />
          </div>
        )}
      </div>

      {/* Right content */}
      <div className="flex flex-col flex-1 justify-between p-3.5 bg-white overflow-hidden">
        <div>
          <AvailabilityBadge dateStr={listing.availabilityDate} className="mb-1.5 text-[10px] px-2 py-0.5" />
          <h3 className="text-sm font-semibold text-slate-900 truncate leading-tight drop-shadow-none">{listing.title}</h3>
          <p className="text-xs font-medium text-slate-500 truncate mt-0.5 drop-shadow-none">{listing.area}</p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-bold text-slate-900 drop-shadow-none whitespace-nowrap shrink-0">
            {listing.fullPrice}<span className="text-[10px] font-medium text-slate-400">/mo</span>
          </span>
          <div className="flex shrink-0 items-center gap-2 text-[10px] font-medium text-slate-600 bg-gray-100 px-1.5 py-0.5 rounded-sm whitespace-nowrap">
            <span className="flex items-center gap-0.5"><BedDouble className="size-3" />{listing.beds}</span>
            <span className="flex items-center gap-0.5"><Bath className="size-3" />{listing.baths}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DiscoveryPage({ googleMapsApiKey, initialListing }: DiscoveryPageProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const urlQuery = searchParams.get("q") ?? "";

  const listingRequestRef = useRef<AbortController | null>(null);
  const [visibleListings, setVisibleListings] = useState<Listing[]>([]);
  const [selectedListingId, setSelectedListingId] = useState<string | undefined>(
    initialListing?.id,
  );
  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds | null>(null);
  const [isLoadingListings, setIsLoadingListings] = useState(false);
  const [listingError, setListingError] = useState<string | null>(null);
  const [detailListing, setDetailListing] = useState<ListingDetail | null>(initialListing ?? null);
  const selectedListing = useMemo(
    () => visibleListings.find((listing) => listing.id === selectedListingId) ?? visibleListings[0],
    [selectedListingId, visibleListings],
  );

  const initialCenter = useMemo(() => {
    if (initialListing) {
      return { lat: initialListing.latitude, lng: initialListing.longitude };
    }
    return undefined;
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
        // Silently fail — user can still see the card
      });
  }, []);

  const handleBoundsChange = useCallback((bounds: ViewportBounds) => {
    setViewportBounds(bounds);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
    if (urlQuery) {
      queryParams.set("q", urlQuery);
    }

    fetch(`/api/listings?${queryParams.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load visible listings.");
        }

        return (await response.json()) as ViewportListingResponse;
      })
      .then((payload) => {
        const nextListings = payload.listings.map(toListing);

        if (nextListings.length === 0) {
          setVisibleListings([]);
          setSelectedListingId((currentId) =>
            nextListings.some((listing) => listing.id === currentId) ? currentId : undefined,
          );
          return;
        }

        setVisibleListings(nextListings);
        setSelectedListingId((currentId) =>
          nextListings.some((listing) => listing.id === currentId) ? currentId : nextListings[0].id,
        );
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

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

  return (
    <main className="relative h-screen overflow-hidden bg-bg-base text-white/90 selection:bg-gold/30">
      <h1 className="sr-only">Browse Rentals on the Map</h1>
      {/* ─── Full-screen map base layer ─── */}
      <div className="absolute inset-0">
        <MapView
          apiKey={googleMapsApiKey}
          listings={visibleListings}
          selectedListingId={selectedListingId}
          onSelectListing={setSelectedListingId}
          onBoundsChange={handleBoundsChange}
          initialCenter={initialCenter}
          searchQuery={urlQuery}
        >
          <MapControls className="absolute right-5 top-[100px] lg:right-[520px] xl:right-[560px] lg:top-[100px] z-20" />
        </MapView>
      </div>

      {/* ─── Floating Map Header ─── */}
      <header className="pointer-events-none absolute left-0 right-0 top-0 z-30 p-5 lg:pr-[520px] xl:pr-[560px] flex items-center justify-start">
        <div className="w-full flex items-center justify-between gap-4">
          <Link
            href="/"
            className="pointer-events-auto flex size-[50px] shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white shadow-md transition-all duration-300 hover:bg-gray-50"
          >
            <div className="relative flex size-8 items-center justify-center rounded-full bg-slate-900">
              <div className="absolute inset-[1px] rounded-full bg-white" />
              <MapPin className="relative z-10 size-3.5 text-slate-900" />
            </div>
          </Link>

          <form
            role="search"
            className={cn(
              "pointer-events-auto flex flex-1 items-center gap-3 rounded-full border px-5 py-3 shadow-lg transition-all duration-500",
              isSearchFocused
                ? "border-slate-400 ring-1 ring-slate-400 bg-white shadow-xl"
                : "bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50",
            )}
            onSubmit={handleSearchSubmit}
          >
            <Search className={cn(
              "size-4 shrink-0 transition-colors duration-300",
              isSearchFocused ? "text-slate-600" : "text-gray-400"
            )} aria-hidden="true" />
            <input
              type="search"
              className="min-w-0 flex-1 bg-transparent text-[15px] tracking-wide text-slate-900 outline-none placeholder:text-gray-400"
              placeholder="Search neighborhood, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              aria-label="Search listings"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="flex size-6 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-all hover:bg-gray-200 hover:text-gray-900"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </form>
        </div>
      </header>

      {/* ─── Desktop: Floating glass sidebar (LEFT side) ─── */}
      <aside
        className={cn(
          "hidden lg:flex absolute top-5 right-5 bottom-5 z-20",
          "w-[480px] xl:w-[520px] flex-col overflow-hidden",
          "rounded-[24px] border border-gray-200",
          "bg-white",
          "shadow-2xl",
          "animate-in slide-in-from-right-8 fade-in duration-500",
        )}
      >
        {detailListing ? (
          <ListingDetailPanel
            listing={detailListing}
            onBack={() => setDetailListing(null)}
          />
        ) : (
          <>
            {/* Sidebar header */}
            <div className="px-7 pt-7 pb-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-[1px] w-6 bg-slate-300" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Explore</p>
              </div>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-medium tracking-tight text-slate-900 mb-1">
                    Distinguished Homes
                  </h1>
                  <p className="text-sm tracking-wide text-slate-500">
                    {isLoadingListings ? "Curating selections..." : `${visibleListings.length} properties in view`}
                  </p>
                </div>
                <button
                  type="button"
                  className="flex size-10 items-center justify-center rounded-full border border-gray-200 bg-white text-slate-500 transition-all hover:bg-gray-50 hover:text-slate-900 hover:border-gray-300"
                  aria-label="Open viewing calendar"
                >
                  <CalendarDays className="size-4" />
                </button>
              </div>
            </div>

            {/* Listing cards */}
            <div className="flex flex-col gap-6 flex-1 overflow-y-auto px-5 py-2 scrollbar-hide">
              {listingError ? (
                <div className="flex items-start gap-4 rounded-2xl border border-red-500/10 bg-red-500/5 p-5 shrink-0">
                  <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-400" />
                  <div>
                    <p className="text-sm font-medium tracking-wide text-red-200">Unable to load collection</p>
                    <p className="mt-1 text-xs text-red-300/60 leading-relaxed">Adjust your view or try again.</p>
                  </div>
                </div>
              ) : null}

              {isLoadingListings && visibleListings.length === 0 ? (
                <div className="flex flex-col gap-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="aspect-[4/3] sm:aspect-[16/10] animate-pulse rounded-[24px] bg-gray-50 border border-gray-100 shrink-0" />
                  ))}
                </div>
              ) : null}

              {visibleListings.length === 0 && !isLoadingListings && !listingError ? (
                <div className="flex flex-col items-center py-16 text-center">
                  <div className="flex size-20 items-center justify-center rounded-full bg-gray-50 border border-gray-100 shadow-inner">
                    <Search className="size-8 text-gray-300" />
                  </div>
                  <h3 className="mt-6 text-lg font-medium text-slate-900">No properties found</h3>
                  <p className="mt-2 max-w-[240px] text-sm text-slate-500 leading-relaxed">
                    Widen your search area to discover more extraordinary spaces.
                  </p>
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

              {/* Padding at bottom for scroll */}
              <div className="h-4" />
            </div>
          </>
        )}
      </aside>

      {/* ─── Mobile: Transparent floating carousel ─── */}
      <div className="pointer-events-none absolute bottom-5 left-0 right-0 z-20 lg:hidden">
        {visibleListings.length > 0 && (
          <div className="pointer-events-auto animate-in slide-in-from-bottom-6 fade-in duration-500 ease-out fill-mode-both">
            <div className="flex gap-3 overflow-x-auto px-4 pb-1 snap-x snap-mandatory scrollbar-hide">
              {visibleListings.map((listing) => (
                <CarouselCard
                  key={listing.id}
                  listing={listing}
                  isSelected={selectedListingId === listing.id}
                  onSelect={() => handleViewDetail(listing.id)}
                />
              ))}
              {/* Trailing spacer so last card doesn't hug edge */}
              <div className="flex-none w-1" />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
