import { describe, expect, it } from "vitest";

import {
  markerDisplayMode,
  resolveViewportContext,
  type GeocodedAddressComponent,
} from "./viewport-context";

const components: GeocodedAddressComponent[] = [
  { long_name: "Cape Town", types: ["locality"] },
  { long_name: "City of Cape Town", types: ["administrative_area_level_2"] },
  { long_name: "Milnerton", types: ["sublocality_level_1"] },
  { long_name: "Century City", types: ["neighborhood"] },
  { long_name: "Century Boulevard", types: ["route"] },
];

describe("markerDisplayMode", () => {
  it("uses density, mixed, and price modes at the approved zoom boundaries", () => {
    expect(markerDisplayMode(12)).toBe("density");
    expect(markerDisplayMode(13)).toBe("mixed");
    expect(markerDisplayMode(14)).toBe("mixed");
    expect(markerDisplayMode(15)).toBe("prices");
  });
});

describe("resolveViewportContext", () => {
  it("chooses a label appropriate to the current zoom", () => {
    expect(resolveViewportContext(9, components)).toMatchObject({
      label: "Cape Town",
      specificity: "metro",
    });
    expect(resolveViewportContext(12, components)).toMatchObject({
      label: "City of Cape Town",
      specificity: "district",
    });
    expect(resolveViewportContext(15, components)).toMatchObject({
      label: "Century City",
      specificity: "suburb",
    });
    expect(resolveViewportContext(17, components)).toMatchObject({
      label: "Century Boulevard",
      specificity: "street",
    });
  });

  it("falls back conservatively instead of claiming an unrelated place", () => {
    expect(resolveViewportContext(15, [])).toEqual({
      label: "this area",
      zoom: 15,
      specificity: "suburb",
    });
  });

  it("shortens administrative municipality labels for scan-friendly headings", () => {
    expect(resolveViewportContext(12, [
      {
        long_name: "City of Johannesburg Metropolitan Municipality",
        types: ["administrative_area_level_2"],
      },
    ])).toMatchObject({
      label: "Johannesburg metro",
      specificity: "district",
    });
  });
});
