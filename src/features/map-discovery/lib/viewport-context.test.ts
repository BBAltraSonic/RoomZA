import { describe, expect, it } from "vitest";

import type { NormalizedLocation } from "@/lib/maptiler";

import {
  markerDisplayMode,
  resolveLocationViewportContext,
} from "./viewport-context";

const feature: NormalizedLocation = {
  id: "address.century-boulevard",
  label: "12 Century Boulevard",
  fullAddress: "12 Century Boulevard, Century City, Cape Town",
  center: { lat: -33.89, lng: 18.51 },
  placeType: "address",
  hierarchy: {
    region: "Western Cape",
    municipality: "City of Cape Town Metropolitan Municipality",
    place: "Cape Town",
    locality: "Milnerton",
    neighbourhood: "Century City",
    road: "Century Boulevard",
  },
  categories: [],
};

describe("markerDisplayMode", () => {
  it("shows prices at neighbourhood zoom and full details once pins have room", () => {
    expect(markerDisplayMode(12)).toBe("density");
    expect(markerDisplayMode(13)).toBe("prices");
    expect(markerDisplayMode(14)).toBe("prices");
    expect(markerDisplayMode(15)).toBe("details");
  });
});

describe("resolveLocationViewportContext", () => {
  it("normalizes MapTiler context into the existing metro-to-street shape", () => {
    expect(resolveLocationViewportContext(9, feature)).toMatchObject({
      label: "Cape Town metro",
      specificity: "metro",
    });
    expect(resolveLocationViewportContext(12, feature)).toMatchObject({
      label: "Cape Town metro",
      specificity: "district",
    });
    expect(resolveLocationViewportContext(15, feature)).toMatchObject({
      label: "Century City",
      specificity: "suburb",
    });
    expect(resolveLocationViewportContext(17, feature)).toMatchObject({
      label: "Century Boulevard",
      specificity: "street",
    });
  });

  it("falls back without inventing an area label", () => {
    expect(resolveLocationViewportContext(15)).toEqual({
      label: "this area",
      zoom: 15,
      specificity: "suburb",
    });
  });
});
