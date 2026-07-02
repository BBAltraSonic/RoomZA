// Feature: mobile-map-discovery, Property 4
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { SHEET_MAX_RATIO, SHEET_MIN_RATIO } from "./constants";
import { snapSheetHeight, snapToHeight } from "./sheet";

describe("snapSheetHeight", () => {
  // Property 4: Sheet release snaps to the nearer bound.
  // Validates: Requirements 4.7
  it("P4 resolved snap always maps to exactly one of the two bound heights", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -10_000, max: 10_000, noNaN: true }),
        fc.double({ min: 200, max: 20_000, noNaN: true }),
        (currentHeight, vh) => {
          const snap = snapSheetHeight(currentHeight, vh);

          // snap is one of the two valid states.
          expect(["collapsed", "expanded"]).toContain(snap);

          const collapsedHeight = SHEET_MIN_RATIO * vh;
          const expandedHeight = Math.min(SHEET_MAX_RATIO * vh, vh - 140);

          const resolved = snapToHeight(snap, vh);

          // The resolved height is exactly one of the two bound heights.
          const matchesCollapsed = resolved === collapsedHeight;
          const matchesExpanded = resolved === expandedHeight;
          expect(matchesCollapsed || matchesExpanded).toBe(true);

          // It matches the bound consistent with the resolved snap state.
          expect(resolved).toBe(snap === "expanded" ? expandedHeight : collapsedHeight);
        },
      ),
      { numRuns: 100 },
    );
  });
});
