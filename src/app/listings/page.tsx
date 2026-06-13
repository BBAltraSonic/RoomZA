import type { Metadata } from "next";
import { Map as MapIcon, Search } from "lucide-react";
import Link from "next/link";

import { EmptyState, PageHeader } from "@/components/premium/primitives";
import { PropertyCard } from "@/components/premium/property-card";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Browse Listings",
  description:
    "Browse all published rental listings on RoomZA in a simple list view, or switch to the interactive map.",
};

type ListingImage = {
  public_url: string;
  sort_order: number;
};

type PublishedListingRow = {
  id: string;
  title: string;
  address: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  created_at: string | null;
  availability_date: string | null;
  listing_images?: ListingImage[] | null;
};

function getImageUrl(listing: PublishedListingRow) {
  return (
    [...(listing.listing_images ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)[0]?.public_url ?? null
  );
}

export default async function ListingsPage() {
  const supabase = await createClient();

  const { data: listings, error } = await supabase
    .from("listings")
    .select(
      `
      id,
      title,
      address,
      price,
      bedrooms,
      bathrooms,
      created_at,
      availability_date,
      listing_images (public_url, sort_order)
    `,
    )
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(60);

  const rows = (listings ?? []) as PublishedListingRow[];

  return (
    <main
      className="min-h-screen bg-background px-4 pb-[calc(var(--mobile-bottom-nav-h)+var(--mobile-safe-bottom)+1rem)] text-foreground sm:px-6 sm:pb-28 sm:pt-20 lg:px-8"
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

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">
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
                  imageUrl: getImageUrl(listing),
                  availabilityDate: listing.availability_date,
                  createdAt: listing.created_at,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
