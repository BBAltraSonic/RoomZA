/**
 * Replaces the discovery page's query string in place.
 *
 * Discovery state (mode, filters, search, area) lives in the URL, and no server
 * component reads it. `router.replace` would still re-fetch the route from the
 * server before `useSearchParams` changes, which on a phone left Buy and Filters
 * looking dead for seconds. The native History API updates `useSearchParams`
 * immediately (see Next's "Native History API" guide).
 */
export function replaceDiscoveryUrl(url: string) {
  window.history.replaceState(null, "", url);
}

/** Adds a history entry for a new search (the assistant), so Back returns to the previous one. */
export function pushDiscoveryUrl(url: string) {
  window.history.pushState(null, "", url);
}
