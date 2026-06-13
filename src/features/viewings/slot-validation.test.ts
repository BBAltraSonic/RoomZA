import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { validateViewingSlot, validateViewingSlots } from "./slot-validation";

describe("viewing slot validation", () => {
  it("P3 accepts only parseable future slots with end after start", () => {
    const now = new Date("2026-06-03T10:00:00.000Z");
    fc.assert(
      fc.property(fc.integer({ min: -120, max: 240 }), fc.integer({ min: -60, max: 240 }), (startOffset, endOffset) => {
        const slot = {
          startTime: new Date(now.getTime() + startOffset * 60_000).toISOString(),
          endTime: new Date(now.getTime() + endOffset * 60_000).toISOString(),
        };
        const result = validateViewingSlot(slot, now);
        expect(result.valid).toBe(startOffset > 0 && endOffset > startOffset);
      }),
    );
  });

  it("collects errors across multiple slots", () => {
    const result = validateViewingSlots([{ startTime: "bad", endTime: "also bad" }], new Date());
    expect(result.valid).toBe(false);
  });
});
