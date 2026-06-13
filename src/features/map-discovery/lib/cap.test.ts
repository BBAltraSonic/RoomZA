// Feature: mobile-map-discovery, Property 1
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { capListings } from "./cap";
import { MAX_MARKERS } from "./constants";

type ListingLike = { id: number; name: string };

const listingArb = fc.array(
  fc.record({
    id: fc.integer(),
    name: fc.string(),
  }),
  { minLength: 0, maxLength: 300 },
);

describe("capListings", () => {
  // Property 1: Marker capping preserves a bounded prefix.
  // Validates: Requirements 3.2, 3.7
  it("P1 returns the bounded prefix of the input in order", () => {
    fc.assert(
      fc.property(listingArb, (items: ListingLike[]) => {
        const result = capListings(items);

        // Output length = min(input.length, MAX_MARKERS).
        expect(result.length).toBe(Math.min(items.length, MAX_MARKERS));

        // Output is the prefix of input in input order.
        expect(result).toEqual(items.slice(0, result.length));
        result.forEach((item, idx) => {
          expect(item).toBe(items[idx]);
        });
      }),
      { numRuns: 100 },
    );
  });

  it("yields empty output for empty input", () => {
    expect(capListings([])).toEqual([]);
  });
});
