import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** PostgREST does not accept OR expressions across two embedded relations. */
export async function getProfileViewingCount(client: SupabaseClient, profileId: string) {
  const [rentals, purchases] = await Promise.all([
    client.from("viewings").select("id,applications!inner(renter_id)", { count: "exact", head: true })
      .eq("applications.renter_id", profileId),
    client.from("viewings").select("id,buyer_interests!inner(buyer_id)", { count: "exact", head: true })
      .eq("buyer_interests.buyer_id", profileId),
  ]);
  if (rentals.error || purchases.error || rentals.count === null || purchases.count === null) return null;
  return rentals.count + purchases.count;
}
