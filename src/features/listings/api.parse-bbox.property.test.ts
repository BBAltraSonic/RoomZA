// Feature: discovery-page-experience, Property 11: bbox validation accepts only four finite in-range coordinates
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { parseBbox } from "./api";

const MAX_LONGITUDE = 180;
const MAX_LATITUDE = 90;

type ParseBboxResult = ReturnType<typeof parseBbox>;

function isAccepted(result: ParseBboxResult): result is { bbox: { west: number; south: number; east: number; north: number } } {
  return "bbox" in result;
}

/**
 * Independent reference oracle expressing the Property 11 predicate directly:
 * a bbox string is valid iff it is four comma-separated finite numbers with
 * longitude (west/east) in [-180, 180] and latitude (south/north) in [-90, 90].
 */
function shouldAccept(value: string | null): boolean {
  if (!value) return false;
  const parts = value.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return false;
  const [west, south, east, north] = parts as [number, number, number, number];
  if (Math.abs(west) > MAX_LONGITUDE || Math.abs(east) > MAX_LONGITUDE) return false;
  if (Math.abs(south) > MAX_LATITUDE || Math.abs(north) > MAX_LATITUDE) return false;
  return true;
}

// Tokens that Number() coerces to a non-finite value (NaN / Infinity) -> rejection.
const nonNumericToken = fc.constantFrom("abc", "x", "NaN", "12a", "--", ".", "Infinity", "-Infinity", "1,2");

// Arbitrary token that may or may not be a finite number.
const looseToken = fc.oneof(
  fc.float({ noNaN: false }).map((n) => String(n)),
  fc.integer().map((n) => String(n)),
  nonNumericToken,
);

// Arbitrary candidate bbox string built from 0..7 comma-joined loose tokens.
const looseBboxString = fc.array(looseToken, { minLength: 0, maxLength: 7 }).map((tokens) => tokens.join(","));

const inRangeLongitude = fc.float({ min: -MAX_LONGITUDE, max: MAX_LONGITUDE, noNaN: true });
const inRangeLatitude = fc.float({ min: -MAX_LATITUDE, max: MAX_LATITUDE, noNaN: true });

describe("Feature: discovery-page-experience, Property 11: bbox validation accepts only four finite in-range coordinates", () => {
  // Property 11: bbox validation accepts only four finite in-range coordinates.
  // parseBbox returns a parsed bbox iff the string is four comma-separated finite
  // numbers with longitude in [-180, 180] and latitude in [-90, 90], else an error.
  // Validates: Requirements 3.3, 3.4

  it("P11 accepts a candidate string iff it is four finite in-range coordinates (iff over arbitrary strings)", () => {
    fc.assert(
      fc.property(fc.oneof(looseBboxString, fc.constant("")), (value) => {
        const result = parseBbox(value);
        const accepted = isAccepted(result);

        // Both directions of the iff: acceptance matches the predicate exactly.
        expect(accepted).toBe(shouldAccept(value));

        if (accepted) {
          // An accepted result must echo the parsed coordinates in range.
          const { west, south, east, north } = result.bbox;
          expect(Math.abs(west)).toBeLessThanOrEqual(MAX_LONGITUDE);
          expect(Math.abs(east)).toBeLessThanOrEqual(MAX_LONGITUDE);
          expect(Math.abs(south)).toBeLessThanOrEqual(MAX_LATITUDE);
          expect(Math.abs(north)).toBeLessThanOrEqual(MAX_LATITUDE);
        } else {
          // A rejected result must carry a validation error string.
          expect("error" in result && typeof result.error === "string").toBe(true);
        }
      }),
      { numRuns: 300 },
    );
  });

  it("P11 (forward) accepts four finite in-range coordinates and returns their values", () => {
    fc.assert(
      fc.property(inRangeLongitude, inRangeLatitude, inRangeLongitude, inRangeLatitude, (west, south, east, north) => {
        const value = `${west},${south},${east},${north}`;
        const result = parseBbox(value);
        expect(isAccepted(result)).toBe(true);
        if (isAccepted(result)) {
          // Compare against the same string round-trip parseBbox performs so that
          // signed-zero (-0 -> "0" -> +0) does not create a false mismatch.
          expect(result.bbox).toEqual({
            west: Number(String(west)),
            south: Number(String(south)),
            east: Number(String(east)),
            north: Number(String(north)),
          });
        }
      }),
      { numRuns: 200 },
    );
  });

  it("P11 (reverse) rejects when the arity is not exactly four", () => {
    const wrongArity = fc
      .array(inRangeLongitude, { minLength: 0, maxLength: 7 })
      .filter((parts) => parts.length !== 4);
    fc.assert(
      fc.property(wrongArity, (parts) => {
        const result = parseBbox(parts.join(","));
        expect(isAccepted(result)).toBe(false);
      }),
      { numRuns: 200 },
    );
  });

  it("P11 (reverse) rejects when any of the four tokens is not a finite number", () => {
    fc.assert(
      fc.property(
        fc.tuple(inRangeLongitude, inRangeLatitude, inRangeLongitude, inRangeLatitude),
        fc.integer({ min: 0, max: 3 }),
        nonNumericToken,
        (coords, badIndex, badToken) => {
          const tokens = coords.map((coord) => String(coord));
          tokens[badIndex] = badToken;
          const result = parseBbox(tokens.join(","));
          expect(isAccepted(result)).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("P11 (reverse) rejects four finite coordinates when longitude is out of [-180, 180]", () => {
    const outOfRangeLon = fc.oneof(
      fc.float({ min: Math.fround(180.0001), max: 1e6, noNaN: true }),
      fc.float({ min: -1e6, max: Math.fround(-180.0001), noNaN: true }),
    );
    fc.assert(
      fc.property(outOfRangeLon, inRangeLatitude, inRangeLongitude, inRangeLatitude, (west, south, east, north) => {
        const result = parseBbox(`${west},${south},${east},${north}`);
        expect(isAccepted(result)).toBe(false);
      }),
      { numRuns: 200 },
    );
  });

  it("P11 (reverse) rejects four finite coordinates when latitude is out of [-90, 90]", () => {
    const outOfRangeLat = fc.oneof(
      fc.float({ min: Math.fround(90.0001), max: 1e6, noNaN: true }),
      fc.float({ min: -1e6, max: Math.fround(-90.0001), noNaN: true }),
    );
    fc.assert(
      fc.property(inRangeLongitude, outOfRangeLat, inRangeLongitude, inRangeLatitude, (west, south, east, north) => {
        const result = parseBbox(`${west},${south},${east},${north}`);
        expect(isAccepted(result)).toBe(false);
      }),
      { numRuns: 200 },
    );
  });

  it("P11 rejects a missing (null) bbox value", () => {
    expect(isAccepted(parseBbox(null))).toBe(false);
  });
});
