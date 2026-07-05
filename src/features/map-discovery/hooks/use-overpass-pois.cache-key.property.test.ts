// Feature: discovery-page-experience, Property 12: POI cache key rounds bounds to 0.01° precision
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { getCacheKey, type ViewportBounds } from "./use-overpass-pois";

// The helper rounds each coordinate via Math.round(coord * 100) / 100, i.e. to
// the nearest 0.01° bucket. Two coordinates share a key iff they land in the
// same bucket.
const bucket = (coord: number) => Math.round(coord * 100);

// Smart generator: coordinates snapped to the center of a 0.01° bucket
// (…, 0.00, 0.01, 0.02, …). Since Math.round(s) maps scaled coord s to bucket
// k over the interval [k - 0.5, k + 0.5), the bucket center is k/100. Centering
// there (not on the ±0.005 boundary) guarantees a small perturbation stays
// inside the same bucket. Range is constrained to valid lat/lng magnitudes.
const gridCenterArb = fc
  .integer({ min: -18_000, max: 18_000 })
  .map((n) => n / 100);

// A perturbation strictly smaller than half a bucket (0.005°), so a
// bucket-centered coordinate plus this delta never crosses into another bucket.
const inBucketDeltaArb = fc.float({
  min: Math.fround(-0.0049),
  max: Math.fround(0.0049),
  noNaN: true,
});

const boundsFromCenters = (
  north: number,
  south: number,
  east: number,
  west: number,
): ViewportBounds => ({ north, south, east, west });

describe("getCacheKey", () => {
  // Property 12: POI cache key rounds bounds to 0.01° precision.
  // Validates: Requirements 5.4
  it("P12 bounds agreeing to 0.01° for a layer produce identical keys", () => {
    fc.assert(
      fc.property(
        gridCenterArb,
        gridCenterArb,
        gridCenterArb,
        gridCenterArb,
        inBucketDeltaArb,
        inBucketDeltaArb,
        inBucketDeltaArb,
        inBucketDeltaArb,
        fc.string(),
        (north, south, east, west, dN, dS, dE, dW, categoryId) => {
          const a = boundsFromCenters(north, south, east, west);
          const b = boundsFromCenters(north + dN, south + dS, east + dE, west + dW);

          // Same 0.01° bucket on every coordinate => identical keys => cache hit.
          expect(getCacheKey(categoryId, b)).toBe(getCacheKey(categoryId, a));
        },
      ),
      { numRuns: 100 },
    );
  });

  // Property 12: POI cache key rounds bounds to 0.01° precision.
  // Validates: Requirements 5.4
  it("P12 bounds differing by more than 0.01° produce distinct keys", () => {
    fc.assert(
      fc.property(
        gridCenterArb,
        gridCenterArb,
        gridCenterArb,
        gridCenterArb,
        // Whole-bucket integer shifts (>= 1 bucket = 0.01°) on at least one coord.
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 0, max: 500 }),
        fc.string(),
        (north, south, east, west, sN, sS, sE, sW, categoryId) => {
          // Guarantee at least one coordinate lands in a different bucket.
          fc.pre(sN + sS + sE + sW > 0);

          const a = boundsFromCenters(north, south, east, west);
          const b = boundsFromCenters(
            north + sN / 100,
            south + sS / 100,
            east + sE / 100,
            west + sW / 100,
          );

          // Only assert distinctness when the rounded buckets actually differ.
          const bucketsDiffer =
            bucket(a.north) !== bucket(b.north) ||
            bucket(a.south) !== bucket(b.south) ||
            bucket(a.east) !== bucket(b.east) ||
            bucket(a.west) !== bucket(b.west);
          fc.pre(bucketsDiffer);

          expect(getCacheKey(categoryId, b)).not.toBe(getCacheKey(categoryId, a));
        },
      ),
      { numRuns: 100 },
    );
  });
});
