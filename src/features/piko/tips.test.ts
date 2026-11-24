import { describe, expect, it } from "vitest";

import { pikoTip } from "./tips";

// 10:00 on 24 November 2026 in Johannesburg.
const NOW = new Date("2026-11-24T08:00:00Z");

describe("pikoTip", () => {
  it("should_say_when_an_item_ends_today", () => {
    expect(pikoTip({ now: NOW, endsAt: "2026-11-24T15:00:00Z" })).toBe("Ends today at 17:00");
  });

  it("should_not_say_ends_today_for_tomorrow_or_after_it_has_ended", () => {
    expect(pikoTip({ now: NOW, endsAt: "2026-11-25T15:00:00Z" })).toBeNull();
    expect(pikoTip({ now: NOW, endsAt: "2026-11-24T07:00:00Z" })).toBeNull();
  });

  it("should_give_a_rounded_amount_below_similar_items_nearby", () => {
    expect(pikoTip({ now: NOW, belowNearby: { amount: 612, peers: "rooms" } })).toBe("R600 below similar rooms nearby");
    expect(pikoTip({ now: NOW, belowNearby: { amount: 148_700, peers: "homes" } })).toBe("R149,000 below similar homes nearby");
  });

  it("should_skip_a_below_nearby_amount_that_rounds_to_nothing", () => {
    expect(pikoTip({ now: NOW, belowNearby: { amount: 20, peers: "rooms" } })).toBeNull();
  });

  it("should_say_new_this_week_for_a_recent_item", () => {
    expect(pikoTip({ now: NOW, publishedAt: "2026-11-22T08:00:00Z" })).toBe("New this week");
    expect(pikoTip({ now: NOW, publishedAt: "2026-11-10T08:00:00Z" })).toBeNull();
  });

  it("should_give_only_one_tip_most_urgent_first", () => {
    const all = { now: NOW, endsAt: "2026-11-24T15:00:00Z", publishedAt: "2026-11-22T08:00:00Z", belowNearby: { amount: 600, peers: "rooms" } };
    expect(pikoTip(all)).toBe("Ends today at 17:00");
    expect(pikoTip({ ...all, endsAt: undefined })).toBe("R600 below similar rooms nearby");
  });
});
