import { describe, expect, it } from "vitest";

import { shouldRequestInitialUserLocation } from "./search-recenter";

describe("search recenter requests", () => {
  it("does not make a prefilled search eligible for a later user-location recenter", () => {
    expect(shouldRequestInitialUserLocation({ searchQuery: "Cape Town" })).toBe(false);
    expect(shouldRequestInitialUserLocation({ initialCenter: { lat: -33.9, lng: 18.4 } })).toBe(false);
    expect(shouldRequestInitialUserLocation({ selectedListingId: "listing-1" })).toBe(false);
    expect(shouldRequestInitialUserLocation({ searchQuery: "" })).toBe(true);
  });
});
