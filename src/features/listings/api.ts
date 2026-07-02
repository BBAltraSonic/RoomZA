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
  latitude: number | string;
  longitude: number | string;
  bedrooms: number | string;
  bathrooms: number | string;
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
  bedrooms: number;
  bathrooms: number;
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
    latitude: Number(listing.latitude),
    longitude: Number(listing.longitude),
    bedrooms: Number(listing.bedrooms),
    bathrooms: Number(listing.bathrooms),
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

function matchesSearch(listing: ListingFallbackRow, query: string | undefined) {
  if (!query) return true;
  const normalized = query.toLowerCase();
  return (
    listing.id.toLowerCase() === normalized ||
    listing.title.toLowerCase().includes(normalized) ||
    listing.address.toLowerCase().includes(normalized)
  );
}

function applyFallbackFilters(listing: ListingFallbackRow, filters: ListingViewportFilters) {
  const minPrice = finiteNumber(filters.minPrice);
  const maxPrice = finiteNumber(filters.maxPrice);
  const minBeds = finiteNumber(filters.beds);
  const minBaths = finiteNumber(filters.baths);

  return (
    matchesSearch(listing, filters.q) &&
    (minPrice === undefined || listing.price >= minPrice) &&
    (maxPrice === undefined || listing.price <= maxPrice) &&
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
      latitude,
      longitude,
      bedrooms,
      bathrooms,
      created_at,
      availability_date,
      property_type,
      landlord:profiles!landlord_id(id, full_name, avatar_url, phone_verified),
      listing_images (public_url, sort_order)
    `,
    )
    .eq("status", "published")
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
    search_query: filters.q,
    min_price: finiteNumber(filters.minPrice),
    max_price: finiteNumber(filters.maxPrice),
    min_beds: finiteNumber(filters.beds),
    min_baths: finiteNumber(filters.baths),
    property_type_filter: filters.type,
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

export async function getPublishedListingApiPayload(id: string) {
  const supabase = await createClient();

  const { data: listing, error } = await supabase
    .from("listings")
    .select("*")
    .eq("id", id)
    .eq("status", "published")
    .single();

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

export async function getPublishedListingCards() {
  const supabase = await createClient();
  const { data, error } = await supabase
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
      landlord:profiles!landlord_id(id, full_name, avatar_url, phone_verified),
      listing_images (public_url, sort_order)
    `,
    )
    .eq("status", "published")
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
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
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
