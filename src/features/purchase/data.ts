import "server-only";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ViewingSlotRef } from "@/features/applications/application-types";
import type { BuyerInterestStatus } from "./pipeline";
import type { PurchaseStage } from "./progress";

export type MyPurchase = {
  id: string;
  listing_id: string;
  status: BuyerInterestStatus;
  updated_at: string;
  listing: { title: string; address: string; price: number; sale_price: number | null } | null;
  viewings: { id: string; status: string; slot: ViewingSlotRef | ViewingSlotRef[] | null }[];
  viewing_slot_offers: { id: string; slot: ViewingSlotRef | ViewingSlotRef[] | null }[];
  progress: { current_stage: PurchaseStage; completed_stages: PurchaseStage[] } | null;
};

export async function getMyPurchases(redirectTo = "/purchases") {
  const { user } = await requireUser({ redirectTo });
  const client = await createClient();
  const [interests, progress] = await Promise.all([
    client.from("buyer_interests").select(`id, listing_id, status, updated_at,
      listing:listings(title,address,price,sale_price),
      viewings(id,status,slot:viewing_slots(id,start_time,end_time,mode)),
      viewing_slot_offers(id,slot:viewing_slots(id,start_time,end_time,is_booked,mode))`)
      .eq("buyer_id", user.id).order("updated_at", { ascending: false }),
    client.from("purchase_progress").select("listing_id,current_stage,completed_stages")
      .eq("user_id", user.id),
  ]);
  const now = Date.now();
  if (interests.error || progress.error) {
    return { success: false as const, now, error: "Your purchases could not be loaded. Please try again." };
  }
  const stages = new Map((progress.data ?? []).map(row => [row.listing_id, row]));
  return { success: true as const, now, data: (interests.data ?? []).map(row => ({
    ...row, progress: stages.get(row.listing_id) ?? null,
  })) as MyPurchase[] };
}
