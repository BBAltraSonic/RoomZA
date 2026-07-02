import type { Metadata } from "next";
import { Map as MapIcon, Search } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { EmptyState, PageHeader } from "@/components/premium/primitives";
import { PropertyCard } from "@/components/premium/property-card";
import { LoadingSkeleton } from "@/components/ui/route-state";
import { getPublishedListingCards } from "@/features/listings/api";

export const metadata: Metadata = {
  title: "Browse Listings",
  description:
    "Browse all published rental listings on RoomZA in a simple list view, or switch to the interactive map.",
};

export default async function ListingsPage() {
  return (
    <main
      className="min-h-dvh bg-background px-4 pb-[calc(var(--mobile-bottom-nav-h)+var(--mobile-safe-bottom)+1rem)] text-foreground sm:px-6 sm:pb-28 sm:pt-20 lg:px-8"
      style={{ paddingTop: "max(env(safe-area-inset-top), 1.25rem)" }}
    >
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="Browse"
          title="All listings"
          description="Every published home in a simple list. Prefer the map?"
          action={
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-panel px-4 text-sm font-medium text-ink hover:bg-warm-surface"
            >
              <MapIcon className="size-4" />
              View map
            </Link>
          }
        />

        <Suspense fallback={<LoadingSkeleton title="Loading listings" rows={8} />}>
          <ListingsGrid />
        </Suspense>
      </div>
    </main>
  );
}

async function ListingsGrid() {
  const result = await getPublishedListingCards();
  const rows = "error" in result ? [] : result.listings;

  return (
    <>
      {"error" in result ? (
        <div className="rounded-lg border border-status-error-border bg-status-error-surface p-4 text-sm font-medium text-status-error-text">
          Unable to load listings.
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No listings available yet"
          description="There are no published homes right now. Check back soon or explore the map."
          action={
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-forest px-4 text-sm font-medium text-primary-foreground hover:bg-forest/90"
            >
              <MapIcon className="size-4" />
              Explore the map
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((listing) => (
            <PropertyCard
              key={listing.id}
              href={`/?listingId=${listing.id}`}
              property={{
                id: listing.id,
                title: listing.title,
                address: listing.address,
                price: listing.price,
                bedrooms: listing.bedrooms,
                bathrooms: listing.bathrooms,
                imageUrl: listing.imageUrl,
                availabilityDate: listing.availabilityDate,
                createdAt: listing.createdAt,
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
