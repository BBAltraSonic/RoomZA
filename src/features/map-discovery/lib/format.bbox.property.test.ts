// Feature: discovery-page-experience, Property 13: bbox request formatting uses six decimal places
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { formatBboxParam } from "./format";
import type { ViewportBounds } from "./types";

// Each part must be a plain (non-exponential) decimal with exactly six
// fractional digits, matching `toFixed(6)` output.
const SIX_DECIMALS = /^-?\d+\.\d{6}$/;

// Smart generator: coordinates constrained to the geographic input space the
// Viewport_Query actually deals with (longitude [-180, 180], latitude
// [-90, 90]). Values are finite (noNaN) so `toFixed(6)` always yields a plain
// decimal rather than an exponential string.
const boundsArb: fc.Arbitrary<ViewportBounds> = fc.record({
  west: fc.double({ min: -180, max: 180, noNaN: true }),
  south: fc.double({ min: -90, max: 90, noNaN: true }),
  east: fc.double({ min: -180, max: 180, noNaN: true }),
  north: fc.double({ min: -90, max: 90, noNaN: true }),
});

describe("formatBboxParam", () => {
  // Property 13: bbox request formatting uses six decimal places.
  // Validates: Requirements 1.1
  it("P13 renders west,south,east,north each to exactly six decimal places", () => {
    fc.assert(
      fc.property(boundsArb, (bounds) => {
        const result = formatBboxParam(bounds);
        const parts = result.split(",");

        // Exactly four parts in west,south,east,north order.
        expect(parts).toHaveLength(4);

        const ordered = [bounds.west, bounds.south, bounds.east, bounds.north];
        parts.forEach((part, index) => {
          // Exactly six decimal places, plain decimal notation.
          expect(part).toMatch(SIX_DECIMALS);
          // Parsed value equals the coordinate rounded to six decimals.
          expect(Number(part)).toBe(Number(ordered[index]!.toFixed(6)));
        });
      }),
      { numRuns: 100 },
    );
  });
});
