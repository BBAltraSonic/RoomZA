/**
 * Pure presence-status resolver for Instant Connect (design §3.2).
 *
 * Matches the codebase convention of pure, unit-tested state modules like
 * `call-state.ts` and `landlord-signals.ts`: no I/O. The database
 * (`presence_status` maintained by `touch_presence` + the sweep) is
 * authoritative for ambient reads; this module resolves the badge a *viewer*
 * sees, blending the persisted signal with an optional live-channel signal.
 *
 * `liveOnline` has two transparent sources: on a surface with a scoped
 * subscription open (§3.1.1) it reflects the live channel; everywhere else it
 * is derived as `last_seen_at within the freshness window`. The function is
 * pure and identical either way — only the freshness of its input differs — so
 * the same tests cover both the socket and heartbeat paths.
 */

export type PresenceBadge = "available" | "busy" | "offline";
export type AvailabilityMode = "auto" | "available" | "busy" | "invisible";

/** Freshness window: a heartbeat newer than this reads as live online (~90s). */
export const LIVE_FRESHNESS_MS = 90_000;

/** Default "busy"/recent-activity window: seen within this maps to "busy". */
export const DEFAULT_BUSY_WINDOW_MS = 20 * 60_000;

export type ResolvePresenceInput = {
  availabilityMode: AvailabilityMode;
  /** Live-channel truth when a scoped subscription is open; else derive below. */
  liveOnline: boolean;
  /** Epoch ms of the last persisted heartbeat, or null if never seen. */
  lastSeenAt: number | null;
  /** Current epoch ms. */
  now: number;
  /** True while the target is in an active call/viewing (auto → busy). */
  inActiveCallOrViewing?: boolean;
  /** Window mapping recent-but-not-live activity to "busy". Default 20 min. */
  busyWindowMs?: number;
};

/** True when `lastSeenAt` falls within the live freshness window of `now`. */
export function isFresh(lastSeenAt: number | null, now: number): boolean {
  return lastSeenAt !== null && now - lastSeenAt <= LIVE_FRESHNESS_MS;
}

/**
 * Resolves the badge shown to a viewer.
 *
 * Rules (design §3.2):
 * - `invisible` -> always `offline` (never leak presence).
 * - `available` / `busy` (pinned) -> that value, provided the target is live
 *   or seen within the busy window; otherwise `offline`.
 * - `auto`:
 *   - live && !inActiveCallOrViewing -> `available`
 *   - live && inActiveCallOrViewing  -> `busy`
 *   - !live && seen within busyWindow -> `busy`
 *   - else -> `offline`
 *
 * `liveOnline` is used as-is when true; when false, liveness is derived from
 * `lastSeenAt` freshness so the heartbeat path and socket path share one rule.
 */
export function resolvePresenceBadge(input: ResolvePresenceInput): PresenceBadge {
  const {
    availabilityMode,
    lastSeenAt,
    now,
    inActiveCallOrViewing = false,
    busyWindowMs = DEFAULT_BUSY_WINDOW_MS,
  } = input;

  if (availabilityMode === "invisible") {
    return "offline";
  }

  const live = input.liveOnline || isFresh(lastSeenAt, now);
  const withinBusyWindow = lastSeenAt !== null && now - lastSeenAt <= busyWindowMs;

  if (availabilityMode === "available" || availabilityMode === "busy") {
    // Pinned status only holds while the person is plausibly reachable.
    if (live || withinBusyWindow) {
      return availabilityMode;
    }
    return "offline";
  }

  // auto
  if (live) {
    return inActiveCallOrViewing ? "busy" : "available";
  }
  if (withinBusyWindow) {
    return "busy";
  }
  return "offline";
}

/** Short human label for a badge, blended with response-time copy elsewhere. */
export function presenceBadgeLabel(badge: PresenceBadge): string {
  switch (badge) {
    case "available":
      return "Available now";
    case "busy":
      return "Recently active";
    case "offline":
      return "Offline";
  }
}
