// Feature: discovery-page-experience, Property 3: "Most Nearest" ordering is ascending, stable, and null-last
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { mostNearestSort } from "./sort";
import type { ListingCardModel } from "./types";

function card(id: string, distanceKm: number | null): ListingCardModel {
  return {
    id,
    title: id,
    imageUrls: [],
    price: 1,
    bedrooms: 1,
    bathrooms: 1,
    rating: null,
    reviewCount: null,
    distanceKm,
  };
}

describe("mostNearestSort — Most Nearest ordering", () => {
  // Feature: discovery-page-experience, Property 3: "Most Nearest" ordering is ascending, stable, and null-last
  // Validates: Requirements 7.6, 6.6, 15.5
  it("P3 yields a permutation with non-decreasing determinable distance, stable ties, and null-last", () => {
    fc.assert(
      fc.property(
        // Each element carries a distance (or null), keyed by its input index for unique ids.
        fc.array(
          fc.option(fc.float({ min: 0, max: 10_000, noNaN: true }), { nil: null }),
          { minLength: 0, maxLength: 80 },
        ),
        (distances) => {
          const input = distances.map((distance, index) =>
            card(`listing-${index}`, distance),
          );
          const result = mostNearestSort(input);

          // 1. Permutation: same multiset of ids as the input.
          const inputIds = [...input.map((item) => item.id)].sort();
          const resultIds = [...result.map((item) => item.id)].sort();
          expect(resultIds).toEqual(inputIds);
          expect(result.length).toBe(input.length);

          const determinable = result.filter((item) => item.distanceKm !== null);
          const nullDistance = result.filter((item) => item.distanceKm === null);

          // 2. Determinable distances are non-decreasing.
          for (let index = 1; index < determinable.length; index += 1) {
            const prev = determinable[index - 1]?.distanceKm as number;
            const curr = determinable[index]?.distanceKm as number;
            expect(prev).toBeLessThanOrEqual(curr);
          }

          // 3. Null-last: every null-distance card comes after all determinable ones.
          for (const item of nullDistance) {
            expect(result.indexOf(item)).toBeGreaterThanOrEqual(determinable.length);
          }

          // 4. Stable ties: cards sharing a distance value keep their input order.
          const byDistance = new Map<number | null, string[]>();
          for (const item of input) {
            byDistance.set(item.distanceKm, [
              ...(byDistance.get(item.distanceKm) ?? []),
              item.id,
            ]);
          }
          for (const [distance, ids] of byDistance) {
            const orderedIds = result
              .filter((item) => item.distanceKm === distance)
              .map((item) => item.id);
            expect(orderedIds).toEqual(ids);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
