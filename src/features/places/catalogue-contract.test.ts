import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { catalogueResponseSchema, recentLocationIdsSchema, MAX_RECENT_LOCATIONS } from "./catalogue-contract";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const place = (overrides: Record<string, unknown> = {}) => ({
  id: id(1), providerId: "osm:1", label: "Rondebosch", secondaryLabel: "Cape Town", fullAddress: "Rondebosch, Cape Town",
  center: { lat: -33.96, lng: 18.47 }, bounds: { west: 18.4, east: 18.5, south: -34, north: -33.9 },
  ...overrides,
});

describe("recentLocationIdsSchema", () => {
  it("should_accept_up_to_the_maximum_number_of_uuids", () => {
    const ids = Array.from({ length: MAX_RECENT_LOCATIONS }, (_, n) => id(n));
    expect(recentLocationIdsSchema.safeParse(ids)).toEqual({ success: true, data: ids });
  });

  it.each([
    ["too many ids", Array.from({ length: MAX_RECENT_LOCATIONS + 1 }, (_, n) => id(n))],
    ["a non-uuid", ["not-a-uuid"]],
    ["a non-string", [42]],
    ["a non-array", "abc"],
    ["null", null],
  ])("should_reject_%s", (_label, value) => {
    expect(recentLocationIdsSchema.safeParse(value).success).toBe(false);
    expect(() => recentLocationIdsSchema.parse(value)).toThrow();
  });
});

describe("catalogueResponseSchema", () => {
  it("should_return_known_fields_only_and_default_recent_places", () => {
    const parsed = catalogueResponseSchema.parse({ data: { places: [{ ...place(), extra: "dropped" }] }, extra: true });
    expect(parsed).toEqual({ data: { places: [place()], recentPlaces: [] } });
  });

  it("should_keep_a_valid_extent_kind", () => {
    expect(catalogueResponseSchema.parse({ data: { places: [place({ extentKind: "viewport" })] } }).data.places[0]?.extentKind).toBe("viewport");
  });

  it.each([
    ["a centre outside its bounds", place({ center: { lat: 0, lng: 0 } })],
    ["inverted bounds", place({ bounds: { west: 18.5, east: 18.4, south: -34, north: -33.9 } })],
    ["an empty label", place({ label: "" })],
    ["an overlong provider id", place({ providerId: "x".repeat(201) })],
    ["an unknown extent kind", place({ extentKind: "city" })],
    ["a non-finite coordinate", place({ center: { lat: Number.NaN, lng: 18.47 } })],
    ["an out-of-range latitude", place({ bounds: { west: 18.4, east: 18.5, south: -91, north: -33.9 } })],
    ["a missing field", { ...place(), fullAddress: undefined }],
  ])("should_reject_%s", (_label, candidate) => {
    expect(catalogueResponseSchema.safeParse({ data: { places: [candidate] } }).success).toBe(false);
  });

  it("should_reject_more_than_six_places_and_too_many_recent_places", () => {
    expect(catalogueResponseSchema.safeParse({ data: { places: Array.from({ length: 7 }, () => place()) } }).success).toBe(false);
    expect(catalogueResponseSchema.safeParse({ data: { places: [], recentPlaces: Array.from({ length: MAX_RECENT_LOCATIONS + 1 }, () => place()) } }).success).toBe(false);
  });

  it("should_throw_from_parse_when_invalid", () => {
    expect(() => catalogueResponseSchema.parse({ data: {} })).toThrow();
  });
});

describe("client bundle weight", () => {
  it("should_not_import_zod_because_the_location_picker_ships_on_the_home_page", () => {
    // zod adds ~12 KB compressed to `/`, whose initial JS budget is 300 KB (scripts/performance/check-initial-js-budget.mjs).
    const source = readFileSync(path.join(__dirname, "catalogue-contract.ts"), "utf8");
    expect(source).not.toMatch(/from ["']zod["']/);
  });
});
