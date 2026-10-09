import "server-only";

import { createUntypedClient } from "@/lib/supabase/admin";
import { forwardGeocode } from "@/lib/maptiler";
import { placeInputFromGeocoder, toDiscoveryPlace, type DiscoveryPlaceRow } from "./place";

export async function getDiscoveryPlace(id: string) {
  const { data, error } = await createUntypedClient()
    .from("discovery_places")
    .select("id,provider_id,name,region,full_address,center_lat,center_lng,west,south,east,north")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toDiscoveryPlace(data as DiscoveryPlaceRow) : null;
}

export async function getDiscoveryPlaceByProviderId(providerId: string) {
  const { data, error } = await createUntypedClient()
    .from("discovery_places")
    .select("id,provider_id,name,region,full_address,center_lat,center_lng,west,south,east,north")
    .eq("provider_id", providerId)
    .maybeSingle();
  if (error) throw error;
  return data ? toDiscoveryPlace(data as DiscoveryPlaceRow) : null;
}

export async function searchDiscoveryPlaces(query: string) {
  const apiKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
  if (!apiKey) {
    const { data, error } = await createUntypedClient().from("discovery_places")
      .select("id,provider_id,name,region,full_address,center_lat,center_lng,west,south,east,north")
      .ilike("name", "%" + query.replace(/[\\%_]/g, (char) => "\\" + char) + "%").order("name").limit(6);
    if (error) throw error;
    return ((data ?? []) as DiscoveryPlaceRow[]).map(toDiscoveryPlace);
  }
  const suggestions = await forwardGeocode({
    apiKey, query, limit: 6,
    types: ["neighbourhood", "locality", "place", "municipality"],
  });
  const inputs = suggestions.map(placeInputFromGeocoder).filter((item): item is NonNullable<typeof item> => item !== null);
  if (!inputs.length) return [];
  const db = createUntypedClient();
  const { error: insertError } = await db.from("discovery_places").upsert(inputs, {
    onConflict: "provider_id", ignoreDuplicates: true,
  });
  if (insertError) throw insertError;
  const { data, error } = await db.from("discovery_places")
    .select("id,provider_id,name,region,full_address,center_lat,center_lng,west,south,east,north")
    .in("provider_id", inputs.map((item) => item.provider_id));
  if (error) throw error;
  const byProvider = new Map(((data ?? []) as DiscoveryPlaceRow[]).map((row) => [row.provider_id, toDiscoveryPlace(row)]));
  return inputs.flatMap((item) => {
    const place = byProvider.get(item.provider_id);
    return place ? [place] : [];
  });
}
