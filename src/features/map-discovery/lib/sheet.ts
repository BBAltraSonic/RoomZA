// Bottom_Sheet clamp/snap pure math for the Mobile_Map_Discovery feature.
//
// The sheet has two positions: Browse (the lowest it goes) and Full List. A
// drag release resolves magnetically by projecting the release position
// forward by the fling velocity, then snaps to the nearest position.
// See .kiro/specs/mobile-map-discovery/design.md (Bottom_Sheet section).

import { SHEET_BROWSE_RATIO, SHEET_MAX_RATIO, SHEET_TOP_INSET } from "./constants";

/** User-facing Bottom_Sheet mode, ordered smallest → largest. */
export type SheetSnap = "browse" | "full";

/** Ordered list of modes (smallest height → largest). */
export const SHEET_SNAP_ORDER: readonly SheetSnap[] = ["browse", "full"] as const;

/**
 * Fling speed (px/ms of sheet growth) treated as intentional. Below this the
 * release is dominated by position; above it, the projection carries the sheet
 * meaningfully toward the fling direction.
 */
export const SHEET_FLING_VELOCITY = 0.35;

/**
 * How many milliseconds of travel a fling projects forward. The release
 * position is advanced by `velocity * SHEET_PROJECTION_MS` before snapping,
 * giving the "flick to fully open / close" feel of native sheets.
 */
export const SHEET_PROJECTION_MS = 220;

/**
 * Full List height in px, capped to retain a narrow strip of map context.
 */
export function fullHeight(vh: number): number {
  return Math.min(SHEET_MAX_RATIO * vh, vh - SHEET_TOP_INSET);
}

/**
 * Browse height in px — the sheet's lowest resting point. Capped at Full so
 * the two positions stay ordered even on very short viewports.
 */
export function browseHeight(vh: number): number {
  return Math.min(SHEET_BROWSE_RATIO * vh, fullHeight(vh));
}

/** Concrete px height for each snap position at the given viewport height. */
export function snapHeights(vh: number): Record<SheetSnap, number> {
  return {
    browse: browseHeight(vh),
    full: fullHeight(vh),
  };
}

/**
 * Clamp a candidate height to the valid range `[browse, full]`.
 * Below-range clamps up, above-range clamps down, in-range passes through.
 */
export function clampSheetHeight(candidate: number, vh: number): number {
  const min = browseHeight(vh);
  const max = fullHeight(vh);
  if (candidate < min) return min;
  if (candidate > max) return max;
  return candidate;
}

/**
 * Apply bounded rubber-band resistance while dragging beyond a sheet limit.
 * Release resolution still clamps to a valid snap; this only affects the live
 * visual response so the sheet feels elastic without escaping its viewport.
 */
export function rubberBandSheetHeight(candidate: number, vh: number, resistance = 0.18): number {
  const min = browseHeight(vh);
  const max = fullHeight(vh);
  const boundedResistance = Math.min(Math.max(resistance, 0), 0.35);
  if (candidate < min) return min - (min - candidate) * boundedResistance;
  if (candidate > max) return max + (candidate - max) * boundedResistance;
  return candidate;
}

/** Resolve a snap position to its concrete px height. */
export function snapToHeight(snap: SheetSnap, vh: number): number {
  return snapHeights(vh)[snap] ?? browseHeight(vh);
}

/**
 * Magnetic snap: return the position whose height is nearest to `height`.
 * Ties resolve toward the larger position (prefer showing more content).
 */
export function nearestSnap(height: number, vh: number): SheetSnap {
  const heights = snapHeights(vh);
  let best: SheetSnap = "browse";
  let bestDist = Infinity;
  for (const snap of SHEET_SNAP_ORDER) {
    const dist = Math.abs(height - heights[snap]);
    // `<=` biases toward later (larger) positions on ties.
    if (dist <= bestDist) {
      bestDist = dist;
      best = snap;
    }
  }
  return best;
}

/**
 * Resolve a drag release to a snap position using iOS-style velocity
 * projection: advance the release height by the fling velocity, then snap to
 * the nearest position. A slow release (velocity ~0) simply snaps to the
 * nearest position; a fast flick carries to the position in its direction.
 *
 * @param endHeight The sheet height (px) at the moment of release.
 * @param velocity  Sheet-growth speed in px/ms (positive = growing/upward).
 * @param vh        Viewport height in px.
 */
export function resolveSheetRelease(endHeight: number, velocity: number, vh: number): SheetSnap {
  const projected = clampSheetHeight(endHeight + velocity * SHEET_PROJECTION_MS, vh);
  return nearestSnap(projected, vh);
}

/** Step to the adjacent snap position (used for keyboard / tap toggling). */
export function stepSnap(current: SheetSnap, direction: "up" | "down"): SheetSnap {
  const idx = SHEET_SNAP_ORDER.indexOf(current);
  const nextIdx = direction === "up" ? idx + 1 : idx - 1;
  const clamped = Math.min(Math.max(nextIdx, 0), SHEET_SNAP_ORDER.length - 1);
  return SHEET_SNAP_ORDER[clamped] ?? current;
}

/**
 * Read a persisted snap, mapping retired positions ("peek" and the older
 * "collapsed" / "half" / "expanded" names) onto the two current ones.
 */
export function parseStoredSnap(saved: string | null): SheetSnap | null {
  switch (saved) {
    case "browse":
    case "peek":
    case "collapsed":
    case "half":
      return "browse";
    case "full":
    case "expanded":
      return "full";
    default:
      return null;
  }
}
