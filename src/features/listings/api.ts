import { createClient } from "@/lib/supabase/server";

const bboxPartCount = 4;
const maxLatitude = 90;
const maxLongitude = 180;
const viewportFallbackLimit = 250;

type ListingRpcRow = {
  id: string;
  title: string;
  address: string;
  price: number;
  sale_price?: number | null;
  display_price?: number | null;
  listing_type?: "rent" | "sale" | null;
  latitude: number | string;
  longitude: number | string;
  bedrooms: number | string;
  bathrooms: number | string;
  parking_count?: number | string | null;
  image_urls?: string[] | null;
  thumbnail_url?: string | null;
  availability_date?: string | null;
  property_type?: string | null;
  created_at?: string | null;
  landlord_id?: string | null;
  landlord_name?: string | null;
  landlord_avatar_url?: string | null;
  landlord_phone_verified?: boolean;
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
  sale_price?: number | null;
  listing_type?: "rent" | "sale" | null;
  bedrooms: number;
  bathrooms: number;
  parking_count?: number | null;
  created_at: string | null;
  availability_date: string | null;
  listing_images?: ListingImage[] | null;
  landlord?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    phone_verified: boolean;
  } | null;
};

type ListingFallbackRow = PublishedListingRow & {
  latitude: number | string;
  longitude: number | string;
  property_type?: string | null;
};

type ListingMode = "rent" | "buy";

function listingTypeForMode(mode: ListingMode | undefined): "rent" | "sale" {
  return mode === "buy" ? "sale" : "rent";
}

function displayPriceForListing(listing: Pick<ListingRpcRow | ListingFallbackRow, "price" | "sale_price" | "listing_type">) {
  return listing.listing_type === "sale" ? listing.sale_price ?? listing.price : listing.price;
}

function getImageUrl(listing: PublishedListingRow) {
  return [...(listing.listing_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0]?.public_url ?? null;
}

function mapListingRow(listing: ListingRpcRow | ListingFallbackRow) {
  const imageUrls =
    "image_urls" in listing && listing.image_urls
      ? listing.image_urls
      : "thumbnail_url" in listing && listing.thumbnail_url
        ? [listing.thumbnail_url]
        : "listing_images" in listing
          ? [getImageUrl(listing)].filter((url): url is string => Boolean(url))
          : [];

  const landlord =
    "landlord" in listing && listing.landlord
      ? listing.landlord
      : null;

  return {
    id: listing.id,
    title: listing.title,
    area: listing.address,
    price: listing.price,
    salePrice: "sale_price" in listing ? listing.sale_price ?? null : null,
    displayPrice: displayPriceForListing(listing),
    listingType: "listing_type" in listing ? listing.listing_type ?? "rent" : "rent",
    latitude: Number(listing.latitude),
    longitude: Number(listing.longitude),
    bedrooms: Number(listing.bedrooms),
    bathrooms: Number(listing.bathrooms),
    parkingCount: "parking_count" in listing ? Number(listing.parking_count ?? 0) : 0,
    imageUrls,
    availabilityDate: "availability_date" in listing ? listing.availability_date ?? null : null,
    propertyType: "property_type" in listing ? listing.property_type ?? null : null,
    created_at: listing.created_at ?? null,
    agent:
      "landlord_id" in listing && listing.landlord_id
        ? {
            id: listing.landlord_id,
            name: listing.landlord_name || "Landlord",
            avatarUrl: listing.landlord_avatar_url || undefined,
            isVerified: listing.landlord_phone_verified,
          }
        : landlord
          ? {
              id: landlord.id,
              name: landlord.full_name || "Landlord",
              avatarUrl: landlord.avatar_url || undefined,
              isVerified: landlord.phone_verified,
            }
          : null,
  };
}

export function parseBbox(value: string | null) {
  if (!value) {
    return { error: "Missing bbox query parameter." } as const;
  }

  const parts = value.split(",").map((part) => Number(part.trim()));

  if (parts.length !== bboxPartCount || parts.some((part) => !Number.isFinite(part))) {
    return { error: "bbox must be four comma-separated numbers: west,south,east,north." } as const;
  }

  const [west, south, east, north] = parts;

  if (west === undefined || south === undefined || east === undefined || north === undefined) {
    return { error: "bbox must be four comma-separated numbers: west,south,east,north." } as const;
  }

  if (Math.abs(west) > maxLongitude || Math.abs(east) > maxLongitude) {
    return { error: "bbox longitude values must be between -180 and 180." } as const;
  }

  if (Math.abs(south) > maxLatitude || Math.abs(north) > maxLatitude) {
    return { error: "bbox latitude values must be between -90 and 90." } as const;
  }

  return { bbox: { west, south, east, north } } as const;
}

export type ListingViewportFilters = {
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  beds?: number;
  baths?: number;
  type?: string;
  mode?: ListingMode;
};

function finiteNumber(value: number | undefined) {
  return value !== undefined && !Number.isNaN(value) ? value : undefined;
}

type SupabaseErrorLike = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

function isMissingSpatialIndexError(error: SupabaseErrorLike) {
  const combined = [error.code, error.message, error.details, error.hint].filter(Boolean).join(" ");
  return /listings_location_gix|missing[_ -]?spatial[_ -]?index|spatial index/i.test(combined);
}

function applyFallbackFilters(listing: ListingFallbackRow, filters: ListingViewportFilters) {
  const minPrice = finiteNumber(filters.minPrice);
  const maxPrice = finiteNumber(filters.maxPrice);
  const minBeds = finiteNumber(filters.beds);
  const minBaths = finiteNumber(filters.baths);
  const displayPrice = displayPriceForListing(listing);

  return (
    (listing.listing_type ?? "rent") === listingTypeForMode(filters.mode) &&
    (minPrice === undefined || displayPrice >= minPrice) &&
    (maxPrice === undefined || displayPrice <= maxPrice) &&
    (minBeds === undefined || Number(listing.bedrooms) >= minBeds) &&
    (minBaths === undefined || Number(listing.bathrooms) >= minBaths) &&
    (!filters.type || listing.property_type === filters.type)
  );
}

async function getListingsInViewportFallback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bbox: { west: number; south: number; east: number; north: number },
  filters: ListingViewportFilters,
) {
  const { data, error } = await supabase
    .from("listings")
    .select(
      `
      id,
      title,
      address,
      price,
      sale_price,
      listing_type,
      latitude,
      longitude,
      bedrooms,
      bathrooms,
      parking_count,
      created_at,
      availability_date,
      property_type,
      landlord:profiles!landlord_id(id, full_name, avatar_url, phone_verified),
      listing_images (public_url, sort_order)
    `,
    )
    .eq("status", "published")
    .eq("listing_type", listingTypeForMode(filters.mode))
    .gte("longitude", Math.min(bbox.west, bbox.east))
    .lte("longitude", Math.max(bbox.west, bbox.east))
    .gte("latitude", Math.min(bbox.south, bbox.north))
    .lte("latitude", Math.max(bbox.south, bbox.north))
    .order("created_at", { ascending: false });

  if (error) {
    return { error } as const;
  }

  const listings = ((data ?? []) as ListingFallbackRow[])
    .filter((listing) => applyFallbackFilters(listing, filters))
    .slice(0, viewportFallbackLimit)
    .map(mapListingRow);

  return { listings, missingSpatialIndex: true } as const;
}

export async function getListingsInViewport(
  bbox: { west: number; south: number; east: number; north: number },
  filters: ListingViewportFilters,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_published_listings_in_bbox_with_query", {
    ...bbox,
    // Discovery search is geographic. Place selection moves the map, and the
    // visible bounds determine inventory; a display label must not filter rows.
    search_query: undefined,
    min_price: finiteNumber(filters.minPrice),
    max_price: finiteNumber(filters.maxPrice),
    min_beds: finiteNumber(filters.beds),
    min_baths: finiteNumber(filters.baths),
    property_type_filter: filters.type,
    // The linked database retains the prior ten-argument RPC while the
    // buy/sell migration adds an eleven-argument version. Always provide this
    // final argument so PostgREST resolves the new function deterministically,
    // including for the default rent experience.
    listing_type_filter: listingTypeForMode(filters.mode),
  });

  if (error) {
    if (isMissingSpatialIndexError(error)) {
      return getListingsInViewportFallback(supabase, bbox, filters);
    }

    return { error } as const;
  }

  const listings = (data as ListingRpcRow[]).map(mapListingRow);

  return { listings } as const;
}

export async function getPublishedListingApiPayload(id: string, mode?: ListingMode) {
  const supabase = await createClient();

  let query = supabase
    .from("listings")
    .select("*")
    .eq("id", id)
    .eq("status", "published");

  if (mode) {
    query = query.eq("listing_type", listingTypeForMode(mode));
  }

  const { data: listing, error } = await query.single();

  if (error || !listing) {
    return { error: "not_found" } as const;
  }

  const { data: images } = await supabase
    .from("listing_images")
    .select("id, public_url, sort_order")
    .eq("listing_id", id)
    .order("sort_order", { ascending: true });

  return {
    listing: {
      id: listing.id,
      title: listing.title,
      address: listing.address,
      price: listing.price,
      sale_price: listing.sale_price,
      display_price: displayPriceForListing(listing),
      listing_type: listing.listing_type ?? "rent",
      latitude: Number(listing.latitude),
      longitude: Number(listing.longitude),
      bedrooms: Number(listing.bedrooms),
      bathrooms: Number(listing.bathrooms),
      parking_type: listing.parking_type,
      parking_count: listing.parking_count,
      electricity_type: listing.electricity_type,
      water_availability: listing.water_availability,
      property_type: listing.property_type,
      electricity_included: listing.electricity_included,
      electricity_estimate: listing.electricity_estimate,
      water_included: listing.water_included,
      water_estimate: listing.water_estimate,
      wifi_available: listing.wifi_available,
      wifi_included: listing.wifi_included,
      wifi_estimate: listing.wifi_estimate,
      parking_included: listing.parking_included,
      parking_estimate: listing.parking_estimate,
      security_fee_estimate: listing.security_fee_estimate,
      lease_duration: listing.lease_duration,
      availability_date: listing.availability_date,
      created_at: listing.created_at,
      metadata: listing.metadata,
      images: images ?? [],
    },
    imagesLoaded: images !== null,
  } as const;
}

export async function getPublishedListingSitemapRows() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("id, updated_at")
    .eq("status", "published")
    .order("updated_at", { ascending: false });

  return data ?? [];
}

export async function getPublishedListingCards(mode: ListingMode = "rent") {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select(
      `
      id,
      title,
      address,
      price,
      sale_price,
      listing_type,
      bedrooms,
      bathrooms,
      parking_count,
      created_at,
      availability_date,
      landlord:profiles!landlord_id(id, full_name, avatar_url, phone_verified),
      listing_images (public_url, sort_order)
    `,
    )
    .eq("status", "published")
    .eq("listing_type", listingTypeForMode(mode))
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) {
    return { error } as const;
  }

  const listings = ((data ?? []) as PublishedListingRow[]).map((listing) => ({
    id: listing.id,
    title: listing.title,
    address: listing.address,
    price: listing.price,
    salePrice: listing.sale_price ?? null,
    displayPrice: displayPriceForListing(listing),
    listingType: listing.listing_type ?? "rent",
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    parkingCount: listing.parking_count ?? 0,
    imageUrl: getImageUrl(listing),
    availabilityDate: listing.availability_date,
    createdAt: listing.created_at,
    agent: listing.landlord ? {
      id: listing.landlord.id,
      name: listing.landlord.full_name || "Landlord",
      avatarUrl: listing.landlord.avatar_url || undefined,
      isVerified: listing.landlord.phone_verified,
    } : null,
  }));

  return { listings } as const;
}
