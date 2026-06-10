// Marker capping pure function for the Mobile_Map_Discovery feature.
// See .kiro/specs/mobile-map-discovery/design.md (Correctness Property 1).

import { MAX_MARKERS } from "./constants";

/**
 * Cap a list to at most {@link MAX_MARKERS} items (Req 3.2, 3.7).
 *
 * Returns the first `min(items.length, MAX_MARKERS)` elements in input order.
 * Empty input yields empty output. Generic over the element type so it works
 * for both listings and card models.
 */
export function capListings<T>(items: T[]): T[] {
  return items.slice(0, MAX_MARKERS);
}
