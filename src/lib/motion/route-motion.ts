import { MOTION_DISTANCE, MOTION_DURATION, MOTION_EASING, MOTION_SCALE } from "./tokens";

/**
 * Route motion describes where a navigation goes in the app's hierarchy, so
 * the page transition can say it: deeper screens arrive from the end edge,
 * shallower ones from the start edge, and siblings crossfade in place.
 */
export type RouteMotionKind = "forward" | "back" | "lateral" | "none";

/** Destinations that run their own arrival motion (maps) or must not be snapshotted. */
const SELF_ANIMATING_DESTINATIONS = new Set(["/", "/offers", "/issue4-test"]);
/** Live video freezes in a snapshot, so neither entering nor leaving it animates. */
const LIVE_MEDIA_PATH = /^\/(?:viewings\/[^/]+\/live|live-tours)(?:\/|$)/;

function normalizePath(path: string | null): string | null {
  if (!path || !path.startsWith("/")) return null;
  const pathname = path.split(/[?#]/, 1)[0] ?? path;
  return pathname.replace(/\/+$/, "") || "/";
}

function segmentsOf(path: string) {
  return path === "/" ? [] : path.slice(1).split("/");
}

function isAncestor(ancestor: string[], descendant: string[]) {
  return ancestor.length < descendant.length && ancestor.every((segment, index) => segment === descendant[index]);
}

export function hasPageArrivalMotion(pathname: string) {
  const path = normalizePath(pathname);
  return path !== null && !SELF_ANIMATING_DESTINATIONS.has(path) && !LIVE_MEDIA_PATH.test(path);
}

/**
 * Classifies a committed pathname change. `tabRoots` are the app's navigation
 * destinations: moving between two of them is a section switch, not a drill-in.
 */
export function classifyRouteMotion(
  from: string | null,
  to: string,
  tabRoots: ReadonlySet<string> = new Set(),
): RouteMotionKind {
  const previous = normalizePath(from);
  const next = normalizePath(to);
  if (!previous || !next || previous === next) return "none";
  if (!hasPageArrivalMotion(next) || LIVE_MEDIA_PATH.test(previous)) return "none";
  if (tabRoots.has(previous) && tabRoots.has(next)) return "lateral";

  const before = segmentsOf(previous);
  const after = segmentsOf(next);
  if (isAncestor(before, after)) return before.length === 0 && after.length === 1 ? "lateral" : "forward";
  if (isAncestor(after, before)) return "back";
  if (after.length !== before.length) return after.length > before.length ? "forward" : "back";
  return "lateral";
}

/** The `view-transition-class` styled in globals.css for each kind. */
export function routeMotionClass(kind: RouteMotionKind) {
  return kind === "none" ? "none" : `route-${kind}`;
}

type PseudoElementAnimatable = { animate(keyframes: Keyframe[], options: KeyframeAnimationOptions): Animation };
/** The `old`/`new` handles React passes to `<ViewTransition onUpdate>`. */
export type RouteTransitionSnapshots = { old?: PseudoElementAnimatable; new?: PseudoElementAnimatable };

export type RouteChangeAnimation = {
  kind: RouteMotionKind;
  /** Window scroll before the navigation committed. */
  fromScrollY: number;
  /** Window scroll once the destination is in place (Next resets or restores it). */
  toScrollY: number;
  reducedMotion: boolean;
};

const cubicBezier = (points: readonly number[]) => `cubic-bezier(${points.join(",")})`;

/**
 * Animates the two page snapshots. The page scrolls on the window, so the old
 * snapshot is pinned to where the reader last saw it instead of jumping to the
 * destination's scroll position. Old content leaves fast; new content settles.
 */
export function animateRouteChange(snapshots: RouteTransitionSnapshots, motion: RouteChangeAnimation): () => void {
  const { kind, reducedMotion } = motion;
  if (kind === "none" || !snapshots.old?.animate || !snapshots.new?.animate) return () => {};

  const pinned = motion.toScrollY - motion.fromScrollY;
  const direction = kind === "forward" ? 1 : kind === "back" ? -1 : 0;
  const travel = reducedMotion ? 0 : direction * MOTION_DISTANCE.lg;
  const rise = reducedMotion || kind !== "lateral" ? 0 : MOTION_DISTANCE.sm;
  const scale = reducedMotion || kind !== "lateral" ? 1 : MOTION_SCALE.incoming;

  const exit: KeyframeAnimationOptions = {
    duration: MOTION_DURATION.fast * 1000,
    easing: cubicBezier(MOTION_EASING.easeInOut),
    fill: "both",
  };
  const enter: KeyframeAnimationOptions = {
    duration: (reducedMotion ? MOTION_DURATION.fast : MOTION_DURATION.normal) * 1000,
    easing: cubicBezier(MOTION_EASING.easeOut),
    fill: "both",
  };

  const animations: Animation[] = [];
  try {
    animations.push(snapshots.old.animate([
      { opacity: 1, transform: `translate3d(0, ${pinned}px, 0)` },
      { opacity: 0, transform: `translate3d(${-travel}px, ${pinned}px, 0)` },
    ], exit));
    animations.push(snapshots.new.animate([
      { opacity: 0, transform: `translate3d(${travel}px, ${rise}px, 0) scale(${scale})` },
      { opacity: 1, transform: "none" },
    ], enter));
  } catch {
    // Optional decoration: a failed animation must leave the new page showing.
  }
  return () => { for (const animation of animations) animation.cancel(); };
}
