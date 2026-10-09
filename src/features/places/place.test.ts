import { describe, expect, it } from "vitest";
import type { NormalizedLocation } from "@/lib/maptiler";
import { placeInputFromGeocoder } from "./place";

const place: NormalizedLocation = {
  id: "neighbourhood.rondebosch",
  label: "Rondebosch",
  secondaryLabel: "Cape Town, Western Cape, South Africa",
  fullAddress: "Rondebosch, Cape Town, Western Cape, South Africa",
  center: { lat: -33.96, lng: 18.47 },
  bounds: { west: 18.46, south: -33.97, east: 18.49, north: -33.95 },
  placeType: "neighbourhood",
  hierarchy: { country: "South Africa" },
  categories: [],
};

describe("place catalogue admission", () => {
  it("accepts bounded South African suburbs", () => {
    expect(placeInputFromGeocoder(place)).toMatchObject({ provider_id: place.id, level: "neighbourhood", name: "Rondebosch" });
  });

  it("rejects an outside-country suggestion even if its coordinates look nearby", () => {
    expect(placeInputFromGeocoder({ ...place, hierarchy: { country: "Lesotho" } })).toBeNull();
  });

  it("rejects unbounded and street-level suggestions", () => {
    expect(placeInputFromGeocoder({ ...place, bounds: undefined })).toBeNull();
    expect(placeInputFromGeocoder({ ...place, placeType: "address" })).toBeNull();
  });
});
