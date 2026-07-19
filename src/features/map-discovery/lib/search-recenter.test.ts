import { describe, expect, it } from "vitest";

import {
  buildPlaceRecenterRequest,
  shouldRequestInitialUserLocation,
} from "./search-recenter";

describe("place search recenter requests", () => {
  it("builds a place-id request for a selected Google suggestion", () => {
    expect(buildPlaceRecenterRequest(" cape-town-place ")).toEqual({
      placeId: "cape-town-place",
    });
  });

  it("does not create a recenter request for plain text without a place id", () => {
    expect(buildPlaceRecenterRequest(undefined)).toBeNull();
    expect(buildPlaceRecenterRequest("   ")).toBeNull();
  });

  it("does not make a prefilled search eligible for a later user-location recenter", () => {
    expect(shouldRequestInitialUserLocation({ searchQuery: "Cape Town" })).toBe(false);
    expect(shouldRequestInitialUserLocation({ initialCenter: { lat: -33.9, lng: 18.4 } })).toBe(false);
    expect(shouldRequestInitialUserLocation({ selectedListingId: "listing-1" })).toBe(false);
    expect(shouldRequestInitialUserLocation({ searchQuery: "" })).toBe(true);
  });
});
