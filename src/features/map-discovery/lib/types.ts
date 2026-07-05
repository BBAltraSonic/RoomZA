// Shared types for the Mobile_Map_Discovery feature.
// See .kiro/specs/mobile-map-discovery/design.md (Data Models).

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

/** View model consumed by ListingCard / ListingCarousel. */
export type ListingCardModel = {
  id: string;
  title: string;
  imageUrls: string[];
  price: number;
  bedrooms: number;
  bathrooms: number;
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
