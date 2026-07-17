import { describe, expect, it } from "vitest";

import {
  LISTING_SEARCH_QUERY_MAX_LENGTH,
  limitListingSearchDraft,
  normalizeListingSearchQuery,
} from "./search-query";

describe("listing search query normalization", () => {
  it("trims and collapses whitespace for committed queries", () => {
    expect(normalizeListingSearchQuery("  Sea   Point \n studio  ")).toBe("Sea Point studio");
  });

  it("limits committed and draft queries to 120 characters", () => {
    const query = "x".repeat(LISTING_SEARCH_QUERY_MAX_LENGTH + 25);

    expect(normalizeListingSearchQuery(query)).toHaveLength(LISTING_SEARCH_QUERY_MAX_LENGTH);
    expect(limitListingSearchDraft(query)).toHaveLength(LISTING_SEARCH_QUERY_MAX_LENGTH);
  });

  it("normalizes missing queries to an empty string", () => {
    expect(normalizeListingSearchQuery(null)).toBe("");
    expect(normalizeListingSearchQuery(undefined)).toBe("");
  });
});
