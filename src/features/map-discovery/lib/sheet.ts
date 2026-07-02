// Bottom_Sheet clamp/snap pure math for the Mobile_Map_Discovery feature.
// See .kiro/specs/mobile-map-discovery/design.md (Bottom_Sheet section,
// Correctness Properties 3 and 4).

import { SHEET_MAX_RATIO, SHEET_MIN_RATIO } from "./constants";

/** Snap state of the Bottom_Sheet. */
export type SheetSnap = "collapsed" | "expanded";
export const SHEET_DRAG_THRESHOLD_RATIO = 0.25;

/**
 * Clamp a candidate Bottom_Sheet height to the valid range
 * `[SHEET_MIN_RATIO * vh, SHEET_MAX_RATIO * vh]` (Req 4.4, 4.5, 4.6).
 *
 * Candidates below the minimum clamp up to the min bound, candidates above the
 * maximum clamp down to the max bound, and in-range candidates pass through.
 */
export function clampSheetHeight(candidate: number, vh: number): number {
  const min = SHEET_MIN_RATIO * vh;
  const max = Math.min(SHEET_MAX_RATIO * vh, vh - 140);
  if (candidate < min) return min;
  if (candidate > max) return max;
  return candidate;
}

/**
 * Resolve the snap state for a released Bottom_Sheet height (Req 4.7).
 *
 * Returns `"expanded"` when the height is at or above the midpoint of the
 * collapsed (25%) and expanded (90%) bound heights, otherwise `"collapsed"`.
 */
export function snapSheetHeight(currentHeight: number, vh: number): SheetSnap {
  const min = SHEET_MIN_RATIO * vh;
  const max = Math.min(SHEET_MAX_RATIO * vh, vh - 140);
  const midpoint = (min + max) / 2;
  return currentHeight >= midpoint ? "expanded" : "collapsed";
}

/**
 * Resolve a snap state to its concrete Bottom_Sheet bound height (Req 4.7).
 *
 * `"collapsed"` maps to `SHEET_MIN_RATIO * vh` and `"expanded"` maps to
 * `SHEET_MAX_RATIO * vh`.
 */
export function snapToHeight(snap: SheetSnap, vh: number): number {
  if (snap === "expanded") {
    // Prevent expanded sheet from overlapping the top SearchRegion (approx 140px from top)
    return Math.min(SHEET_MAX_RATIO * vh, vh - 140);
  }
  return SHEET_MIN_RATIO * vh;
}

/**
 * Resolve drag release to a snap state when the pointer moves beyond 25% of
 * the valid sheet travel. Smaller drags fall back to the nearest snap bound.
 */
export function resolveSheetDragSnap(startHeight: number, endHeight: number, vh: number): SheetSnap {
  const min = SHEET_MIN_RATIO * vh;
  const max = Math.min(SHEET_MAX_RATIO * vh, vh - 140);
  const travel = Math.max(max - min, 1);
  const delta = clampSheetHeight(endHeight, vh) - clampSheetHeight(startHeight, vh);
  const threshold = travel * SHEET_DRAG_THRESHOLD_RATIO;

  if (delta >= threshold) return "expanded";
  if (delta <= -threshold) return "collapsed";

  return snapSheetHeight(endHeight, vh);
}
