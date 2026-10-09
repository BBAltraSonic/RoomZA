import "server-only";
import { requireAdmin } from "@/features/admin/auth";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/lib/supabase/types";
import type { OfferIntakeDatabase } from "./intake";
import { confirmedOfferCursorSchema, confirmedOfferQueueSchema, type ConfirmedOfferCursor } from "./confirmed-contract";
type ConfirmedDatabase = Omit<OfferIntakeDatabase, "public"> & { public: Omit<OfferIntakeDatabase["public"], "Functions"> & {
  Functions: OfferIntakeDatabase["public"]["Functions"] & { pinpoint_offer_confirmed_queue: { Args: { after_confirmed_at?: string; after_offer_id?: string }; Returns: Json } };
} };
export async function readConfirmedOfferQueue(cursor?: ConfirmedOfferCursor) {
  await requireAdmin({ redirectTo: "/admin/offers/confirmed" });
  const parsed = cursor === undefined ? undefined : confirmedOfferCursorSchema.parse(cursor);
  const client = await createClient() as unknown as SupabaseClient<ConfirmedDatabase>;
  const { data, error } = await client.rpc("pinpoint_offer_confirmed_queue", parsed ? { after_confirmed_at: parsed.confirmedAt, after_offer_id: parsed.offerId } : {});
  if (error) throw error;
  return confirmedOfferQueueSchema.parse(data);
}
