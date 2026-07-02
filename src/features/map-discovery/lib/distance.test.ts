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
