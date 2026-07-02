import { describe, expect, it } from "vitest";

import { markerToCardIndex } from "./marker-sync";
import type { ListingCardModel } from "./types";

function card(id: string): ListingCardModel {
  return {
    id,
    title: id,
    imageUrls: [],
    price: 1,
    bedrooms: 1,
    bathrooms: 1,
    rating: null,
    reviewCount: null,
    distanceKm: null,
  };
}

describe("markerToCardIndex", () => {
  it("returns the first card index matching an activated marker id", () => {
    expect(markerToCardIndex([card("a"), card("b"), card("b")], "b")).toBe(1);
  });

  it("returns -1 when no card matches the marker id", () => {
    expect(markerToCardIndex([card("a")], "missing")).toBe(-1);
  });
});
