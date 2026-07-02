// Feature: production-readiness-hardening, Property 11
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

describe("mostNearestSort", () => {
  // Property 11: "Closest" ordering is correct, stable, and null-last.
  // Validates: Requirements 5.2, 5.4
  it("P11 sorts by ascending distance, preserves equal-distance order, and places null last", () => {
    fc.assert(
      fc.property(
        fc.array(fc.option(fc.float({ min: 0, max: 10_000, noNaN: true }), { nil: null }), { minLength: 0, maxLength: 80 }),
        (distances) => {
          const input = distances.map((distance, index) => card(`listing-${index}`, distance));
          const result = mostNearestSort(input);
          const finite = result.filter((item) => item.distanceKm !== null);
          const nullDistance = result.filter((item) => item.distanceKm === null);

          for (let index = 1; index < finite.length; index += 1) {
            expect(finite[index - 1]?.distanceKm ?? 0).toBeLessThanOrEqual(finite[index]?.distanceKm ?? 0);
          }

          for (const item of nullDistance) {
            expect(result.indexOf(item)).toBeGreaterThanOrEqual(finite.length);
          }

          const byDistance = new Map<number | null, string[]>();
          for (const item of input) {
            byDistance.set(item.distanceKm, [...(byDistance.get(item.distanceKm) ?? []), item.id]);
          }
          for (const [distance, ids] of byDistance) {
            const sortedIds = result.filter((item) => item.distanceKm === distance).map((item) => item.id);
            expect(sortedIds).toEqual(ids);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
