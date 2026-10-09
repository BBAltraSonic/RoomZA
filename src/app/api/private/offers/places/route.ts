import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toDiscoveryPlace, type DiscoveryPlaceRow } from "@/features/places/place";
import type { SupabaseClient } from "@supabase/supabase-js";

type PlaceDatabase = { public: { Tables: { discovery_places: { Row: DiscoveryPlaceRow; Insert: never; Update: never; Relationships: [] } }; Views: Record<string, never>; Functions: Record<string, never> } };

export async function GET(request: Request) {
  await requireUser({ redirectTo: "/post/offers" });
  const query = z.string().trim().min(2).max(100).safeParse(new URL(request.url).searchParams.get("q"));
  if (!query.success) return Response.json({ error: "Enter at least two letters." }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
  const client = await createClient() as unknown as SupabaseClient<PlaceDatabase>;
  const escaped = query.data.replace(/[\\%_]/g, "\\$&");
  const { data, error } = await client.from("discovery_places")
    .select("id,provider_id,name,region,full_address,center_lat,center_lng,west,south,east,north")
    .ilike("name", `%${escaped}%`).order("name").order("id").limit(6);
  if (error) return Response.json({ error: "Could not search stored places." }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  return Response.json({ data: { places: (data ?? []).map(toDiscoveryPlace) } }, { headers: { "Cache-Control": "private, no-store" } });
}
