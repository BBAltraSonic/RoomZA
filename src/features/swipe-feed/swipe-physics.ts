/** Pure rules for the card swipe, kept apart from pointer handling so they are easy to test. */

export type SwipeDecision = "pass" | "save";
export type PointerSample = { x: number; t: number };

/** Share of the card width a drag must cover to commit (requirement 3.2). */
export const COMMIT_RATIO = 0.3;
/** A flick this fast (px/s) commits even when the drag is short. */
export const FLICK_VELOCITY = 600;
/** A flick must still move at least this far, so a jittery tap never commits. */
export const FLICK_MIN_OFFSET = 24;
/** Movement below this is a tap, not a drag. */
export const TAP_SLOP_PX = 8;
export const MAX_ROTATION_DEG = 12;
const VELOCITY_WINDOW_MS = 100;
/** Sideways must beat vertical by this factor, so diagonal scrolls stay scrolls. */
const AXIS_BIAS = 1.2;

export function resolveSwipe({ offsetX, velocityX, width }: { offsetX: number; velocityX: number; width: number }): SwipeDecision | null {
  if (width <= 0) return null;
  const direction: SwipeDecision = offsetX > 0 ? "save" : "pass";
  if (Math.abs(offsetX) > width * COMMIT_RATIO) return direction;
  const flick = Math.abs(velocityX) > FLICK_VELOCITY && Math.sign(velocityX) === Math.sign(offsetX) && Math.abs(offsetX) >= FLICK_MIN_OFFSET;
  return flick ? direction : null;
}

export function lockAxis(dx: number, dy: number): "x" | "y" | null {
  if (Math.hypot(dx, dy) < TAP_SLOP_PX) return null;
  return Math.abs(dx) > Math.abs(dy) * AXIS_BIAS ? "x" : "y";
}

/** Horizontal velocity in px/s over the last VELOCITY_WINDOW_MS of samples. */
export function swipeVelocity(samples: readonly PointerSample[]) {
  const last = samples.at(-1);
  if (!last) return 0;
  const first = samples.find((sample) => last.t - sample.t <= VELOCITY_WINDOW_MS);
  if (!first || first === last || last.t === first.t) return 0;
  return ((last.x - first.x) / (last.t - first.t)) * 1000;
}

/** How the card looks mid-drag: tilt, and how strongly each stamp shows. */
export function dragVisual(offsetX: number, width: number) {
  const commitDistance = Math.max(width * COMMIT_RATIO, 1);
  const progress = Math.min(Math.abs(offsetX) / commitDistance, 1);
  const rotate = Math.max(-MAX_ROTATION_DEG, Math.min(MAX_ROTATION_DEG, (offsetX / Math.max(width, 1)) * MAX_ROTATION_DEG * 2));
  return {
    rotate,
    saveOpacity: offsetX > 0 ? progress : 0,
    passOpacity: offsetX < 0 ? progress : 0,
  };
}
