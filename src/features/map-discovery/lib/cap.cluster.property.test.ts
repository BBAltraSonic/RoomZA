// Feature: discovery-page-experience, Property 9: Clustering threshold behavior
//
// Property 9 exercises the clustering functions that live in `cap.ts`
// (`shouldClusterMarkers` + `clusterMarkers`, gated by MARKER_CLUSTER_THRESHOLD
// in `constants.ts`). Dedicated file to avoid write collisions with the
// existing `cap.test.ts` / `marker-sync.test.ts` suites.
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { clusterMarkers, shouldClusterMarkers } from "./cap";
import { MARKER_CLUSTER_THRESHOLD } from "./constants";

type TestMarker = {
  id: string;
  coordinates: { lat: number; lng: number };
};

/** A single clusterable marker with an in-range South-Africa-ish coordinate. */
const markerArb: fc.Arbitrary<TestMarker> = fc
  .record({
    id: fc.string({ minLength: 1, maxLength: 12 }),
    lat: fc.double({ min: -90, max: 90, noNaN: true }),
    lng: fc.double({ min: -180, max: 180, noNaN: true }),
  })
  .map(({ id, lat, lng }) => ({
    id,
    coordinates: { lat, lng },
  }));

/** Assign a unique suffix to each marker so ids never collide. */
function withUniqueIds(markers: TestMarker[]): TestMarker[] {
  return markers.map((marker, index) => ({
    ...marker,
    id: `${marker.id}#${index}`,
  }));
}

describe("cap clustering — Property 9: Clustering threshold behavior", () => {
  // Feature: discovery-page-experience, Property 9: Clustering threshold behavior
  // Validates: Requirements 8.2, 8.3
  it("P9 shouldClusterMarkers is true exactly when count > threshold (200)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1000 }), (count) => {
        expect(shouldClusterMarkers(count)).toBe(count > MARKER_CLUSTER_THRESHOLD);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: discovery-page-experience, Property 9: Clustering threshold behavior
  // Validates: Requirements 8.2, 8.3
  it("P9 at/below threshold yields exactly one marker per listing", () => {
    fc.assert(
      fc.property(
        fc
          .array(markerArb, { minLength: 0, maxLength: MARKER_CLUSTER_THRESHOLD })
          .map(withUniqueIds),
        (markers) => {
          const result = clusterMarkers(markers);

          // One output cluster per input listing, in input order.
          expect(result.length).toBe(markers.length);
          result.forEach((cluster, idx) => {
            expect(cluster.count).toBe(1);
            expect(cluster.markers).toHaveLength(1);
            expect(cluster.markers[0]).toBe(markers[idx]);
            expect(cluster.id).toBe(markers[idx]!.id);
          });
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: discovery-page-experience, Property 9: Clustering threshold behavior
  // Validates: Requirements 8.2, 8.3
  it("P9 above threshold produces clusters whose member counts sum to the input count", () => {
    fc.assert(
      fc.property(
        fc
          .array(markerArb, {
            minLength: MARKER_CLUSTER_THRESHOLD + 1,
            maxLength: MARKER_CLUSTER_THRESHOLD + 200,
          })
          .map(withUniqueIds),
        (markers) => {
          const clusters = clusterMarkers(markers);

          // Every input marker is accounted for exactly once across clusters.
          const totalMembers = clusters.reduce((sum, cluster) => sum + cluster.count, 0);
          expect(totalMembers).toBe(markers.length);

          // `count` must equal the actual member array length for each cluster.
          clusters.forEach((cluster) => {
            expect(cluster.count).toBe(cluster.markers.length);
          });

          // No marker id is duplicated or dropped across the cluster members.
          const memberIds = clusters.flatMap((cluster) => cluster.markers.map((m) => m.id));
          expect(memberIds).toHaveLength(markers.length);
          expect(new Set(memberIds)).toEqual(new Set(markers.map((m) => m.id)));
        },
      ),
      { numRuns: 100 },
    );
  });
});
