// Marker↔card index mapping pure function for the Mobile_Map_Discovery feature.
// See .kiro/specs/mobile-map-discovery/design.md (Marker↔Card synchronization).

import type { ListingCardModel } from "./types";

/**
 * Resolve the carousel card index for an activated marker id (Req 3.4).
 *
 * Returns the index `idx` where `cards[idx].id === id`, or `-1` when no card
 * matches. The first matching index is returned when ids are not unique.
 */
export function markerToCardIndex(cards: ListingCardModel[], id: string): number {
  return cards.findIndex((card) => card.id === id);
}
