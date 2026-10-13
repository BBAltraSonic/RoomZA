import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";
import { toDiscoveryPlace, type DiscoveryPlaceRow } from "./place";
import { catalogueResponseSchema, locationSearchWords, recentLocationIdsSchema } from "./catalogue-contract";

type PlaceDatabase = { public: {
  Tables: Record<string, never>; Views: Record<string, never>;
  Functions: {
    search_discovery_places: { Args: { search_query: string }; Returns: DiscoveryPlaceRow[] };
    read_discovery_places: { Args: { place_ids: string[] }; Returns: DiscoveryPlaceRow[] };
  };
} };

function client() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  return createClient<PlaceDatabase>(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: init?.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(4000)]) : AbortSignal.timeout(4000) }) },
  });
}

/** Public catalogue reads only. No geocoder, service-role key, or catalogue writes. */
export async function searchLocationCatalogue(query: string, recentIds: string[] = []) {
  const ids = [...new Set(recentLocationIdsSchema.parse(recentIds))];
  const words = locationSearchWords(query);
  if (query.trim() && !words.length) return catalogueResponseSchema.parse({ data: { places: [], recentPlaces: [] } });
  const db = client();
  const [candidates, recents] = await Promise.all([
    db.rpc("search_discovery_places", { search_query: query.trim() }, { get: true }),
    ids.length ? db.rpc("read_discovery_places", { place_ids: ids }, { get: true }) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [candidates, recents]) if (result.error) throw result.error;
  const byId = new Map((recents.data ?? []).map(row => [row.id, row]));
  return catalogueResponseSchema.parse({ data: {
    places: (candidates.data ?? []).map(toDiscoveryPlace),
    recentPlaces: ids.flatMap(id => { const row = byId.get(id); return row ? [toDiscoveryPlace(row)] : []; }),
  } });
}

export async function readLocationCatalogue(ids: string[]) {
  if (!ids.length) return [];
  if (ids.length > 6) throw new Error("Read at most six locations");
  const { data, error } = await client().rpc("read_discovery_places", { place_ids: ids }, { get: true });
  if (error) throw error;
  return catalogueResponseSchema.parse({ data: { places: (data ?? []).map(toDiscoveryPlace) } }).data.places;
}
