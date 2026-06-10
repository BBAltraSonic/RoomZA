// "Most Nearest" sort for the Mobile_Map_Discovery feature.
// See .kiro/specs/mobile-map-discovery/design.md (Correctness Property 5).

import type { ListingCardModel } from "./types";

/**
 * Sort cards by ascending `distanceKm` ("Most Nearest" order) (Req 6.3, 6.4, 6.5).
 *
 * - Cards with a determinable distance are ordered ascending by `distanceKm`.
 * - The sort is STABLE: cards with equal distance preserve their relative
 *   input order (decorate-sort-undecorate with an input-index tiebreaker).
 * - Cards with `distanceKm === null` (undeterminable) are placed AFTER all
 *   cards with a determinable distance, preserving their relative input order.
 * - Returns a new array; the input is not mutated.
 */
export function mostNearestSort(
  cards: ListingCardModel[],
): ListingCardModel[] {
  const determinable: Array<{ card: ListingCardModel; index: number }> = [];
  const undeterminable: ListingCardModel[] = [];

  cards.forEach((card, index) => {
    if (card.distanceKm === null) {
      undeterminable.push(card);
    } else {
      determinable.push({ card, index });
    }
  });

  determinable.sort((a, b) => {
    const distanceDelta = (a.card.distanceKm as number) - (b.card.distanceKm as number);
    if (distanceDelta !== 0) {
      return distanceDelta;
    }
    // Equal distance: preserve relative input order (stable).
    return a.index - b.index;
  });

  return [...determinable.map((entry) => entry.card), ...undeterminable];
}
