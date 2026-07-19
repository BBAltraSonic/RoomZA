import { describe, expect, it } from "vitest";

import {
  buildLocationSuggestions,
  buildPlacePredictionRequest,
  findLocationSuggestions,
  moveSuggestionIndex,
} from "./search-suggestions";

describe("findLocationSuggestions", () => {
  it("returns unique matching real locations with prefix matches first", () => {
    expect(
      findLocationSuggestions("sea", [
        "Green Point, Sea Point",
        "Sea Point",
        "sea point",
        "Observatory",
      ]),
    ).toEqual(["Sea Point", "Green Point, Sea Point"]);
  });

  it("waits for a meaningful query and caps the result set", () => {
    expect(findLocationSuggestions("s", ["Sea Point"])).toEqual([]);
    expect(
      findLocationSuggestions("ca", ["Cape Town", "Camps Bay", "Cape Winelands"], 2),
    ).toHaveLength(2);
  });
});

describe("buildLocationSuggestions", () => {
  it("merges recent, Google Places, and in-view candidates without duplicates", () => {
    expect(
      buildLocationSuggestions({
        query: "sea",
        recentSearches: ["Sea Point"],
        placeSuggestions: [
          { placeId: "sea-point-cpt", label: "Sea Point", secondaryLabel: "Cape Town" },
          { placeId: "sea-point-duplicate", label: "Sea Point" },
        ],
        inViewCandidates: ["Green Point, Sea Point"],
      }).map(({ label, source }) => ({ label, source })),
    ).toEqual([
      { label: "Sea Point", source: "recent" },
      { label: "Sea Point", source: "places" },
      { label: "Green Point, Sea Point", source: "in-view" },
    ]);
  });

  it("shows only recent searches before a meaningful query exists", () => {
    expect(
      buildLocationSuggestions({
        query: "",
        recentSearches: ["Rosebank", "Sandton"],
        placeSuggestions: [{ placeId: "cape-town", label: "Cape Town" }],
        inViewCandidates: ["Sea Point"],
      }).map((suggestion) => suggestion.label),
    ).toEqual(["Rosebank", "Sandton"]);
  });
});

describe("moveSuggestionIndex", () => {
  it("enters and wraps the active option in both directions", () => {
    expect(moveSuggestionIndex(-1, 3, 1)).toBe(0);
    expect(moveSuggestionIndex(-1, 3, -1)).toBe(2);
    expect(moveSuggestionIndex(2, 3, 1)).toBe(0);
    expect(moveSuggestionIndex(0, 3, -1)).toBe(2);
  });
});

describe("buildPlacePredictionRequest", () => {
  it("restricts results to South Africa and biases them to the visible map bounds", () => {
    const bounds = { marker: "visible-map-bounds" } as unknown as google.maps.LatLngBounds;

    expect(buildPlacePredictionRequest("  Sea Point  ", bounds)).toEqual({
      input: "Sea Point",
      includedRegionCodes: ["za"],
      locationBias: bounds,
    });
  });
});
