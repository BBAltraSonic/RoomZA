import { createClient } from "@/lib/supabase/server";

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

function getListing(row: FavoriteRow) {
  return Array.isArray(row.listings) ? row.listings[0] : row.listings;
}

function getImageUrl(listing: ListingRecord) {
  return [...(listing.listing_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0]?.public_url ?? null;
}

export async function getSavedListingCards() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { authenticated: false } as const;
  }

  const { data: favorites, error } = await supabase
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

  if (error) {
    return { authenticated: true, error } as const;
  }

  const items = ((favorites ?? []) as FavoriteRow[])
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
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return { authenticated: true, items } as const;
}
