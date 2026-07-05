// Feature: discovery-page-experience, Property 8: Marker-to-card resolution
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { markerToCardIndex } from "./marker-sync";
import type { ListingCardModel } from "./types";

// Minimal card shape needed by markerToCardIndex (only `id` is consulted).
function makeCard(id: string): ListingCardModel {
  return {
    id,
    title: `card-${id}`,
    imageUrls: [],
    price: 0,
    bedrooms: 0,
    bathrooms: 0,
    rating: null,
    reviewCount: null,
    distanceKm: null,
  };
}

// Smart generator: a small alphabet of ids keeps collisions/duplicates likely,
// so the "first matching index" and "duplicated id" cases are exercised often.
const idArb: fc.Arbitrary<string> = fc.constantFrom("a", "b", "c", "d", "e");

const cardsArb: fc.Arbitrary<ListingCardModel[]> = fc
  .array(idArb, { minLength: 0, maxLength: 50 })
  .map((ids) => ids.map(makeCard));

describe("markerToCardIndex", () => {
  // Property 8: Marker-to-card resolution.
  // markerToCardIndex(cards, id) returns the first index whose card.id === id, else -1.
  // Validates: Requirements 8.4
  it("P8 returns the first matching index for present ids, -1 for absent ids", () => {
    fc.assert(
      fc.property(cardsArb, idArb, (cards, id) => {
        const result = markerToCardIndex(cards, id);

        // Compute the expected first matching index independently.
        let expected = -1;
        for (let index = 0; index < cards.length; index += 1) {
          if (cards[index]!.id === id) {
            expected = index;
            break;
          }
        }

        expect(result).toBe(expected);

        if (expected === -1) {
          // Absent id: no card matches.
          expect(cards.some((card) => card.id === id)).toBe(false);
        } else {
          // Present (possibly duplicated) id: result points at a match and is
          // the first such index — everything before it must not match.
          expect(cards[result]!.id).toBe(id);
          for (let index = 0; index < result; index += 1) {
            expect(cards[index]!.id).not.toBe(id);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
