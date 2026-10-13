import { describe, expect, it } from "vitest";

import {
  buildLocationSuggestions,
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
  const target = { center: { lat: -33.92, lng: 18.42 } };

  it("merges recent, catalogue, and in-view candidates without duplicates", () => {
    expect(
      buildLocationSuggestions({
        query: "sea",
        recentSearches: ["Sea Point"],
        placeSuggestions: [
          { providerId: "sea-point-cpt", label: "Sea Point", secondaryLabel: "Cape Town", target },
          { providerId: "sea-point-duplicate", label: "Sea Point", target },
        ],
        inViewCandidates: ["Green Point, Sea Point"],
      }).map(({ label, source }) => ({ label, source })),
    ).toEqual([
      { label: "Sea Point", source: "recent" },
      { label: "Sea Point", source: "places" },
      { label: "Green Point, Sea Point", source: "in-view" },
    ]);
  });

  it("keeps server-ranked aliases and typo matches whose labels differ", () => {
    for (const query of ["Port Elizabeth", "Gqebhera"]) {
      const suggestions = buildLocationSuggestions({ query, recentSearches: [], placeSuggestions: [{ providerId: "geonames:964420", label: "Gqeberha", secondaryLabel: "Eastern Cape", target }], inViewCandidates: [] });
      expect(suggestions.map(s => s.label)).toEqual(["Gqeberha"]);
    }
  });

  it("shows only recent searches before a meaningful query exists", () => {
    expect(
      buildLocationSuggestions({
        query: "",
        recentSearches: ["Rosebank", "Sandton"],
        placeSuggestions: [{ providerId: "cape-town", label: "Cape Town", target }],
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
