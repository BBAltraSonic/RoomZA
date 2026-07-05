import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { haversineKm } from "./distance";
import type { GeoPoint } from "./types";

const pointArb = fc.record({
  lat: fc.double({ min: -90, max: 90, noNaN: true }),
  lng: fc.double({ min: -180, max: 180, noNaN: true }),
});

describe("haversineKm", () => {
  it("returns zero for identical points", () => {
    fc.assert(
      fc.property(pointArb, (point: GeoPoint) => {
        expect(haversineKm(point, point)).toBeCloseTo(0, 10);
      }),
      { numRuns: 100 },
    );
  });

  it("is symmetric for valid coordinates", () => {
    fc.assert(
      fc.property(pointArb, pointArb, (a: GeoPoint, b: GeoPoint) => {
        expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 10);
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: discovery-page-experience, Property 2: Distance is a symmetric, zero-identity metric
// Validates: Requirements 7.2
describe("haversineKm — Property 2: symmetric, zero-identity metric", () => {
  const geoPointArb = fc.record({
    lat: fc.double({ min: -90, max: 90, noNaN: true }),
    lng: fc.double({ min: -180, max: 180, noNaN: true }),
  });

  it("is symmetric: haversineKm(a, b) === haversineKm(b, a)", () => {
    fc.assert(
      fc.property(geoPointArb, geoPointArb, (a: GeoPoint, b: GeoPoint) => {
        // Symmetry is exact: deltas are squared (sign-independent) and the
        // cross term cos(lat1) * cos(lat2) is commutative in IEEE-754.
        expect(haversineKm(a, b)).toBe(haversineKm(b, a));
      }),
      { numRuns: 100 },
    );
  });

  it("has zero identity: haversineKm(a, a) === 0", () => {
    fc.assert(
      fc.property(geoPointArb, (a: GeoPoint) => {
        expect(haversineKm(a, a)).toBe(0);
      }),
      { numRuns: 100 },
    );
  });
});
