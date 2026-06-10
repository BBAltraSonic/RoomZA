// Bottom navigation active-state resolver for the Mobile_Map_Discovery feature.
// See .kiro/specs/mobile-map-discovery/design.md (BottomNavigationBar,
// Correctness Property 6, Data Gap 4).

import type { NavKey } from "./types";

/** Default active destination before any activation (Req 7.2). */
export const DEFAULT_NAV: NavKey = "discovery";

/**
 * Route mapping for the five Bottom_Nav destinations (Req 7.3, Data Gap 4 resolved).
 *
 * - Home and Discovery both resolve to `/` (Discovery is the active default and
 *   is the map-first entry; Home is the same root surface).
 * - List resolves to `/listings`, the browsable list view of published
 *   listings — the non-map complement to the Discovery map.
 */
export const NAV_ROUTES: Record<NavKey, string> = {
  home: "/",
  discovery: "/",
  list: "/listings",
  saved: "/saved",
  profile: "/profile",
};

/**
 * Resolve the bottom-nav active state from an activated key (Req 7.5, 7.6).
 *
 * Returns the activated key, or {@link DEFAULT_NAV} (`"discovery"`) when
 * `activated` is null. Exactly one destination is active at a time.
 */
export function resolveActiveNav(activated: NavKey | null): NavKey {
  return activated ?? DEFAULT_NAV;
}
