import { describe, expect, it } from "vitest";

import {
  calendarDays,
  describeLandlordAvailability,
  formatSlotDay,
  formatSlotRequest,
  formatSlotTime,
  groupSlotsByDay,
  minutesToTime,
  timeToMinutes,
  validateViewingHours,
} from "./viewing-availability";

// 2030-01-08 is a Tuesday. 12:30 UTC is 14:30 in South Africa (UTC+2, no DST).
const tue1430 = { start: "2030-01-08T12:30:00.000Z", end: "2030-01-08T13:00:00.000Z" };
const tue1500 = { start: "2030-01-08T13:00:00.000Z", end: "2030-01-08T13:30:00.000Z" };
const wed0900 = { start: "2030-01-09T07:00:00.000Z", end: "2030-01-09T07:30:00.000Z" };
// 22:30 UTC on Tuesday is already 00:30 on Wednesday in South Africa.
const wed0030 = { start: "2030-01-08T22:30:00.000Z", end: "2030-01-08T23:00:00.000Z" };

describe("describeLandlordAvailability", () => {
  it("should_say_the_landlord_can_meet_within_15_minutes_when_available_inside_their_hours", () => {
    const result = describeLandlordAvailability({ presence: "available", hasHours: true, inHoursNow: true, nextSlot: null });
    expect(result).toMatchObject({ tone: "available", canMeetSoon: true, label: "Available now" });
    expect(result.detail).toBe("Can meet you at the property within 15 minutes.");
  });

  it("should_treat_an_available_landlord_without_set_hours_as_able_to_meet_soon", () => {
    expect(describeLandlordAvailability({ presence: "available", hasHours: false, inHoursNow: false, nextSlot: null }).canMeetSoon).toBe(true);
  });

  it("should_not_promise_15_minutes_when_online_but_outside_viewing_hours", () => {
    const result = describeLandlordAvailability({ presence: "available", hasHours: true, inHoursNow: false, nextSlot: tue1430.start });
    expect(result).toMatchObject({ tone: "busy", canMeetSoon: false, label: "Online, outside viewing hours" });
    expect(result.detail).toBe("Next open time: Tue 8 Jan at 14:30.");
  });

  it("should_warn_that_a_recently_active_landlord_may_not_make_it", () => {
    const result = describeLandlordAvailability({ presence: "busy", hasHours: true, inHoursNow: true, nextSlot: null });
    expect(result).toMatchObject({ tone: "busy", canMeetSoon: false, label: "Recently active" });
  });

  it("should_point_an_offline_landlords_renters_to_the_calendar_or_messages", () => {
    const withHours = describeLandlordAvailability({ presence: "offline", hasHours: true, inHoursNow: true, nextSlot: null });
    const withoutHours = describeLandlordAvailability({ presence: null, hasHours: false, inHoursNow: false, nextSlot: null });
    expect(withHours).toMatchObject({ tone: "offline", canMeetSoon: false, label: "Offline" });
    expect(withHours.detail).toMatch(/Book one of their viewing times below/);
    expect(withoutHours.detail).toMatch(/Send a message to agree a time/);
  });
});

describe("groupSlotsByDay", () => {
  it("should_group_slots_by_south_african_calendar_day_in_order", () => {
    const days = groupSlotsByDay([wed0900, tue1500, tue1430, wed0030]);
    expect(days.map(day => day.key)).toEqual(["2030-01-08", "2030-01-09"]);
    expect(days[0]?.slots).toEqual([tue1430, tue1500]);
    expect(days[1]?.slots).toEqual([wed0030, wed0900]);
  });

  it("should_drop_slots_with_unreadable_times", () => {
    expect(groupSlotsByDay([{ start: "nope", end: "nope" }, tue1430]).flatMap(day => day.slots)).toEqual([tue1430]);
  });
});

describe("calendarDays", () => {
  it("should_fill_days_without_open_times_so_the_strip_reads_as_a_calendar", () => {
    const fri0900 = { start: "2030-01-11T07:00:00.000Z", end: "2030-01-11T07:30:00.000Z" };
    const days = calendarDays([tue1430, fri0900]);
    expect(days.map(day => [day.key, day.weekday, day.day, day.month, day.slots.length])).toEqual([
      ["2030-01-08", "Tue", "8", "Jan", 1],
      ["2030-01-09", "Wed", "9", "Jan", 0],
      ["2030-01-10", "Thu", "10", "Jan", 0],
      ["2030-01-11", "Fri", "11", "Jan", 1],
    ]);
  });

  it("should_return_no_days_without_slots", () => {
    expect(calendarDays([])).toEqual([]);
  });
});

describe("slot labels", () => {
  it("should_format_slots_in_south_african_time", () => {
    expect(formatSlotTime(tue1430.start)).toBe("14:30");
    expect(formatSlotDay(tue1430.start)).toEqual({ weekday: "Tue", day: "8", month: "Jan" });
    expect(formatSlotRequest(wed0030.start)).toBe("Wed 9 Jan at 00:30");
  });
});

describe("viewing hours", () => {
  it("should_convert_between_minutes_and_clock_times", () => {
    expect(timeToMinutes("09:30")).toBe(570);
    expect(timeToMinutes("24:00")).toBe(1440);
    expect(timeToMinutes("9:30")).toBeNull();
    expect(timeToMinutes("25:00")).toBeNull();
    expect(minutesToTime(570)).toBe("09:30");
    expect(minutesToTime(1440)).toBe("24:00");
  });

  it("should_accept_one_window_per_weekday_that_fits_at_least_one_slot", () => {
    const result = validateViewingHours([{ weekday: 2, startMinute: 1020, endMinute: 1140 }, { weekday: 6, startMinute: 600, endMinute: 780 }]);
    expect(result).toEqual({ ok: true, hours: [{ weekday: 2, startMinute: 1020, endMinute: 1140 }, { weekday: 6, startMinute: 600, endMinute: 780 }] });
  });

  it("should_reject_windows_that_end_before_a_30_minute_slot_fits", () => {
    expect(validateViewingHours([{ weekday: 1, startMinute: 600, endMinute: 620 }])).toEqual({ ok: false, error: "Each day needs at least 30 minutes between start and end." });
  });

  it("should_reject_duplicate_weekdays_and_out_of_range_values", () => {
    expect(validateViewingHours([{ weekday: 1, startMinute: 600, endMinute: 700 }, { weekday: 1, startMinute: 800, endMinute: 900 }]).ok).toBe(false);
    expect(validateViewingHours([{ weekday: 7, startMinute: 600, endMinute: 700 }]).ok).toBe(false);
    expect(validateViewingHours([{ weekday: 1, startMinute: -30, endMinute: 700 }]).ok).toBe(false);
  });

  it("should_align_windows_to_whole_half_hours", () => {
    expect(validateViewingHours([{ weekday: 1, startMinute: 605, endMinute: 700 }])).toEqual({ ok: false, error: "Use times on the hour or half hour." });
  });
});
