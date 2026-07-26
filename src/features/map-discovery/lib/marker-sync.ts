// Marker↔card index mapping pure function for the Mobile_Map_Discovery feature.
// See .kiro/specs/mobile-map-discovery/design.md (Marker↔Card synchronization).

import type { ListingCardModel } from "./types";
import type { PresenceBadge } from "@/features/presence/presence-status";

/**
 * Resolve the carousel card index for an activated marker id (Req 3.4).
 *
 * Returns the index `idx` where `cards[idx].id === id`, or `-1` when no card
 * matches. The first matching index is returned when ids are not unique.
 */
export function markerToCardIndex(cards: ListingCardModel[], id: string): number {
  return cards.findIndex((card) => card.id === id);
}

/** Marker record consumed by the Map_Surface (assignable to `ListingPin`). */
export type MarkerListing = {
  id: string;
  title: string;
  area: string;
  price: string;
  fullPrice: string;
  coordinates: { lat: number; lng: number };
  /** First image used by the rounded ListingMarker visual (Req 3.3); null when absent. */
  imageUrl: string | null;
  imageUrls: string[];
  bedrooms: number;
  bathrooms: number;
  createdAt: string | null;
  availabilityDate: string | null;
  landlordPresence?: PresenceBadge;
  liveTourId?: string | null;
  hasInstantViewing?: boolean;
};

/**
 * Minimal source-listing shape needed to build a marker record. The concrete
 * `Listing` used by the orchestrator is structurally compatible with this.
 */
export type MarkerSourceListing = {
  id: string;
  title: string;
  area: string;
  price: string;
  fullPrice: string;
  coordinates: { lat: number; lng: number };
  imageUrls: string[];
  beds: number;
  baths: number;
  createdAt: string | null;
  availabilityDate: string | null;
  landlordPresence?: PresenceBadge;
  liveTourId?: string | null;
  hasInstantViewing?: boolean;
};

/**
 * Derive the Marker_Layer records from the Card_Pipeline output (Req 8.1).
 *
 * Markers are produced in the exact order of `cards` — the capped and sorted
 * Card_Pipeline output — so marker index aligns with card index. Each marker
 * is built from its source listing (looked up by id); cards without a matching
 * source listing are dropped, preserving the relative order of the rest.
 */
export function deriveMarkerListings(
  cards: Pick<ListingCardModel, "id">[],
  listings: MarkerSourceListing[],
): MarkerListing[] {
  const byId = new Map(listings.map((listing) => [listing.id, listing]));
  return cards
    .map((card) => byId.get(card.id))
    .filter((listing): listing is MarkerSourceListing => listing !== undefined)
    .map((listing) => ({
      id: listing.id,
      title: listing.title,
      area: listing.area,
      price: listing.price,
      fullPrice: listing.fullPrice,
      coordinates: listing.coordinates,
      imageUrl: listing.imageUrls[0] ?? null,
      imageUrls: listing.imageUrls,
      bedrooms: listing.beds,
      bathrooms: listing.baths,
      createdAt: listing.createdAt,
      availabilityDate: listing.availabilityDate,
      landlordPresence: listing.landlordPresence ?? "offline",
      liveTourId: listing.liveTourId ?? null,
      hasInstantViewing: Boolean(listing.hasInstantViewing),
    }));
}
