import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/** Enables ordinary workflows for the current authenticated identity only.
 * Preserves profile details and cannot restore revoked poster or admin access.
 */
export async function ensureMarketplaceAccount(supabase: SupabaseClient<Database>) {
  const { error } = await supabase.rpc("ensure_marketplace_account");
  return { error };
}
