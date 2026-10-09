import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/features/admin/auth";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import type { OfferIntakeDatabase } from "./intake";
import { offerReviewSnapshotSchema } from "./review-contract";

type ReviewDatabase = Omit<OfferIntakeDatabase, "public"> & {
  public: Omit<OfferIntakeDatabase["public"], "Functions"> & {
    Functions: OfferIntakeDatabase["public"]["Functions"] & {
      pinpoint_offer_review_queue: { Args: { queue_page: number }; Returns: Json };
    };
  };
};
export async function readOfferReviewQueue(page = 1) {
  await requireAdmin({ redirectTo: "/admin/offers" });
  const queuePage = z.number().int().min(1).max(10000).parse(page);
  const client = await createClient() as unknown as SupabaseClient<ReviewDatabase>;
  const { data, error } = await client.rpc("pinpoint_offer_review_queue", { queue_page: queuePage });
  if (error) throw error;
  const rows = z.array(offerReviewSnapshotSchema).max(21).parse(data);
  return { offers: rows.slice(0, 20), hasNext: rows.length > 20 };
}
