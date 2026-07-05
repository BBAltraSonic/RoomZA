// Feature: discovery-page-experience, Property 4: Distance origin resolution precedence
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { haversineKm, resolveDistanceOrigin } from "./distance";
import type { GeoPoint, ViewportBounds } from "./types";

const geoArb: fc.Arbitrary<GeoPoint> = fc.record({
  lat: fc.double({ min: -90, max: 90, noNaN: true }),
  lng: fc.double({ min: -180, max: 180, noNaN: true }),
});

// Bounds with west <= east and south <= north (a well-formed viewport rectangle),
// though the resolver's midpoint math does not depend on that ordering.
const boundsArb: fc.Arbitrary<ViewportBounds> = fc
  .record({
    lng1: fc.double({ min: -180, max: 180, noNaN: true }),
    lng2: fc.double({ min: -180, max: 180, noNaN: true }),
    lat1: fc.double({ min: -90, max: 90, noNaN: true }),
    lat2: fc.double({ min: -90, max: 90, noNaN: true }),
  })
  .map(({ lng1, lng2, lat1, lat2 }) => ({
    west: Math.min(lng1, lng2),
    east: Math.max(lng1, lng2),
    south: Math.min(lat1, lat2),
    north: Math.max(lat1, lat2),
  }));

describe("resolveDistanceOrigin — Property 4: distance origin resolution precedence", () => {
  // Validates: Requirements 7.3, 7.4, 7.5
  it("P4a returns the geolocation exactly when it is present, regardless of bounds", () => {
    fc.assert(
      fc.property(
        geoArb,
        fc.option(boundsArb, { nil: null }),
        (geo, bounds) => {
          // Geolocation takes precedence over any (or no) bounds (Req 7.3).
          expect(resolveDistanceOrigin(geo, bounds)).toBe(geo);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("P4b falls back to the Viewport_Bounds midpoint when geolocation is absent", () => {
    fc.assert(
      fc.property(boundsArb, (bounds) => {
        // No geolocation but bounds exist => midpoint of the rectangle (Req 7.4).
        const origin = resolveDistanceOrigin(null, bounds);
        expect(origin).not.toBeNull();
        expect(origin).toEqual({
          lat: (bounds.south + bounds.north) / 2,
          lng: (bounds.west + bounds.east) / 2,
        });
      }),
      { numRuns: 100 },
    );
  });

  it("P4c returns null when neither geolocation nor bounds are present", () => {
    // Deterministic terminal case (Req 7.5): no inputs => no origin.
    expect(resolveDistanceOrigin(null, null)).toBeNull();
  });

  it("P4d a null origin makes every card's distanceKm null", () => {
    // The Card_Pipeline computes distanceKm as `origin ? haversineKm(...) : null`.
    // When the resolver yields null, that mapping must produce null for every card
    // irrespective of the listing coordinates (Req 7.5).
    fc.assert(
      fc.property(fc.array(geoArb, { minLength: 0, maxLength: 50 }), (coords) => {
        const origin = resolveDistanceOrigin(null, null);
        expect(origin).toBeNull();

        const distances = coords.map((coord) =>
          origin ? haversineKm(origin, coord) : null,
        );
        expect(distances.every((d) => d === null)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("P4e a resolvable origin yields a determinable (non-null) distance per card", () => {
    // Complementary sanity: when an origin resolves (geo or bounds midpoint), the
    // same mapping produces a finite, non-null distance for each listing.
    fc.assert(
      fc.property(
        fc.option(geoArb, { nil: null }),
        boundsArb,
        fc.array(geoArb, { minLength: 1, maxLength: 50 }),
        (geo, bounds, coords) => {
          const origin = resolveDistanceOrigin(geo, bounds);
          expect(origin).not.toBeNull();

          for (const coord of coords) {
            const distance = origin ? haversineKm(origin, coord) : null;
            expect(distance).not.toBeNull();
            expect(Number.isFinite(distance as number)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
