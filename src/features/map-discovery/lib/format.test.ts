// Feature: mobile-map-discovery, Property 7
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { formatDistance, formatPrice, formatRating } from "./format";

const ONE_DECIMAL = /^-?\d+\.\d$/;

describe("listing card formatters", () => {
  // Property 7: Listing card formatters respect precision and ranges.
  // Validates: Requirements 5.2, 5.3
  it("P7 formatRating always renders one decimal within the clamped [0.0, 5.0] range", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -100, max: 100, noNaN: true }),
        (rating) => {
          const out = formatRating(rating);
          expect(out).toMatch(ONE_DECIMAL);
          const value = Number(out);
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(5);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("P7 formatRating treats NaN as the minimum", () => {
    expect(formatRating(Number.NaN)).toBe("0.0");
  });

  it("P7 formatDistance always renders one decimal plus the km unit within [0.0, 999.9]", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -100, max: 5000, noNaN: true }),
        (km) => {
          const out = formatDistance(km);
          expect(out).toMatch(/^-?\d+\.\d km$/);
          const value = Number(out.replace(" km", ""));
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(999.9);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("P7 formatDistance treats NaN as the minimum", () => {
    expect(formatDistance(Number.NaN)).toBe("0.0 km");
  });

  it("P7 formatPrice renders a Rand currency indication for positive prices", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 10_000_000, noNaN: true }),
        (price) => {
          const out = formatPrice(price);
          expect(out.startsWith("R ")).toBe(true);
          expect(out.length).toBeGreaterThan(2);
        },
      ),
      { numRuns: 100 },
    );
  });
});
