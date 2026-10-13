import { describe, expect, it } from "vitest";
import { entryCategorySchema, entryWindowState, formatEntryTimeSast, parseEntrySubmission } from "./schema";

const now = Date.parse("2026-10-04T06:00:00Z");
const starts = Date.parse("2026-10-04T08:00:00Z"), ends = Date.parse("2026-10-04T10:00:00Z");
export const content = {
  mediaIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab"], mediaRightsConfirmed: true,
  title: "Synthetic experience", description: "Synthetic continuous venue availability",
  venueName: "Synthetic venue", areaId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  address: "Synthetic address", latitude: -33.9, longitude: 18.4,
  startsAt: "2026-10-04T10:00:00+02:00", endsAt: "2026-10-04T12:00:00+02:00",
};

describe("Tourism/Event content and exact-time contracts", () => {
  it("normalizes SAST bounds to UTC and trims text", () => {
    expect(parseEntrySubmission({ ...content, title: "  Venue  " }, now)).toMatchObject({
      title: "Venue", startsAt: "2026-10-04T08:00:00.000Z", endsAt: "2026-10-04T10:00:00.000Z",
    });
  });
  it.each([
    { title: " " }, { description: "" }, { venueName: "" }, { address: "" },
    { areaId: "geocoder.rondebosch" }, { latitude: Infinity }, { longitude: 181 },
    { startsAt: "2026-10-04" }, { startsAt: "2026-10-04T10:00:00" }, { endsAt: "invalid" },
    { startsAt: content.endsAt }, { startsAt: "2026-10-04T13:00:00+02:00" },
    { weeklyRecurrence: [] }, { canReview: true }, { imageUrl: "https://example.invalid/image.png" },
  ])("rejects invalid bounds, incomplete fields and unsupported claims: %j", (invalid) => {
    expect(() => parseEntrySubmission({ ...content, ...invalid }, now)).toThrow();
  });
  it("rejects missing bounds, ended submissions and invalid clocks", () => {
    expect(() => parseEntrySubmission({ title: content.title }, now)).toThrow();
    expect(() => parseEntrySubmission(content, ends)).toThrow("future");
    expect(() => parseEntrySubmission(content, NaN)).toThrow("clock");
  });
  it("includes the exact start and excludes the exact end, retaining a scheduled state", () => {
    const parsed = parseEntrySubmission(content, now);
    expect(entryWindowState(parsed, starts - 1)).toBe("scheduled");
    expect(entryWindowState(parsed, starts)).toBe("available");
    expect(entryWindowState(parsed, ends - 1)).toBe("available");
    expect(entryWindowState(parsed, ends)).toBe("ended");
    expect(entryWindowState(parsed, Infinity)).toBe("unavailable");
  });
  it("labels the actual South African time zone independently of host locale", () => {
    expect(formatEntryTimeSast("2026-10-04T08:00:09Z")).toContain("10:00 SAST");
    expect(() => formatEntryTimeSast("2026-10-04")).toThrow();
  });
  it("accepts only the two new categories", () => {
    expect(entryCategorySchema.parse("tourism")).toBe("tourism");
    expect(entryCategorySchema.parse("event")).toBe("event");
    expect(() => entryCategorySchema.parse("shopping_offers")).toThrow();
  });
});
