import { describe, expect, it, vi } from "vitest";

import type { PublicEntry } from "@/features/entries/public-contract";

import { countSectionMatches, type SectionCountContext } from "./section-match-count";

const coordinates = { areaId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", address: "10 Fixture Road", latitude: -33.9, longitude: 18.4 };
// 10:00 on 24 November 2026 in Johannesburg.
const NOW = new Date("2026-11-24T08:00:00Z");

function event(id: string, priceCents: number | undefined, title = "Jazz night"): PublicEntry {
  return {
    entryId: id, category: "event", approvedAt: "2026-11-20T08:00:00Z", state: "upcoming",
    content: { ...coordinates, title, description: "Live music", venueName: "Fixture park", startsAt: "2026-11-24T17:00:00Z", endsAt: "2026-11-24T20:00:00Z", priceCents },
  };
}

function context(overrides: Partial<SectionCountContext> = {}): SectionCountContext {
  return {
    query: "jazz",
    serviceType: "All services",
    items: [event("e1", 0), event("e2", 5000), event("e3", 0)],
    now: NOW,
    openNowIds: null,
    belowNearbyIds: new Set(),
    fetchItems: vi.fn(async () => null),
    belowNearbyFor: () => new Set(),
    ...overrides,
  };
}

describe("countSectionMatches", () => {
  it("should_count_a_quick_filter_change_on_the_device_without_fetching", async () => {
    const ctx = context();
    await expect(countSectionMatches({ quick: ["free"], nearest: false, text: "jazz" }, ctx)).resolves.toBe(2);
    await expect(countSectionMatches({ quick: [], nearest: false, text: "jazz" }, ctx)).resolves.toBe(3);
    expect(ctx.fetchItems).not.toHaveBeenCalled();
  });

  it("should_fetch_the_feed_when_the_words_change_and_keep_the_quick_filters", async () => {
    const fetchItems = vi.fn(async () => [event("e1", 0), event("e4", 0, "Choir"), event("e5", 9000, "Choir")]);
    const ctx = context({ fetchItems });
    await expect(countSectionMatches({ quick: ["free"], nearest: false, text: "" }, ctx)).resolves.toBe(2);
    expect(fetchItems).toHaveBeenCalledWith("", "All services");
  });

  it("should_fetch_when_the_service_type_changes", async () => {
    const fetchItems = vi.fn(async () => []);
    await countSectionMatches({ quick: [], nearest: false, text: "" }, context({ query: "", serviceType: "Plumbing", items: [], fetchItems }));
    expect(fetchItems).toHaveBeenCalledWith("", "All services");
  });

  it("should_return_null_when_the_feed_cannot_be_read", async () => {
    await expect(countSectionMatches({ quick: [], nearest: false, text: "" }, context())).resolves.toBeNull();
    await expect(countSectionMatches({ quick: ["free"], nearest: false, text: "jazz" }, context({ items: undefined }))).resolves.toBeNull();
  });
});
