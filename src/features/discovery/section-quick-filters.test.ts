import { describe, expect, it } from "vitest";

import {
  matchesSectionQuick,
  parseSectionQuick,
  sectionQuickLabel,
  SECTION_QUICK_FILTERS,
  tonightWindow,
  toggleSectionQuick,
  weekendWindow,
  type SectionQuickItem,
} from "./section-quick-filters";

// 2026-11-25 is a Wednesday. 10:00 UTC is 12:00 in South Africa.
const WEDNESDAY_NOON = new Date("2026-11-25T10:00:00Z");

function offer(overrides: Partial<{ endsAt: string; confirmedAt: string }> = {}): SectionQuickItem {
  return {
    kind: "offer",
    id: "offer-1",
    startsAt: "2026-11-20T08:00:00Z",
    endsAt: overrides.endsAt ?? "2026-11-30T20:00:00Z",
    publishedAt: overrides.confirmedAt ?? "2026-11-01T08:00:00Z",
  };
}

function event(overrides: Partial<{ startsAt: string; endsAt: string; live: boolean; priceCents: number; approvedAt: string }> = {}): SectionQuickItem {
  return {
    kind: "entry",
    id: "event-1",
    startsAt: overrides.startsAt ?? "2026-11-28T16:00:00Z",
    endsAt: overrides.endsAt ?? "2026-11-28T21:00:00Z",
    publishedAt: overrides.approvedAt ?? "2026-11-01T08:00:00Z",
    live: overrides.live ?? false,
    priceCents: overrides.priceCents,
  };
}

describe("parseSectionQuick", () => {
  it("should_keep_only_filters_that_belong_to_the_section", () => {
    expect(parseSectionQuick("tonight,ending-today,free", "event")).toEqual(["tonight", "free"]);
    expect(parseSectionQuick("ending-today,new-this-week", "shopping")).toEqual(["ending-today", "new-this-week"]);
    expect(parseSectionQuick("on-now,nonsense", "tourism")).toEqual([]);
  });

  it("should_return_nothing_for_an_empty_or_missing_value", () => {
    expect(parseSectionQuick(null, "event")).toEqual([]);
    expect(parseSectionQuick("", "tourism")).toEqual([]);
  });

  it("should_drop_duplicates", () => {
    expect(parseSectionQuick("free,free", "event")).toEqual(["free"]);
  });
});

describe("toggleSectionQuick", () => {
  it("should_add_a_filter_alongside_others", () => {
    expect(toggleSectionQuick(["tonight"], "free")).toEqual(["tonight", "free"]);
  });

  it("should_remove_a_filter_that_is_on", () => {
    expect(toggleSectionQuick(["tonight", "free"], "tonight")).toEqual(["free"]);
  });
});

describe("windows", () => {
  it("should_start_tonight_at_17_00_south_african_time", () => {
    const window = tonightWindow(WEDNESDAY_NOON);
    expect(window.start.toISOString()).toBe("2026-11-25T15:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-11-25T22:00:00.000Z");
  });

  it("should_start_tonight_now_when_it_is_already_evening", () => {
    const evening = new Date("2026-11-25T18:30:00Z");
    expect(tonightWindow(evening).start.toISOString()).toBe(evening.toISOString());
  });

  it("should_run_this_weekend_from_friday_evening_to_sunday_night", () => {
    const window = weekendWindow(WEDNESDAY_NOON);
    expect(window.start.toISOString()).toBe("2026-11-27T15:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-11-29T22:00:00.000Z");
  });

  it("should_start_this_weekend_now_when_it_is_already_the_weekend", () => {
    const saturday = new Date("2026-11-28T09:00:00Z");
    const window = weekendWindow(saturday);
    expect(window.start.toISOString()).toBe(saturday.toISOString());
    expect(window.end.toISOString()).toBe("2026-11-29T22:00:00.000Z");
  });
});

describe("matchesSectionQuick", () => {
  const context = { now: WEDNESDAY_NOON };

  it("should_match_specials_ending_before_midnight_today", () => {
    expect(matchesSectionQuick(offer({ endsAt: "2026-11-25T21:59:00Z" }), "ending-today", context)).toBe(true);
    expect(matchesSectionQuick(offer({ endsAt: "2026-11-25T22:30:00Z" }), "ending-today", context)).toBe(false);
  });

  it("should_match_specials_published_in_the_last_seven_days", () => {
    expect(matchesSectionQuick(offer({ confirmedAt: "2026-11-20T10:00:00Z" }), "new-this-week", context)).toBe(true);
    expect(matchesSectionQuick(offer({ confirmedAt: "2026-11-17T10:00:00Z" }), "new-this-week", context)).toBe(false);
  });

  it("should_match_events_that_are_on_now", () => {
    expect(matchesSectionQuick(event({ live: true }), "on-now", context)).toBe(true);
    expect(matchesSectionQuick(event({ live: false }), "on-now", context)).toBe(false);
  });

  it("should_match_events_that_overlap_tonight", () => {
    expect(matchesSectionQuick(event({ startsAt: "2026-11-25T17:00:00Z", endsAt: "2026-11-25T20:00:00Z" }), "tonight", context)).toBe(true);
    expect(matchesSectionQuick(event({ startsAt: "2026-11-25T06:00:00Z", endsAt: "2026-11-25T09:00:00Z" }), "tonight", context)).toBe(false);
  });

  it("should_match_events_that_overlap_this_weekend", () => {
    expect(matchesSectionQuick(event(), "this-weekend", context)).toBe(true);
    expect(matchesSectionQuick(event({ startsAt: "2026-11-25T16:00:00Z", endsAt: "2026-11-25T20:00:00Z" }), "this-weekend", context)).toBe(false);
  });

  it("should_match_only_events_priced_at_zero_as_free", () => {
    expect(matchesSectionQuick(event({ priceCents: 0 }), "free", context)).toBe(true);
    expect(matchesSectionQuick(event({ priceCents: 5000 }), "free", context)).toBe(false);
    expect(matchesSectionQuick(event({}), "free", context)).toBe(false);
  });

});

describe("labels", () => {
  it("should_label_every_filter_in_every_section", () => {
    for (const keys of Object.values(SECTION_QUICK_FILTERS)) {
      for (const key of keys) expect(sectionQuickLabel(key)).toMatch(/\w/);
    }
  });
});
