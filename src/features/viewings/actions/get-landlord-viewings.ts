"use server";

import { requireAnyPersona } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { logger } from "@/lib/logger";
import {
  actionSuccess,
  actionFailure,
  type ActionResult,
} from "@/lib/action-result";
import type { ViewingData } from "@/features/viewings/components/viewing-scheduler";
import { getInteractionProfileMap } from "@/features/profile/interaction-data";

type ProposedSlotRow = {
  [key: string]: unknown;
  offers: Array<{
    [key: string]: unknown;
    application: {
      [key: string]: unknown;
      renter_id: string;
    } | null;
  }>;
};

type BookedViewingRow = {
  [key: string]: unknown;
  application: {
    [key: string]: unknown;
    renter_id: string;
  } | null;
};

export async function getLandlordViewings(): Promise<
  ActionResult<ViewingData>
> {
  const { user } = await requireAnyPersona(["landlord", "seller"]);
  const supabase = await createClient();

  const [
    { data: slots, error: slotsError },
    { data: booked, error: bookedError },
  ] = await Promise.all([
    supabase
      .from("viewing_slots")
      .select(
        `
        id, start_time, end_time, mode, is_booked, created_at,
        listing:listings!inner(id, title, address, landlord_id),
        offers:viewing_slot_offers(
          id,
          application:applications(id, full_name, status, renter_id)
        )
      `,
      )
      .order("start_time", { ascending: true }),
    supabase
      .from("viewings")
      .select(
        `
        id, status, meeting_join_url, meeting_room_id, meeting_starts_at, meeting_ends_at, created_at,
        application:applications!inner(id, full_name, status, renter_id, listing:listings!inner(id, title, address, landlord_id)),
        slot:viewing_slots(id, start_time, end_time, mode)
      `,
      )
      .order("created_at", { ascending: false }),
  ]);

  if (slotsError || bookedError) {
    logger.error("Failed to load landlord viewings", {
      userId: user.id,
      slotsError,
      bookedError,
    });
    return actionFailure("Unable to load viewings.");
  }

  const slotRows = (slots ?? []) as unknown as ProposedSlotRow[];
  const bookedRows = (booked ?? []) as unknown as BookedViewingRow[];
  const renterIds = [
    ...slotRows.flatMap((slot) =>
      slot.offers.map((offer) => offer.application?.renter_id),
    ),
    ...bookedRows.map((viewing) => viewing.application?.renter_id),
  ];
  const profiles = await getInteractionProfileMap(renterIds);
  const proposed = slotRows.map((slot) => ({
    ...slot,
    offers: slot.offers.map((offer) => ({
      ...offer,
      application: offer.application
        ? {
            ...offer.application,
            renter: profiles.get(offer.application.renter_id) ?? null,
          }
        : null,
    })),
  }));
  const bookedWithProfiles = bookedRows.map((viewing) => ({
    ...viewing,
    application: viewing.application
      ? {
          ...viewing.application,
          renter: profiles.get(viewing.application.renter_id) ?? null,
        }
      : null,
  }));
  return actionSuccess({
    proposed: proposed as unknown as ViewingData["proposed"],
    booked: bookedWithProfiles as unknown as ViewingData["booked"],
  });
}
