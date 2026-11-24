import { describe, expect, it } from "vitest";

import { funnelSteps, median, statTiles, suggestions, type ListingFunnel } from "./performance";
import type { QualityIssue } from "./quality";

const funnel = (overrides: Partial<ListingFunnel> = {}): ListingFunnel => ({
  listingId: "L1",
  title: "Room",
  price: 5000,
  photoCount: 3,
  counts: { views: 40, enquiries: 0, viewings: 0, applications: 0 },
  ...overrides,
});

describe("statTiles", () => {
  it("should_total_the_funnel_and_show_reply_time", () => {
    const tiles = statTiles([funnel(), funnel({ listingId: "L2", counts: { views: 10, enquiries: 2, viewings: 1, applications: 1 } })], 5400);
    expect(tiles.map((tile) => `${tile.label}=${tile.value}`)).toEqual(["Views (30 days)=50", "Enquiries=2", "Viewings=1", "Applications=1", "Typical reply time=2 h"]);
  });

  it("should_say_a_total_failed_instead_of_undercounting", () => {
    const tiles = statTiles([funnel({ counts: { views: null, enquiries: 1, viewings: 0, applications: 0 } })], null);
    expect(tiles[0]).toEqual({ label: "Views (30 days)", value: "—", note: "Couldn't load" });
    expect(tiles[4]!.note).toBe("Not enough replies yet");
  });
});

describe("suggestions", () => {
  it("should_give_one_action_per_suggestion", () => {
    const issues = new Map<string, QualityIssue[]>([["L1", [{ key: "no-viewing-hours", severity: "helpful", message: "", fix: "Set viewing hours", href: "/dashboard/listings/L1/edit" }]]]);
    const nearby = new Map([["L1", { listingId: "L1", similarCount: 6, medianPrice: 4200, medianPhotos: 8 }]]);
    const result = suggestions([funnel()], issues, nearby);
    expect(result.map((item) => [item.message, item.action])).toEqual([
      ["No viewing hours set, so people can't book a time", "Set viewing hours"],
      ["3 photos; similar listings nearby have about 8", "Add photos"],
      ["40 views but no enquiries yet. Similar listings nearby ask about R4,200.", "Review listing"],
    ]);
  });

  it("should_stay_quiet_when_a_listing_is_doing_fine", () => {
    expect(suggestions([funnel({ photoCount: 10, counts: { views: 40, enquiries: 4, viewings: 2, applications: 1 } })], new Map(), new Map())).toEqual([]);
  });
});

describe("helpers", () => {
  it("should_list_funnel_steps_in_order", () => {
    expect(funnelSteps({ views: 1, enquiries: 2, viewings: 3, applications: 4 }).map((step) => step.label)).toEqual(["Views", "Enquiries", "Viewings", "Applications"]);
  });

  it("should_take_the_median", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(3);
    expect(median([])).toBeNull();
  });
});
