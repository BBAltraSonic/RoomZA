import "server-only";

import { createUntypedClient } from "@/lib/supabase/admin";
import { readLocationCatalogue, searchLocationCatalogue } from "./catalogue";

export async function getDiscoveryPlace(id: string) {
  return (await readLocationCatalogue([id]))[0] ?? null;
}

export async function getDiscoveryPlaceByProviderId(providerId: string) {
  const { data, error } = await createUntypedClient()
    .from("discovery_places")
    .select("id")
    .eq("provider_id", providerId)
    .maybeSingle();
  if (error) throw error;
  return data ? getDiscoveryPlace(data.id) : null;
}

export async function searchDiscoveryPlaces(query: string) {
  return (await searchLocationCatalogue(query)).data.places;
}
