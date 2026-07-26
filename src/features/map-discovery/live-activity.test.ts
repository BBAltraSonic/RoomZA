import { describe, expect, it } from "vitest";

import {
  roundedActivityCount,
  selectLiveActivitySignals,
} from "./live-activity";

describe("live activity", () => {
  it("rounds public counts and hides weak social proof", () => {
    expect(roundedActivityCount(12)).toBe(10);
    expect(selectLiveActivitySignals({
      viewedToday: 3,
      viewingNow: 1,
      lastScheduledAt: null,
      lastRentedAt: null,
    })).toEqual([]);
  });

  it("returns bounded anonymised signals", () => {
    const now = Date.parse("2026-07-23T18:00:00.000Z");
    expect(selectLiveActivitySignals({
      viewedToday: 12,
      viewingNow: 3,
      lastScheduledAt: "2026-07-23T17:30:00.000Z",
      lastRentedAt: null,
    }, now)).toEqual([
      { kind: "viewing_now", label: "A few people are viewing now" },
      { kind: "viewed_today", label: "About 10 views today" },
    ]);
  });
});
