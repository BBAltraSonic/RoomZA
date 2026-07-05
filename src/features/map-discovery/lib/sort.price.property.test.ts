// Feature: discovery-page-experience, Property 5: Price sort ordering is monotonic
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { priceSort } from "./sort";

type PricedListing = {
  id: string;
  priceValue: number;
};

// Smart generator: listings with a finite numeric priceValue, constrained to a
// realistic (but wide) rental price range so the input stays in the intended
// input space while still exercising equal-price ties and large spreads.
const pricedListingArb = fc.array(
  fc.float({ min: 0, max: 5_000_000, noNaN: true }),
  { minLength: 0, maxLength: 100 },
);

function toListings(prices: number[]): PricedListing[] {
  return prices.map((priceValue, index) => ({ id: `listing-${index}`, priceValue }));
}

describe("priceSort", () => {
  // Property 5: Price sort ordering is monotonic.
  // Validates: Requirements 6.4, 6.5
  it("P5 'Price: Low to High' yields non-decreasing priceValue", () => {
    fc.assert(
      fc.property(pricedListingArb, (prices) => {
        const result = priceSort(toListings(prices), "asc");

        // Same multiset of ids (permutation, nothing dropped or duplicated).
        expect(result.map((item) => item.id).sort()).toEqual(
          toListings(prices)
            .map((item) => item.id)
            .sort(),
        );

        for (let index = 1; index < result.length; index += 1) {
          expect(result[index - 1]!.priceValue).toBeLessThanOrEqual(result[index]!.priceValue);
        }
      }),
      { numRuns: 100 },
    );
  });

  // Property 5: Price sort ordering is monotonic.
  // Validates: Requirements 6.4, 6.5
  it("P5 'Price: High to Low' yields non-increasing priceValue", () => {
    fc.assert(
      fc.property(pricedListingArb, (prices) => {
        const result = priceSort(toListings(prices), "desc");

        expect(result.map((item) => item.id).sort()).toEqual(
          toListings(prices)
            .map((item) => item.id)
            .sort(),
        );

        for (let index = 1; index < result.length; index += 1) {
          expect(result[index - 1]!.priceValue).toBeGreaterThanOrEqual(result[index]!.priceValue);
        }
      }),
      { numRuns: 100 },
    );
  });
});
