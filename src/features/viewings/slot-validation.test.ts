import { describe, expect, it } from "vitest";

import { validateViewingSlot, validateViewingSlots } from "./slot-validation";

const now = new Date("2026-07-02T10:00:00.000Z");

describe("viewing slot validation", () => {
  it("accepts a future slot with an end time after its start", () => {
    expect(
      validateViewingSlot(
        {
          startTime: "2026-07-02T11:00:00.000Z",
          endTime: "2026-07-02T11:30:00.000Z",
        },
        now,
      ),
    ).toEqual({ valid: true });
  });

  it("reports invalid, past, and reversed times", () => {
    const result = validateViewingSlot(
      {
        startTime: "not-a-date",
        endTime: "2026-07-02T09:30:00.000Z",
      },
      now,
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContain("Start time is invalid.");
    }

    const reversed = validateViewingSlot(
      {
        startTime: "2026-07-02T12:00:00.000Z",
        endTime: "2026-07-02T11:30:00.000Z",
      },
      now,
    );

    expect(reversed.valid).toBe(false);
    if (!reversed.valid) {
      expect(reversed.errors).toContain("End time must be after start time.");
    }
  });

  it("prefixes errors by slot number for batched validation", () => {
    const result = validateViewingSlots(
      [
        { startTime: "2026-07-02T11:00:00.000Z", endTime: "2026-07-02T11:30:00.000Z" },
        { startTime: "2026-07-02T09:00:00.000Z", endTime: "2026-07-02T09:30:00.000Z" },
      ],
      now,
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toEqual(["Slot 2: Start time must be in the future."]);
    }
  });
});
