"use client";

import { Bath, BedDouble, CalendarDays, Heart, MapPin, MessageSquare, Search, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { MapView } from "./map-view";

type Listing = {
  id: string;
  title: string;
  area: string;
  price: string;
  fullPrice: string;
  beds: number;
  baths: number;
  match: string;
  coordinates: [number, number];
};

const listings: Listing[] = [
  {
    id: "maboneng-loft",
    title: "Maboneng Loft",
    area: "Johannesburg CBD",
    price: "R9,800",
    fullPrice: "R 9 800",
    beds: 1,
    baths: 1,
    match: "Verified inquiry ready",
    coordinates: [28.0567, -26.2034],
  },
  {
    id: "rosebank-garden-flat",
    title: "Rosebank Garden Flat",
    area: "Rosebank, Johannesburg",
    price: "R12,400",
    fullPrice: "R 12 400",
    beds: 2,
    baths: 1,
    match: "3 viewing slots",
    coordinates: [28.0436, -26.1456],
  },
  {
    id: "menlyn-apartment",
    title: "Menlyn Apartment",
    area: "Pretoria East",
    price: "R11,500",
    fullPrice: "R 11 500",
    beds: 2,
    baths: 2,
    match: "Application cap tracked",
    coordinates: [28.2753, -25.7863],
  },
];

type DiscoveryPageProps = {
  mapboxToken?: string;
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
    thumbnailUrl: string | null;
  }[];
};

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
    match: pin.thumbnailUrl ? "Photo ready" : "Published listing",
    coordinates: [pin.longitude, pin.latitude],
  };
}

export function DiscoveryPage({ mapboxToken }: DiscoveryPageProps) {
  const listingRequestRef = useRef<AbortController | null>(null);
  const [visibleListings, setVisibleListings] = useState<Listing[]>(listings);
  const [selectedListingId, setSelectedListingId] = useState<string | undefined>(visibleListings[0]?.id);
  const [isLoadingListings, setIsLoadingListings] = useState(false);
  const [listingError, setListingError] = useState<string | null>(null);
  const selectedListing = useMemo(
    () => visibleListings.find((listing) => listing.id === selectedListingId) ?? visibleListings[0] ?? listings[0],
    [selectedListingId, visibleListings],
  );
  const handleBoundsChange = useCallback((bounds: ViewportBounds) => {
    listingRequestRef.current?.abort();

    const controller = new AbortController();
    listingRequestRef.current = controller;
    const bbox = [bounds.west, bounds.south, bounds.east, bounds.north]
      .map((coordinate) => coordinate.toFixed(6))
      .join(",");

    setIsLoadingListings(true);
    setListingError(null);

    fetch(`/api/listings?bbox=${bbox}`, { signal: controller.signal })
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
          setSelectedListingId(undefined);
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
  }, []);

  useEffect(() => {
    return () => listingRequestRef.current?.abort();
  }, []);

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <div className="grid h-full lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_440px]">
        <section className="relative min-h-0 border-border lg:border-r">
          <MapView
            accessToken={mapboxToken}
            listings={visibleListings.length > 0 ? visibleListings : listings}
            selectedListingId={selectedListingId}
            onSelectListing={setSelectedListingId}
            onBoundsChange={handleBoundsChange}
          />

          <header className="pointer-events-none absolute left-0 right-0 top-0 z-10 p-3 sm:p-4">
            <div className="pointer-events-auto flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-white/80 bg-white/90 px-3 py-2 shadow-sm backdrop-blur">
                <span className="flex size-8 items-center justify-center rounded-md bg-[#173b33] text-white">
                  <MapPin className="size-4" />
                </span>
                <span className="font-semibold text-[#173b33]">RoomZA</span>
              </div>

              <Button size="icon" variant="outline" aria-label="Filter listings" className="bg-white/90 shadow-sm backdrop-blur">
                <SlidersHorizontal className="size-4" />
              </Button>
            </div>

            <div className="pointer-events-auto mt-3 flex max-w-xl items-center gap-3 rounded-lg border border-white/80 bg-white/95 px-4 py-3 shadow-lg shadow-black/10 backdrop-blur">
              <Search className="size-5 text-[#2b6357]" />
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                Search suburb, city, or listing ID
              </span>
            </div>
          </header>

          <div className="pointer-events-none absolute bottom-4 left-3 right-3 z-10 sm:left-4 sm:right-auto sm:w-[360px] lg:hidden">
            <article className="pointer-events-auto rounded-lg border border-white/80 bg-white/95 p-4 shadow-xl shadow-black/15 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-lg font-semibold tracking-normal">{selectedListing.title}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedListing.area}</p>
                </div>
                <p className="shrink-0 font-semibold">{selectedListing.fullPrice}</p>
              </div>
              <ListingFacts listing={selectedListing} />
            </article>
          </div>
        </section>

        <aside className="hidden min-h-0 flex-col bg-background lg:flex">
          <div className="border-b border-border p-5">
            <p className="text-sm font-medium text-muted-foreground">Discovery queue</p>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-normal">Visible listings</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isLoadingListings ? "Loading homes in this viewport" : `${visibleListings.length} homes inside the current viewport`}
                </p>
              </div>
              <Button size="icon" variant="outline" aria-label="Open viewing calendar">
                <CalendarDays className="size-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-5">
            {listingError ? (
              <p className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                {listingError}
              </p>
            ) : null}

            {visibleListings.length === 0 && !isLoadingListings ? (
              <p className="rounded-lg border border-border bg-muted/35 p-4 text-sm text-muted-foreground">
                No published listings in this viewport.
              </p>
            ) : null}

            {visibleListings.map((listing) => (
              <button
                className={cn(
                  "w-full rounded-lg border bg-card p-4 text-left shadow-sm transition hover:border-[#2b6357]/60 hover:bg-muted/40",
                  selectedListingId === listing.id ? "border-[#2b6357] ring-2 ring-[#2b6357]/15" : "border-border",
                )}
                key={listing.id}
                onClick={() => setSelectedListingId(listing.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{listing.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{listing.area}</p>
                  </div>
                  <p className="text-right font-semibold">{listing.fullPrice}</p>
                </div>
                <ListingFacts listing={listing} />
              </button>
            ))}
          </div>

          <div className="border-t border-border p-5">
            <div className="mb-4 rounded-lg border border-border bg-muted/35 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold">{selectedListing.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedListing.area}</p>
                </div>
                <Button size="icon" variant="ghost" aria-label="Save listing">
                  <Heart className="size-4" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button className="h-10" variant="outline">
                <MessageSquare className="size-4" />
                Message
              </Button>
              <Button className="h-10 bg-[#173b33] text-white hover:bg-[#102a24]">Apply now</Button>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function ListingFacts({ listing }: { listing: Listing }) {
  return (
    <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <BedDouble className="size-4" />
        {listing.beds}
      </span>
      <span className="flex items-center gap-1.5">
        <Bath className="size-4" />
        {listing.baths}
      </span>
      <span className="ml-auto rounded-md bg-[#e7f2ee] px-2 py-1 text-xs font-medium text-[#2b6357]">
        {listing.match}
      </span>
    </div>
  );
}
