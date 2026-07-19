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

/** Direction of a price sort: ascending ("Price: Low to High") or descending ("Price: High to Low"). */
export type PriceSortDirection = "asc" | "desc";

/**
 * Sort listings by numeric `priceValue` (Req 6.4, 6.5).
 *
 * - `"asc"` mirrors the "Price: Low to High" control: non-decreasing `priceValue`.
 * - `"desc"` mirrors the "Price: High to Low" control: non-increasing `priceValue`.
 * - Returns a new array; the input is not mutated.
 *
 * Comparator matches the inline discovery-page order exactly:
 *   asc  -> a.priceValue - b.priceValue
 *   desc -> b.priceValue - a.priceValue
 */
export function priceSort<T extends { priceValue: number }>(
  items: T[],
  direction: PriceSortDirection,
): T[] {
  return [...items].sort((a, b) =>
    direction === "asc"
      ? a.priceValue - b.priceValue
      : b.priceValue - a.priceValue,
  );
}

/**
 * Sort listings by descending creation timestamp (Req 6.7).
 *
 * Mirrors the "Latest" control: newer listings first. A missing `createdAt`
 * (`null` / empty) is treated as the epoch (time 0) and therefore ordered
 * last. Returns a new array; the input is not mutated.
 *
 * Comparator matches the inline discovery-page order exactly:
 *   bTime - aTime, where {a,b}Time = createdAt ? new Date(createdAt).getTime() : 0
 */
export function latestSort<T extends { createdAt: string | null }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });
}
