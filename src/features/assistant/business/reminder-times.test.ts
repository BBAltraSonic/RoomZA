import { describe, expect, it } from "vitest";

import { isDueBy, reminderDueAt, snoozedUntil } from "./reminder-times";

// Tuesday 24 November 2026, 10:00 in South Africa (08:00 UTC).
const TUESDAY_MORNING = new Date("2026-11-24T08:00:00Z");

describe("reminderDueAt", () => {
  it("should_use_17h00_today_in_south_african_time", () => {
    expect(reminderDueAt("today", TUESDAY_MORNING).toISOString()).toBe("2026-11-24T15:00:00.000Z");
  });

  it("should_use_an_hour_from_now_once_the_evening_has_passed", () => {
    const late = new Date("2026-11-24T19:30:00Z");
    expect(reminderDueAt("today", late).toISOString()).toBe("2026-11-24T20:30:00.000Z");
  });

  it("should_use_09h00_tomorrow", () => {
    expect(reminderDueAt("tomorrow", TUESDAY_MORNING).toISOString()).toBe("2026-11-25T07:00:00.000Z");
  });

  it("should_use_the_coming_monday_for_next_week", () => {
    expect(reminderDueAt("next-week", TUESDAY_MORNING).toISOString()).toBe("2026-11-30T07:00:00.000Z");
  });

  it("should_use_the_coming_friday_and_a_week_ahead_on_a_friday", () => {
    expect(reminderDueAt("friday", TUESDAY_MORNING).toISOString()).toBe("2026-11-27T07:00:00.000Z");
    const friday = new Date("2026-11-27T08:00:00Z");
    expect(reminderDueAt("friday", friday).toISOString()).toBe("2026-12-04T07:00:00.000Z");
  });

  it("should_use_the_south_african_day_just_after_midnight_there", () => {
    // 23:30 UTC on Monday is already 01:30 on Tuesday in South Africa.
    const justAfterMidnight = new Date("2026-11-23T23:30:00Z");
    expect(reminderDueAt("tomorrow", justAfterMidnight).toISOString()).toBe("2026-11-25T07:00:00.000Z");
  });
});

describe("snoozedUntil", () => {
  it("should_offer_tomorrow_and_next_week", () => {
    expect(snoozedUntil("tomorrow", TUESDAY_MORNING).toISOString()).toBe("2026-11-25T07:00:00.000Z");
    expect(snoozedUntil("next-week", TUESDAY_MORNING).toISOString()).toBe("2026-11-30T07:00:00.000Z");
  });
});

describe("isDueBy", () => {
  it("should_count_anything_due_before_the_end_of_today", () => {
    expect(isDueBy("2026-11-24T21:59:00Z", TUESDAY_MORNING)).toBe(true);
    expect(isDueBy("2026-11-20T07:00:00Z", TUESDAY_MORNING)).toBe(true);
    expect(isDueBy("2026-11-24T22:00:00Z", TUESDAY_MORNING)).toBe(false);
    expect(isDueBy("not a date", TUESDAY_MORNING)).toBe(false);
  });
});
