import { Heart, Search } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { MobileBackButton } from "@/components/navigation/mobile-back-button";
import { EmptyState, PageHeader } from "@/components/premium/primitives";
import { authPathForRedirect } from "@/lib/redirects";
import { createClient } from "@/lib/supabase/server";

import { SavedGrid } from "./saved-grid";

export const metadata = {
  title: "Saved Properties",
};

type ListingRecord = {
  id: string;
  title: string;
  address: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  listing_images?: { public_url: string; sort_order: number }[] | null;
};

type FavoriteRow = {
  listing_id: string;
  created_at: string;
  listings: ListingRecord | ListingRecord[] | null;
};

type FavoriteQueryClient = {
  from: (table: "user_favorites") => {
    select: (columns: string) => {
      eq: (column: "user_id", value: string) => {
        order: (column: "created_at", options: { ascending: boolean }) => Promise<{
          data: FavoriteRow[] | null;
          error: unknown;
        }>;
      };
    };
  };
};

function getListing(row: FavoriteRow) {
  return Array.isArray(row.listings) ? row.listings[0] : row.listings;
}

function getImageUrl(listing: ListingRecord) {
  return [...(listing.listing_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0]?.public_url ?? null;
}

export default async function SavedPropertiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const favoriteClient = supabase as unknown as FavoriteQueryClient;

  if (!user) {
    redirect(authPathForRedirect("/saved"));
  }

  const { data: favorites, error } = await favoriteClient
    .from("user_favorites")
    .select(`
      listing_id,
      created_at,
      listings (
        id,
        title,
        address,
        price,
        bedrooms,
        bathrooms,
        listing_images (public_url, sort_order)
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main
      className="min-h-dvh bg-background px-4 pb-[calc(var(--mobile-bottom-nav-h)+var(--mobile-safe-bottom)+1rem)] text-foreground sm:px-6 sm:pb-28 sm:pt-20 lg:px-8"
      style={{ paddingTop: "max(env(safe-area-inset-top), 1.25rem)" }}
    >
      <MobileBackButton fallbackHref="/" />
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="Renter workspace"
          title="Saved homes"
          description="Homes you marked for comparison before applying."
        />

        {error ? (
          <div className="rounded-lg border border-status-error-border bg-status-error-surface p-4 text-sm font-medium text-status-error-text">
            Unable to load saved homes.
          </div>
        ) : !favorites || favorites.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="No saved homes yet"
            description="Save homes from the map to keep a focused shortlist here."
            action={
              <Link
                href="/"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-forest px-4 text-sm font-medium text-primary-foreground hover:bg-forest/90"
              >
                <Search className="size-4" />
                Explore homes
              </Link>
            }
          />
        ) : (
          <SavedGrid
            items={favorites
              .map((favorite) => {
                const listing = getListing(favorite);
                if (!listing) return null;
                return {
                  listingId: favorite.listing_id,
                  href: `/?listingId=${listing.id}`,
                  property: {
                    id: listing.id,
                    title: listing.title,
                    address: listing.address,
                    price: listing.price,
                    bedrooms: listing.bedrooms,
                    bathrooms: listing.bathrooms,
                    imageUrl: getImageUrl(listing),
                  },
                };
              })
              .filter((item): item is NonNullable<typeof item> => item !== null)}
          />
        )}
      </div>
    </main>
  );
}
