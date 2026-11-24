import { describe, expect, it } from "vitest";

import { whyItMatches } from "./top-picks";

const listing = {
  priceValue: 3800,
  beds: 1,
  furnished: true,
  nsfasApproved: true,
  propertyType: "room",
  area: "Bellville",
};

describe("whyItMatches", () => {
  it("should_explain_a_match_from_the_chips_only", () => {
    expect(
      whyItMatches(listing, [
        { kind: "maxPrice", value: 4000 },
        { kind: "quick", value: "furnished" },
        { kind: "quick", value: "nsfas-approved" },
        { kind: "type", value: "room" },
      ]),
    ).toBe("R3,800, under your R4,000 · Furnished · NSFAS approved · Room");
  });

  it("should_never_claim_a_match_the_listing_does_not_have", () => {
    expect(whyItMatches({ ...listing, furnished: false, priceValue: 4500 }, [
      { kind: "maxPrice", value: 4000 },
      { kind: "quick", value: "furnished" },
    ])).toBe("");
  });

  it("should_mention_bedrooms_and_the_named_place_when_it_matches", () => {
    expect(whyItMatches({ ...listing, beds: 2 }, [{ kind: "beds", value: 2 }, { kind: "near", value: "bellville" }])).toBe(
      "2 bedrooms · In Bellville",
    );
  });
});
