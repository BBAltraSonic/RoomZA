import { createClient } from "@/lib/supabase/server";
import {
  predictResponseTimeSeconds,
  type LandlordTrustSummary,
} from "@/features/trust/landlord-signals";
import type { PresenceBadge } from "@/features/presence/presence-status";
import type { ListingLiveActivity } from "@/features/map-discovery/live-activity";
import type { UpcomingLiveTour } from "@/features/live-tours/types";
import { normalizeListingSearchQuery } from "./search-query";

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
  nsfas_approved?: boolean | null;
  furnished?: boolean | null;
  landlord_id?: string | null;
  landlord_name?: string | null;
  landlord_avatar_url?: string | null;
  landlord_phone_verified?: boolean;
  landlord_email_verified?: boolean;
  landlord_median_first_response_seconds?: number | null;
  landlord_presence_status?: string | null;
  landlord_predicted_response_seconds?: number | null;
  listing_reviewed_at?: string | null;
  live_tour_id?: string | null;
  has_live_tour?: boolean | null;
  has_instant_viewing?: boolean | null;
  viewed_today?: number | null;
  viewing_now?: number | null;
  last_scheduled_at?: string | null;
  last_rented_at?: string | null;
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
  metadata?: {
    amenities?: { essentials?: string[] };
  } | null;
  listing_accreditations?: { nsfas_approved: boolean }[] | null;
  landlord?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    phone_verified: boolean;
    email_verified_at: string | null;
    presence_status?: string | null;
  } | null;
};

type ListingFallbackRow = PublishedListingRow & {
  latitude: number | string;
  longitude: number | string;
  property_type?: string | null;
};

type ListingMode = "rent" | "buy";

type PublicListingTrustSignal = {
  listing_id: string;
  public_label: string | null;
  verified_at: string;
  expires_at: string | null;
};

type LandlordTrustMetricRow = {
  landlord_id: string;
  median_first_response_seconds: number | null;
};

export type PublicLandlordPresence = {
  badge: PresenceBadge;
  name: string;
};

function toPresenceBadge(value: unknown): PresenceBadge {
  return value === "available" || value === "busy" ? value : "offline";
}

async function getPublicLandlordPresence(
  supabase: Awaited<ReturnType<typeof createClient>>,
  landlordId: string,
): Promise<PublicLandlordPresence> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, presence_status")
    .eq("id", landlordId)
    .maybeSingle();

  if (!profile) return { badge: "offline", name: "Landlord" };

  const badge = toPresenceBadge(profile.presence_status);

  return {
    // The scheduled sweep makes this denormalised value authoritative. Never
    // expose the raw heartbeat timestamp to another user.
    badge,
    name: profile.full_name?.trim() || "Landlord",
  };
}

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
  const nsfasApproved = "nsfas_approved" in listing
    ? Boolean(listing.nsfas_approved)
    : "listing_accreditations" in listing
      ? Boolean(listing.listing_accreditations?.some((accreditation) => accreditation.nsfas_approved))
      : false;
  const furnished = "furnished" in listing
    ? Boolean(listing.furnished)
    : "metadata" in listing
      ? Boolean(listing.metadata?.amenities?.essentials?.includes("furnished"))
      : false;
  const landlordTrust: LandlordTrustSummary | null =
    "landlord_id" in listing && listing.landlord_id
      ? {
          medianFirstResponseSeconds: listing.landlord_median_first_response_seconds ?? null,
          predictedResponseSeconds:
            listing.landlord_predicted_response_seconds ?? null,
          phoneVerified: Boolean(listing.landlord_phone_verified),
          emailVerified: Boolean(listing.landlord_email_verified),
        }
      : landlord
        ? {
            medianFirstResponseSeconds: null,
            phoneVerified: landlord.phone_verified,
            emailVerified: Boolean(landlord.email_verified_at),
          }
        : null;
  const rawPresence =
    "landlord_presence_status" in listing
      ? listing.landlord_presence_status
      : landlord?.presence_status;
  const landlordPresence = toPresenceBadge(rawPresence);
  const liveActivity: ListingLiveActivity = {
    viewedToday:
      "viewed_today" in listing ? Number(listing.viewed_today ?? 0) : 0,
    viewingNow:
      "viewing_now" in listing ? Number(listing.viewing_now ?? 0) : 0,
    lastScheduledAt:
      "last_scheduled_at" in listing ? listing.last_scheduled_at ?? null : null,
    lastRentedAt:
      "last_rented_at" in listing ? listing.last_rented_at ?? null : null,
  };

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
    nsfasApproved,
    listingReviewedAt: "listing_reviewed_at" in listing ? listing.listing_reviewed_at ?? null : null,
    furnished,
    landlordTrust,
    landlordPresence,
    liveTourId:
      "live_tour_id" in listing ? listing.live_tour_id ?? null : null,
    hasInstantViewing:
      "has_instant_viewing" in listing
        ? Boolean(listing.has_instant_viewing)
        : false,
    liveActivity,
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

async function attachLandlordTrustMetrics<T extends {
  landlordTrust: LandlordTrustSummary | null;
  landlordPresence?: PresenceBadge;
  agent?: { id?: string } | null;
}>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  listings: T[],
) {
  const landlordIds = [...new Set(listings.map((listing) => listing.agent?.id).filter((id): id is string => Boolean(id)))];
  if (!landlordIds.length) return listings;

  const { data } = await supabase
    .from("landlord_trust_metrics")
    .select("landlord_id, median_first_response_seconds")
    .in("landlord_id", landlordIds);
  const metrics = new Map(((data ?? []) as LandlordTrustMetricRow[]).map((row) => [row.landlord_id, row.median_first_response_seconds]));

  return listings.map((listing) => {
    const landlordId = listing.agent?.id;
    if (!landlordId || !listing.landlordTrust) return listing;
    return {
      ...listing,
      landlordTrust: {
        ...listing.landlordTrust,
        medianFirstResponseSeconds: metrics.get(landlordId) ?? null,
        predictedResponseSeconds: listing.landlordPresence
          ? predictResponseTimeSeconds({
              medianFirstResponseSeconds: metrics.get(landlordId) ?? null,
              presence: listing.landlordPresence,
            })
          : listing.landlordTrust.predictedResponseSeconds,
      },
    };
  });
}

export async function getLandlordTrustSummary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  landlordId: string,
): Promise<LandlordTrustSummary> {
  const [{ data: profile }, { data: metric }] = await Promise.all([
    supabase.from("profiles").select("phone_verified, email_verified_at").eq("id", landlordId).maybeSingle(),
    supabase.from("landlord_trust_metrics").select("median_first_response_seconds").eq("landlord_id", landlordId).maybeSingle(),
  ]);
  return {
    medianFirstResponseSeconds: metric?.median_first_response_seconds ?? null,
    phoneVerified: Boolean(profile?.phone_verified),
    emailVerified: Boolean(profile?.email_verified_at),
  };
}

async function attachListingReviewSignals<T extends { id: string }>(supabase: Awaited<ReturnType<typeof createClient>>, listings: T[]) {
  if (!listings.length) return listings.map((listing) => ({ ...listing, listingReviewedAt: null as string | null }));
  const { data } = await supabase.rpc("get_public_listing_trust_signals", { target_listing_ids: listings.map((listing) => listing.id) });
  const verifiedAt = new Map(((data ?? []) as PublicListingTrustSignal[]).map((signal) => [signal.listing_id, signal.verified_at]));
  return listings.map((listing) => ({ ...listing, listingReviewedAt: verifiedAt.get(listing.id) ?? null }));
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
  availableNow?: boolean;
  liveTours?: boolean;
  instantViewings?: boolean;
  repliesUnder5?: boolean;
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
  const searchQuery = normalizeListingSearchQuery(filters.q).toLocaleLowerCase("en-ZA");
  const searchableText = `${listing.title} ${listing.address}`.toLocaleLowerCase("en-ZA");

  return (
    (listing.listing_type ?? "rent") === listingTypeForMode(filters.mode) &&
    (!searchQuery || searchableText.includes(searchQuery)) &&
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
      metadata,
      listing_accreditations (nsfas_approved),
      landlord:profiles!landlord_id(id, full_name, avatar_url, phone_verified, email_verified_at, presence_status),
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

  const mappedListings = ((data ?? []) as ListingFallbackRow[])
    .filter((listing) => applyFallbackFilters(listing, filters))
    .slice(0, viewportFallbackLimit)
    .map(mapListingRow);

  const withReviewSignals = await attachListingReviewSignals(supabase, mappedListings);
  const listings = await attachLandlordTrustMetrics(supabase, withReviewSignals);
  return {
    listings: listings.filter((listing) => {
      const predicted = listing.landlordTrust
        ? predictResponseTimeSeconds({
            medianFirstResponseSeconds:
              listing.landlordTrust.medianFirstResponseSeconds,
            presence: listing.landlordPresence,
          })
        : null;
      return (
        (!filters.availableNow || listing.landlordPresence === "available")
        && (!filters.liveTours || Boolean(listing.liveTourId))
        && (!filters.instantViewings || listing.hasInstantViewing)
        && (!filters.repliesUnder5
          || (predicted !== null && predicted <= 300))
      );
    }),
    missingSpatialIndex: true,
  } as const;
}

export async function getListingsInViewport(
  bbox: { west: number; south: number; east: number; north: number },
  filters: ListingViewportFilters,
) {
  const supabase = await createClient();
  const searchQuery = normalizeListingSearchQuery(filters.q);
  const { data, error } = await supabase.rpc("get_published_listings_in_bbox_with_query", {
    ...bbox,
    search_query: searchQuery || undefined,
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
    available_now_filter: Boolean(filters.availableNow),
    live_tours_filter: Boolean(filters.liveTours),
    instant_viewings_filter: Boolean(filters.instantViewings),
    replies_under_5_filter: Boolean(filters.repliesUnder5),
  });

  if (error) {
    if (isMissingSpatialIndexError(error)) {
      return getListingsInViewportFallback(supabase, bbox, {
        ...filters,
        q: searchQuery || undefined,
      });
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

  const [
    { data: images },
    reviewSignals,
    landlordTrust,
    landlordPresence,
    { data: activeTours },
    { data: upcomingTours },
    { data: liveActivityRows },
  ] = await Promise.all([
    supabase.from("listing_images").select("id, public_url, sort_order").eq("listing_id", id).order("sort_order", { ascending: true }),
    attachListingReviewSignals(supabase, [{ id }]),
    getLandlordTrustSummary(supabase, listing.landlord_id),
    getPublicLandlordPresence(supabase, listing.landlord_id),
    supabase.rpc("get_active_public_live_tour", { target_listing_id: id }),
    supabase.rpc("get_upcoming_public_live_tour", {
      target_listing_id: id,
    }),
    supabase.rpc("get_public_listing_live_activity", {
      target_listing_id: id,
    }),
  ]);
  const predictedResponseSeconds = predictResponseTimeSeconds({
    medianFirstResponseSeconds: landlordTrust.medianFirstResponseSeconds,
    presence: landlordPresence.badge,
  });

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
      listing_reviewed_at: reviewSignals[0]?.listingReviewedAt ?? null,
      landlordTrust: { ...landlordTrust, predictedResponseSeconds },
      landlordPresence,
      liveTourId: activeTours?.[0]?.tour_id ?? null,
      upcomingLiveTour: upcomingTours?.[0]
        ? {
            tourId: upcomingTours[0].tour_id,
            listingId: upcomingTours[0].listing_id,
            scheduledAt: upcomingTours[0].scheduled_at,
            durationMinutes: upcomingTours[0].duration_minutes,
          }
        : null,
      liveActivity: liveActivityRows?.[0]
        ? {
            viewedToday: Number(liveActivityRows[0].viewed_today ?? 0),
            viewingNow: Number(liveActivityRows[0].viewing_now ?? 0),
            lastScheduledAt:
              liveActivityRows[0].last_scheduled_at ?? null,
            lastRentedAt: liveActivityRows[0].last_rented_at ?? null,
          }
        : {
            viewedToday: 0,
            viewingNow: 0,
            lastScheduledAt: null,
            lastRentedAt: null,
          },
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
      landlord:profiles!landlord_id(id, full_name, avatar_url, phone_verified, email_verified_at, presence_status),
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

  const listingsWithReviewSignals = await attachListingReviewSignals(supabase, ((data ?? []) as PublishedListingRow[]).map((listing) => ({
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
    landlordTrust: listing.landlord ? {
      medianFirstResponseSeconds: null,
      phoneVerified: listing.landlord.phone_verified,
      emailVerified: Boolean(listing.landlord.email_verified_at),
    } : null,
    landlordPresence: toPresenceBadge(listing.landlord?.presence_status),
    agent: listing.landlord ? {
      id: listing.landlord.id,
      name: listing.landlord.full_name || "Landlord",
      avatarUrl: listing.landlord.avatar_url || undefined,
      isVerified: listing.landlord.phone_verified,
    } : null,
  })));

  const listings = await attachLandlordTrustMetrics(supabase, listingsWithReviewSignals);
  const [{ data: activeTours }, { data: upcomingTours }] = listings.length
    ? await Promise.all([
        supabase.rpc("get_active_public_live_tours", {
          target_listing_ids: listings.map((listing) => listing.id),
        }),
        supabase.rpc("get_upcoming_public_live_tours", {
          target_listing_ids: listings.map((listing) => listing.id),
        }),
      ])
    : [{ data: [] }, { data: [] }];
  const tourByListing = new Map(
    (activeTours ?? []).map((tour) => [tour.listing_id, tour.tour_id]),
  );
  const upcomingTourByListing = new Map(
    (upcomingTours ?? []).map((tour) => [
      tour.listing_id,
      {
        tourId: tour.tour_id,
        listingId: tour.listing_id,
        scheduledAt: tour.scheduled_at,
        durationMinutes: tour.duration_minutes,
      } satisfies UpcomingLiveTour,
    ]),
  );

  return {
    listings: listings.map((listing) => ({
      ...listing,
      liveTourId: tourByListing.get(listing.id) ?? null,
      upcomingLiveTour: upcomingTourByListing.get(listing.id) ?? null,
    })),
  } as const;
}
