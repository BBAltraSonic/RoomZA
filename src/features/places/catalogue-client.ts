import { CATALOGUE_SEARCH_URL, catalogueResponseSchema, recentLocationIdsSchema, RECENT_LOCATION_KEY, MAX_RECENT_LOCATIONS } from "./catalogue-contract";
import type { DiscoveryPlace } from "./place";

export async function searchNamedLocations(query: string, signal: AbortSignal) {
  const value = query.trim();
  if (value.length < 2 || value.length > 100) return [];
  const response = await fetch(`${CATALOGUE_SEARCH_URL}?${new URLSearchParams({ q: value })}`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
  });
  if (!response.ok) throw new Error("Could not load locations");
  return catalogueResponseSchema.parse(await response.json()).data.places;
}

export function rememberNamedLocation(place: DiscoveryPlace) {
  try {
    const stored = recentLocationIdsSchema.safeParse(JSON.parse(localStorage.getItem(RECENT_LOCATION_KEY) ?? "[]"));
    const ids = [place.id, ...(stored.success ? stored.data : []).filter(id => id !== place.id)].slice(0, MAX_RECENT_LOCATIONS);
    localStorage.setItem(RECENT_LOCATION_KEY, JSON.stringify(ids));
  } catch { /* Location selection also works when device storage is unavailable. */ }
}
