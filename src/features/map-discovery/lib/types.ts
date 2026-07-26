// Shared types for the Mobile_Map_Discovery feature.
// See .kiro/specs/mobile-map-discovery/design.md (Data Models).

import type { LandlordTrustSummary } from "@/features/trust/landlord-signals";
import type { PresenceBadge } from "@/features/presence/presence-status";
import type { ListingLiveActivity } from "../live-activity";

/** Geographic origin used to compute distance. */
export type GeoPoint = {
  lat: number;
  lng: number;
};

/** Geographic rectangle of the visible map area, in decimal degrees. */
export type ViewportBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type DiscoverySelection = {
  selectedListingId?: string;
  previewedListingId?: string;
};

export type DiscoveryViewportQuery = {
  bounds: ViewportBounds;
  listingMode: "rent" | "buy";
  minPrice?: number;
  maxPrice?: number;
  beds?: number;
  baths?: number;
  propertyType?: string;
};

export const QUICK_FILTER_KEYS = [
  "all",
  "nsfas-approved",
  "favourites",
  "recently-listed",
  "recently-viewed",
  "furnished",
] as const;

export type QuickFilterKey = (typeof QUICK_FILTER_KEYS)[number];

/** View model consumed by ListingCard / ListingCarousel. */
export type ListingCardModel = {
  id: string;
  title: string;
  area?: string | null;
  imageUrls: string[];
  price: number;
  salePrice?: number | null;
  displayPrice?: number | null;
  listingType?: "rent" | "sale";
  bedrooms: number;
  bathrooms: number;
  parkingCount?: number | null;
  propertyType?: string | null;
  availabilityDate?: string | null;
  createdAt?: string | null;
  nsfasApproved?: boolean;
  listingReviewedAt?: string | null;
  furnished?: boolean;
  landlordTrust?: LandlordTrustSummary | null;
  landlordPresence?: PresenceBadge;
  liveTourId?: string | null;
  hasInstantViewing?: boolean;
  liveActivity?: ListingLiveActivity;
  /** 0.0..5.0, one decimal — null when undeterminable. */
  rating: number | null;
  /** 0..9999 — null when undeterminable. */
  reviewCount: number | null;
  /** null => undeterminable distance; computed via haversine. */
  distanceKm: number | null;
  agent?: {
    id: string;
    name: string;
    avatarUrl?: string;
    isVerified?: boolean;
  } | null;
};
