"use server";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { logger } from "@/lib/logger";
import { actionSuccess, actionFailure, type ActionResult } from "@/lib/action-result";
import type { ViewingData } from "@/features/viewings/components/viewing-scheduler";

export async function getLandlordViewings(): Promise<ActionResult<ViewingData>> {
  const { user } = await requireRole("landlord");
  const supabase = await createClient();

  const [{ data: slots, error: slotsError }, { data: booked, error: bookedError }] = await Promise.all([
    supabase
      .from("viewing_slots")
      .select(`
        id, start_time, end_time, mode, is_booked, created_at,
        listing:listings!inner(id, title, address, landlord_id),
        offers:viewing_slot_offers(
          id,
          application:applications(id, full_name, status, renter:profiles!renter_id(id, email))
        )
      `)
      .eq("listing.landlord_id", user.id)
      .order("start_time", { ascending: true }),
    supabase
      .from("viewings")
      .select(`
        id, status, meeting_join_url, meeting_room_id, meeting_starts_at, meeting_ends_at, created_at,
        application:applications!inner(id, full_name, status, renter:profiles!renter_id(id, email), listing:listings!inner(id, title, address, landlord_id)),
        slot:viewing_slots(id, start_time, end_time, mode)
      `)
      .eq("application.listing.landlord_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  if (slotsError || bookedError) {
    logger.error("Failed to load landlord viewings", { userId: user.id, slotsError, bookedError });
    return actionFailure("Unable to load viewings.");
  }

  return actionSuccess({
    proposed: (slots ?? []) as unknown as ViewingData["proposed"],
    booked: (booked ?? []) as unknown as ViewingData["booked"],
  });
}
