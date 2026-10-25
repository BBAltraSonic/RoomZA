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
import { getListingManagementScope } from "@/features/listings/management-scope";

type ProposedSlotRow = {
  [key: string]: unknown;
  offers: Array<{
    [key: string]: unknown;
    application: {
      [key: string]: unknown;
      renter_id: string;
    } | null;
    buyer_interest: { [key: string]: unknown; buyer_id: string } | null;
  }>;
};

type BookedViewingRow = {
  [key: string]: unknown;
  application: {
    [key: string]: unknown;
    renter_id: string;
  } | null;
  buyer_interest: { [key: string]: unknown; buyer_id: string } | null;
};

export async function getLandlordViewings(): Promise<
  ActionResult<ViewingData>
> {
  const { user } = await requireAnyPersona(["landlord", "seller"]);
  const [supabase, scope] = await Promise.all([createClient(), getListingManagementScope()]);
  const ownerFilter = scope.managedOrganizationId
    ? `landlord_id.eq.${user.id},organization_id.eq.${scope.managedOrganizationId}`
    : `landlord_id.eq.${user.id}`;

  const [
    { data: slots, error: slotsError },
    { data: booked, error: bookedError },
    { data: buyerBooked, error: buyerBookedError },
  ] = await Promise.all([
    supabase
      .from("viewing_slots")
      .select(
        `
        id, start_time, end_time, mode, is_booked, created_at,
        listing:listings!inner(id, title, address, landlord_id),
        offers:viewing_slot_offers(
          id,
          application:applications(id, full_name, status, renter_id),
          buyer_interest:buyer_interests(id, buyer_id, status)
        )
      `,
      )
      .eq("is_booked", false)
      .or(ownerFilter, { referencedTable: "listing" })
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
      .or(ownerFilter, { referencedTable: "application.listing" })
      .order("created_at", { ascending: false }),
    supabase.from("viewings").select(`
      id, status, meeting_join_url, meeting_room_id, meeting_starts_at, meeting_ends_at, created_at,
      buyer_interest:buyer_interests!inner(id,buyer_id,status,listing:listings!inner(id,title,address,landlord_id)),
      slot:viewing_slots(id,start_time,end_time,mode)
    `).or(ownerFilter, { referencedTable: "buyer_interest.listing" }).order("created_at", { ascending: false }),
  ]);

  if (slotsError || bookedError || buyerBookedError) {
    logger.error("Failed to load landlord viewings", {
      userId: user.id,
      slotsError,
      bookedError,
      buyerBookedError,
    });
    return actionFailure("Unable to load viewings.");
  }

  const slotRows = (slots ?? []) as unknown as ProposedSlotRow[];
  const bookedRows = [...(booked ?? []), ...(buyerBooked ?? [])] as unknown as BookedViewingRow[];
  const renterIds = [
    ...slotRows.flatMap((slot) =>
      slot.offers.flatMap((offer) => [offer.application?.renter_id,offer.buyer_interest?.buyer_id]),
    ),
    ...bookedRows.flatMap((viewing) => [viewing.application?.renter_id,viewing.buyer_interest?.buyer_id]),
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
      buyer_interest: offer.buyer_interest
        ? { ...offer.buyer_interest, buyer: profiles.get(offer.buyer_interest.buyer_id) ?? null }
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
    buyer_interest: viewing.buyer_interest
      ? { ...viewing.buyer_interest, buyer: profiles.get(viewing.buyer_interest.buyer_id) ?? null }
      : null,
  }));
  return actionSuccess({
    proposed: proposed as unknown as ViewingData["proposed"],
    booked: bookedWithProfiles as unknown as ViewingData["booked"],
  });
}
