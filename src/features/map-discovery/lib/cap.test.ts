// Feature: production-readiness-hardening, Property 10
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { capListings, clusterMarkers, shouldClusterMarkers } from "./cap";
import { MARKER_CLUSTER_THRESHOLD, MAX_MARKERS } from "./constants";

type ListingLike = { id: number; name: string };

const listingArb = fc.array(
  fc.record({
    id: fc.integer(),
    name: fc.string(),
  }),
  { minLength: 0, maxLength: 300 },
);

describe("capListings", () => {
  // Feature: production-readiness-hardening, Property 10
  // Property 10: Marker capping preserves a bounded in-order prefix.
  // Validates: Requirements 5.1
  it("P10 returns the bounded prefix of the input in order", () => {
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

  it("P10 clusters only above the in-viewport threshold", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: MARKER_CLUSTER_THRESHOLD }), (count) => {
        expect(shouldClusterMarkers(count)).toBe(false);
      }),
      { numRuns: 100 },
    );
    expect(shouldClusterMarkers(MARKER_CLUSTER_THRESHOLD + 1)).toBe(true);
  });

  it("clusters nearby markers when the threshold is exceeded", () => {
    const markers = Array.from({ length: MARKER_CLUSTER_THRESHOLD + 1 }, (_, index) => ({
      id: `listing-${index}`,
      name: `Listing ${index}`,
      coordinates: {
        lat: -26.2041 + index * 0.00001,
        lng: 28.0473 + index * 0.00001,
      },
    }));

    const clusters = clusterMarkers(markers);

    expect(clusters.length).toBeLessThan(markers.length);
    expect(clusters.reduce((sum, cluster) => sum + cluster.count, 0)).toBe(markers.length);
    expect(clusters.some((cluster) => cluster.count > 1)).toBe(true);
  });
});
