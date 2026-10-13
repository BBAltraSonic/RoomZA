import { enrichDiscoveryItems } from "@/features/discovery/presentation-data";
import "server-only";
import { z } from "zod";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";
import type { Json } from "@/lib/supabase/types";
import type { OfferIntakeDatabase } from "./intake";
import { publicOfferActionSchema, publicOfferCountSchema, publicOfferCursorSchema, publicOfferDetailSchema, publicOfferFeedSchema, type PublicOfferCursor } from "./public-contract";

type PublicOfferDatabase = Omit<OfferIntakeDatabase, "public"> & {
  public: Omit<OfferIntakeDatabase["public"], "Functions"> & {
    Functions: {
      pinpoint_offer_public_detail: { Args: { target: string }; Returns: Json };
      pinpoint_offer_public_action: { Args: { target: string }; Returns: Json };
      pinpoint_offer_public_feed: { Args: { area: string; after_confirmed_at?: string; after_offer_id?: string }; Returns: Json };
      pinpoint_offer_public_count: { Args: { area: string }; Returns: Json };
    };
  };
};
// Anonymous read-only client: no service key, cookies or private table access.
function publicClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  return createSupabaseClient<PublicOfferDatabase>(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(4000)]) : AbortSignal.timeout(4000) }) },
  });
}
export async function readPublicOffer(offerId: string) {
  const { data, error } = await publicClient().rpc("pinpoint_offer_public_detail", { target: z.string().uuid().parse(offerId) });
  if (error) throw error;
  const result = publicOfferDetailSchema.parse(data);
  return result.status === "live" ? (await enrichDiscoveryItems([result]))[0]! : result;
}
export async function readPublicOfferAction(offerId: string) {
  const { data, error } = await publicClient().rpc("pinpoint_offer_public_action", { target: z.string().uuid().parse(offerId) });
  if (error) throw error;
  return publicOfferActionSchema.parse(data);
}
export async function readPublicOfferFeed(areaId: string, cursor?: PublicOfferCursor) {
  const parsed = cursor === undefined ? undefined : publicOfferCursorSchema.parse(cursor);
  const { data, error } = await publicClient().rpc("pinpoint_offer_public_feed", { area: z.string().uuid().parse(areaId), ...(parsed && { after_confirmed_at: parsed.confirmedAt, after_offer_id: parsed.offerId }) });
  if (error) throw error;
  const result = publicOfferFeedSchema.parse(data);
  result.items = await enrichDiscoveryItems(result.items);
  return result;
}
export async function readPublicOfferCount(areaId: string) {
  const { data, error } = await publicClient().rpc("pinpoint_offer_public_count", { area: z.string().uuid().parse(areaId) });
  if (error) throw error;
  return publicOfferCountSchema.parse(data);
}
