import "server-only";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";
import { toDiscoveryPlace, type DiscoveryPlaceRow } from "@/features/places/place";
import { offerDiscoveryPlaceSchema, offerPlacesResponseSchema } from "./public-place-contract";

type PlaceDatabase = { public: { Tables: { discovery_places: { Row: DiscoveryPlaceRow; Insert: never; Update: never; Relationships: [] } }; Views: Record<string, never>; Functions: Record<string, never> } };
const columns = "id,provider_id,name,region,full_address,center_lat,center_lng,west,south,east,north";
function client() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  return createClient<PlaceDatabase>(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(4000)]) : AbortSignal.timeout(4000) }) },
  });
}
export async function readOfferDiscoveryPlace(id: string) {
  const { data, error } = await client().from("discovery_places").select(columns).eq("id", z.string().uuid().parse(id)).maybeSingle();
  if (error) throw error;
  return data ? offerDiscoveryPlaceSchema.parse(toDiscoveryPlace(data)) : null;
}
export async function searchOfferDiscoveryPlaces(query: string) {
  const value = z.string().trim().min(2).max(100).parse(query).replace(/[\\%_]/g, "\\$&");
  const { data, error } = await client().from("discovery_places").select(columns).ilike("name", `%${value}%`).order("name").order("id").limit(6);
  if (error) throw error;
  return offerPlacesResponseSchema.parse({ data: { places: (data ?? []).map(toDiscoveryPlace) } });
}
