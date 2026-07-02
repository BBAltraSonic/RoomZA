"use server";

import type { User } from "@supabase/supabase-js";
import { z } from "zod";

import { actionFailure, actionSuccess, type ActionResult } from "@/lib/action-result";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

const liveViewingSchema = z.object({
  viewingId: z.string().uuid(),
});

type MaybeArray<T> = T | T[] | null;

export type LiveViewing = {
  id: string;
  status: string;
  meeting_provider: string | null;
  meeting_room_id: string | null;
  meeting_join_url: string | null;
  meeting_starts_at: string | null;
  meeting_ends_at: string | null;
  slot: MaybeArray<{
    id: string;
    start_time: string;
    end_time: string;
    mode: string;
  }>;
  application: MaybeArray<{
    id: string;
    full_name: string;
    renter_id: string;
    listing: MaybeArray<{
      id: string;
      title: string;
      address: string;
      price: number;
      landlord_id: string;
    }>;
  }>;
};

export type LiveViewingData = {
  user: User;
  viewing: LiveViewing | null;
};

export async function getLiveViewing(viewingId: string): Promise<ActionResult<LiveViewingData>> {
  const parsed = liveViewingSchema.safeParse({ viewingId });
  if (!parsed.success) {
    return actionFailure("Invalid viewing id.", parsed.error.flatten());
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return actionFailure("Unauthorized");
  }

  const { data: viewing, error } = await supabase
    .from("viewings")
    .select(`
      id,
      status,
      meeting_provider,
      meeting_room_id,
      meeting_join_url,
      meeting_starts_at,
      meeting_ends_at,
      slot:viewing_slots(id, start_time, end_time, mode),
      application:applications(
        id,
        full_name,
        renter_id,
        listing:listings(id, title, address, price, landlord_id)
      )
    `)
    .eq("id", parsed.data.viewingId)
    .maybeSingle();

  if (error) {
    logger.error("Failed to load live viewing", { userId: userData.user.id, viewingId: parsed.data.viewingId, error });
    return actionFailure("Unable to load viewing.");
  }

  return actionSuccess({ user: userData.user, viewing: viewing as LiveViewing | null });
}
