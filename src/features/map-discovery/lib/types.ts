// Shared types for the Mobile_Map_Discovery feature.
// See .kiro/specs/mobile-map-discovery/design.md (Data Models).

/** Geographic origin used to compute distance. */
export type GeoPoint = {
  lat: number;
  lng: number;
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
};
