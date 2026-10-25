import { describe, expect, it } from "vitest";
import { formatViewingDay, formatViewingTime, viewingCalendarInstant, viewingTimeInput, viewingTimeInstant } from "./sast-time";

describe("property viewing times", () => {
  it("keeps 10:30 SAST through server rendering, editing and persistence", () => {
    expect(viewingTimeInput("2030-01-21T08:30:00Z")).toBe("2030-01-21T10:30");
    expect(viewingTimeInstant("2030-01-21T10:30")).toBe("2030-01-21T08:30:00.000Z");
    expect(viewingCalendarInstant(new Date(2030, 0, 21), "10:30")).toBe("2030-01-21T08:30:00.000Z");
    expect(formatViewingTime("2030-01-21T08:30:00Z")).toBe("10:30 SAST");
  });
  it("retains the selected South African calendar date across UTC midnight", () => {
    expect(viewingTimeInput("2030-01-20T22:30:00Z")).toBe("2030-01-21T00:30");
    expect(viewingTimeInstant("2030-01-21T00:30")).toBe("2030-01-20T22:30:00.000Z");
    expect(formatViewingDay("2030-01-20T22:30:00Z")).toBe("Jan 21");expect(formatViewingTime("2030-01-20T22:30:00Z")).toBe("00:30 SAST");
  });
  it("rejects missing, malformed and impossible dates/times without throwing", () => {
    expect(viewingTimeInput(null)).toBe("");expect(viewingTimeInput("invalid")).toBe("");
    for(const value of ["", "2030-02-30T10:30", "2030-01-21T25:00", "2030-01-21T10:99", "2030-01-21T10:30Z"]) expect(viewingTimeInstant(value)).toBeNull();
    expect(viewingCalendarInstant(new Date("invalid"), "10:30")).toBeNull();
    expect(formatViewingDay("invalid")).toBe("Date unavailable");expect(formatViewingTime("invalid")).toBe("Time unavailable");
  });
});
