import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyQuickFilter,
  parseQuickFilter,
  parseRecentlyViewed,
  RECENTLY_VIEWED_LIMIT,
  recordRecentlyViewed,
} from "./quick-filters";

const now = new Date("2026-07-16T12:00:00.000Z");
const listings = [
  { id: "a", createdAt: "2026-07-15T12:00:00.000Z", nsfasApproved: true, furnished: false },
  { id: "b", createdAt: "2026-07-10T12:00:00.000Z", nsfasApproved: false, furnished: true },
  { id: "c", createdAt: "2026-07-01T12:00:00.000Z", nsfasApproved: true, furnished: true },
];

describe("quick filters", () => {
  it("parses supported keys and treats NSFAS as rental-only", () => {
    expect(parseQuickFilter("furnished")).toBe("furnished");
    expect(parseQuickFilter("unknown")).toBe("all");
    expect(parseQuickFilter("nsfas-approved", "buy")).toBe("all");
  });

  it("filters NSFAS, favourites, fresh, and furnished listings", () => {
    expect(applyQuickFilter(listings, "nsfas-approved").map((item) => item.id)).toEqual(["a", "c"]);
    expect(applyQuickFilter(listings, "favourites", { favoriteIds: new Set(["b"]) }).map((item) => item.id)).toEqual(["b"]);
    expect(applyQuickFilter(listings, "recently-listed", { now: now.getTime() }).map((item) => item.id)).toEqual(["a", "b"]);
    expect(applyQuickFilter(listings, "furnished").map((item) => item.id)).toEqual(["b", "c"]);
  });

  it("orders recently viewed listings newest first", () => {
    const recentlyViewed = [
      { id: "c", viewedAt: "2026-07-16T11:00:00.000Z" },
      { id: "a", viewedAt: "2026-07-16T10:00:00.000Z" },
    ];
    expect(applyQuickFilter(listings, "recently-viewed", { recentlyViewed }).map((item) => item.id)).toEqual(["c", "a"]);
  });
});

describe("recently viewed history", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("rejects malformed entries and deduplicates IDs", () => {
    expect(parseRecentlyViewed('{"bad":true}')).toEqual([]);
    expect(parseRecentlyViewed(JSON.stringify([
      { id: "a", viewedAt: "2026-07-16T10:00:00.000Z" },
      { id: "a", viewedAt: "2026-07-16T09:00:00.000Z" },
      { id: "b", viewedAt: "not-a-date" },
    ]))).toEqual([{ id: "a", viewedAt: "2026-07-16T10:00:00.000Z" }]);
  });

  it("moves a repeated listing to the front and caps history", () => {
    const existing = Array.from({ length: RECENTLY_VIEWED_LIMIT }, (_, index) => ({
      id: `listing-${index}`,
      viewedAt: new Date(now.getTime() - index * 1000).toISOString(),
    }));
    const next = recordRecentlyViewed(existing, "listing-10", now.toISOString());
    expect(next).toHaveLength(RECENTLY_VIEWED_LIMIT);
    expect(next[0]?.id).toBe("listing-10");
    expect(next.filter((entry) => entry.id === "listing-10")).toHaveLength(1);
  });
});
