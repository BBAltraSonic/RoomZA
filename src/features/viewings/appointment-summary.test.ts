import { describe, expect, it } from "vitest";
import { availableViewingSlots, singleSlot } from "./appointment-summary";

describe("viewing invitation availability", () => {
  it("normalizes nullable and array relationship results", () => {
    expect(singleSlot(null)).toBeNull();
    expect(singleSlot([])).toBeNull();
  });
  it("excludes past, invalid and booked slots and sorts remaining invitations", () => {
    const slot = { id: "first", start_time: "2027-01-20T10:00:00Z", end_time: "2027-01-20T11:00:00Z" };
    expect(availableViewingSlots([
      { slot: { ...slot, id: "later", start_time: "2027-01-21T10:00:00Z" } },
      { slot: [{ ...slot }] }, { slot: { ...slot, is_booked: true } },
      { slot: { ...slot, start_time: "invalid" } },
      { slot: { ...slot, start_time: "2026-01-01T10:00:00Z" } }, { slot: null },
    ], Date.parse("2027-01-19T00:00:00Z")).map(row => row.id)).toEqual(["first", "later"]);
  });
});
