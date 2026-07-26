"use server";

import { deriveJourney, type DerivedJourney } from "@/features/applications/journey";
import type { RenterApplicationListItem } from "@/features/applications/application-types";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const applicationIdSchema = z.string().uuid();

/**
 * Loads the application attached to a conversation and derives the same
 * progress model used by the renter Journey page. Application RLS permits only
 * the renter and the landlord who owns the listing to read this data.
 */
export async function getConversationJourney(applicationId: string): Promise<DerivedJourney | null> {
  const parsedId = applicationIdSchema.safeParse(applicationId);
  if (!parsedId.success) return null;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data, error } = await supabase
    .from("applications")
    .select(`
      id, status, created_at, updated_at, listing_id,
      listing:listings(title, address, price),
      documents(id, type),
      conversations(id),
      viewings(id, status, meeting_join_url, meeting_room_id, meeting_starts_at, meeting_ends_at, slot:viewing_slots(id, start_time, end_time, mode)),
      viewing_slot_offers(id, slot:viewing_slots(id, start_time, end_time, is_booked, mode))
    `)
    .eq("id", parsedId.data)
    .maybeSingle();

  if (error) {
    logger.error("Failed to load conversation journey", {
      applicationId: parsedId.data,
      userId: userData.user.id,
      error: error.message,
    });
    return null;
  }

  return data ? deriveJourney(data as unknown as RenterApplicationListItem) : null;
}
