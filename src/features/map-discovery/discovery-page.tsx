"use client";

import { AlertTriangle, Bath, BedDouble, CalendarDays, Heart, MapPin, MessageSquare, Search, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ListingDetailPanel, type ListingDetail } from "./listing-detail-panel";
import { MapView } from "./map-view";
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
    coordinates: { lat: pin.latitude, lng: pin.longitude },
  };
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
    // Fetch full listing detail for the panel
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
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <div className="grid h-full lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_440px]">
        <section className="relative min-h-0 border-border lg:border-r">
          <MapView
            apiKey={googleMapsApiKey}
            listings={visibleListings}
            selectedListingId={selectedListingId}
            onSelectListing={setSelectedListingId}
            onBoundsChange={handleBoundsChange}
            initialCenter={initialCenter}
            searchQuery={urlQuery}
          />

          <header className="pointer-events-none absolute left-0 right-0 top-0 z-10 p-3 sm:p-4">
            <div className="pointer-events-auto flex items-center justify-between gap-3">
              <Link href="/" className="flex items-center gap-2 rounded-lg border border-white/80 bg-white/90 px-3 py-2 shadow-sm backdrop-blur transition-colors hover:bg-white">
                <span className="flex size-8 items-center justify-center rounded-md bg-[#173b33] text-white">
                  <MapPin className="size-4" />
                </span>
                <span className="font-semibold text-[#173b33]">RoomZA</span>
              </Link>

              <div className="flex items-center gap-2">
                <Button size="sm" render={<Link href="/auth" />} variant="outline" className="bg-white/90 shadow-sm backdrop-blur font-semibold">
                  Sign In
                </Button>
                <Button size="sm" render={<Link href="/dashboard" />} className="hidden sm:flex bg-[#173b33] text-white hover:bg-[#2b6357] shadow-sm backdrop-blur font-semibold">
                  Dashboard
                </Button>
                <Button size="icon" variant="outline" aria-label="Filter listings" className="bg-white/90 shadow-sm backdrop-blur">
                  <SlidersHorizontal className="size-4" />
                </Button>
              </div>
            </div>

            <form
              role="search"
              className="pointer-events-auto mt-3 flex max-w-xl items-center gap-3 rounded-lg border border-white/80 bg-white/95 px-4 py-3 shadow-lg shadow-black/10 backdrop-blur focus-within:border-[#2b6357] focus-within:ring-1 focus-within:ring-[#2b6357] transition-all"
              onSubmit={handleSearchSubmit}
            >
              <Search className="size-5 shrink-0 text-[#2b6357]" aria-hidden="true" />
              <input
                type="search"
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                placeholder="Search suburb, city, or listing ID"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search listings"
              />
            </form>
          </header>

          <div className="pointer-events-none absolute bottom-4 left-3 right-3 z-10 sm:left-4 sm:right-auto sm:w-[360px] lg:hidden">
            {selectedListing && (
              <article className="pointer-events-auto rounded-lg border border-white/80 bg-white/95 p-4 shadow-xl shadow-black/15 backdrop-blur">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h1 className="text-lg font-semibold tracking-normal">{selectedListing.title}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">{selectedListing.area}</p>
                  </div>
                  <p className="shrink-0 font-semibold">{selectedListing.fullPrice}</p>
                </div>
                <ListingFacts listing={selectedListing} />
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button className="h-10" variant="outline">
                    <MessageSquare className="size-4" />
                    Message
                  </Button>
                  <ApplicationModal listingId={selectedListing.id} />
                </div>
              </article>
            )}
          </div>
        </section>

        <aside className="hidden min-h-0 flex-col bg-background lg:flex">
          {detailListing ? (
            <ListingDetailPanel
              listing={detailListing}
              onBack={() => setDetailListing(null)}
            />
          ) : (
            <>
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
                  <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                    <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
                    <div>
                      <p className="text-sm font-medium text-destructive">Could not load listings</p>
                      <p className="mt-1 text-xs text-destructive/80">Try panning the map or refreshing the page.</p>
                    </div>
                  </div>
                ) : null}

                {isLoadingListings && visibleListings.length === 0 ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse rounded-lg border border-border bg-card p-4">
                        <div className="flex justify-between gap-3">
                          <div className="space-y-2 flex-1">
                            <div className="h-4 w-3/4 rounded bg-muted" />
                            <div className="h-3 w-1/2 rounded bg-muted/70" />
                          </div>
                          <div className="h-4 w-16 rounded bg-muted" />
                        </div>
                        <div className="mt-4 flex gap-4">
                          <div className="h-3 w-12 rounded bg-muted/60" />
                          <div className="h-3 w-12 rounded bg-muted/60" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {visibleListings.length === 0 && !isLoadingListings && !listingError ? (
                  <div className="flex flex-col items-center py-12 text-center">
                    <div className="flex size-14 items-center justify-center rounded-full bg-muted/50">
                      <MapPin className="size-6 text-muted-foreground/50" />
                    </div>
                    <h3 className="mt-4 text-sm font-semibold text-foreground">No listings in this area</h3>
                    <p className="mt-1 max-w-[240px] text-xs text-muted-foreground">
                      Try zooming out or searching a different location to discover available rentals.
                    </p>
                  </div>
                ) : null}

                {visibleListings.map((listing) => (
                  <button
                    className={cn(
                      "w-full rounded-lg border bg-card p-4 text-left shadow-sm transition hover:border-[#2b6357]/60 hover:bg-muted/40",
                      selectedListingId === listing.id ? "border-[#2b6357] ring-2 ring-[#2b6357]/15" : "border-border",
                    )}
                    key={listing.id}
                    onClick={() => handleViewDetail(listing.id)}
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

              {selectedListing && (
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
                    <ApplicationModal listingId={selectedListing.id} />
                  </div>
                </div>
              )}
            </>
          )}
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
