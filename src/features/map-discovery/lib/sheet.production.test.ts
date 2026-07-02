// Feature: production-readiness-hardening, Property 12
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { SHEET_MAX_RATIO, SHEET_MIN_RATIO } from "./constants";
import { clampSheetHeight, resolveSheetDragSnap, snapToHeight } from "./sheet";

describe("production bottom-sheet bounds", () => {
  // Property 12: Bottom-sheet height always stays within bounds and snaps to a valid bound.
  // Validates: Requirements 6.12
  it("P12 clamps within [0.25*vh, 0.90*vh] and resolves drag release to one bound", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -10_000, max: 10_000, noNaN: true }),
        fc.double({ min: -10_000, max: 10_000, noNaN: true }),
        fc.double({ min: 240, max: 20_000, noNaN: true }),
        (startHeight, endHeight, vh) => {
          const min = SHEET_MIN_RATIO * vh;
          const max = Math.min(SHEET_MAX_RATIO * vh, vh - 140);
          const clamped = clampSheetHeight(endHeight, vh);

          expect(clamped).toBeGreaterThanOrEqual(min);
          expect(clamped).toBeLessThanOrEqual(max);

          const snap = resolveSheetDragSnap(startHeight, endHeight, vh);
          const resolved = snapToHeight(snap, vh);

          expect(["collapsed", "expanded"]).toContain(snap);
          expect(resolved === min || resolved === max).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
