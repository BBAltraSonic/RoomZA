import { describe, expect, it } from "vitest";

import { countNewSince } from "./welcome-back";

describe("countNewSince", () => {
  const listings = [
    { createdAt: "2026-11-20T08:00:00Z" },
    { createdAt: "2026-11-22T08:00:00Z" },
    { createdAt: "2026-11-23T09:30:00Z" },
    { createdAt: null },
    { createdAt: "not a date" },
  ];

  it("should_count_listings_added_after_the_last_search", () => {
    expect(countNewSince(listings, "2026-11-21T00:00:00Z")).toBe(2);
  });

  it("should_not_count_a_listing_added_at_the_same_moment", () => {
    expect(countNewSince(listings, "2026-11-23T09:30:00Z")).toBe(0);
  });

  it("should_count_nothing_for_an_unreadable_date", () => {
    expect(countNewSince(listings, "yesterday")).toBe(0);
  });
});
