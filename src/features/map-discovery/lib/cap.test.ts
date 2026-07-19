// Feature: production-readiness-hardening, Property 10
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { capListings, clusterMarkers, markerBounds, shouldClusterMarkers } from "./cap";
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

  // Feature: discovery-page-experience, Property 1: Marker cap preserves a bounded in-order prefix
  // Validates: Requirements 7.1, 8.1
  it("P1 preserves a bounded in-order prefix (discovery-page-experience)", () => {
    fc.assert(
      fc.property(listingArb, (items: ListingLike[]) => {
        const result = capListings(items);

        // Length never exceeds MAX_MARKERS and equals min(input.length, MAX_MARKERS).
        expect(result.length).toBeLessThanOrEqual(MAX_MARKERS);
        expect(result.length).toBe(Math.min(items.length, MAX_MARKERS));

        // Output is the first `min(length, 200)` elements in original input order.
        expect(result).toEqual(items.slice(0, Math.min(items.length, MAX_MARKERS)));
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
    expect(MARKER_CLUSTER_THRESHOLD).toBeLessThan(MAX_MARKERS);
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

  it("derives bounds that contain every marker in a cluster", () => {
    const bounds = markerBounds([
      { id: "a", coordinates: { lat: -33.95, lng: 18.4 } },
      { id: "b", coordinates: { lat: -33.9, lng: 18.5 } },
      { id: "c", coordinates: { lat: -34, lng: 18.45 } },
    ]);

    expect(bounds).toEqual({ north: -33.9, south: -34, east: 18.5, west: 18.4 });
    expect(markerBounds([])).toBeNull();
  });
});
