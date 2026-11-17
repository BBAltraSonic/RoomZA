import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * Deposits are financial records, so a profile that paid or received one
 * cannot be deleted (payments.renter_id and owner_id restrict it). Account
 * deletion asks this first, before removing anything. Throws when the records
 * cannot be read, so an unknown answer never counts as none.
 */
export async function countPaymentRecords(client: SupabaseClient, userId: string): Promise<number> {
  const id = z.string().uuid().parse(userId);
  const { count, error } = await client.from("payments")
    .select("id", { count: "exact", head: true })
    .or(`renter_id.eq.${id},owner_id.eq.${id}`);
  if (error) throw new Error(`Payment records could not be counted: ${error.code ?? "unknown"}`);
  return count ?? 0;
}
