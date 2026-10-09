"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getOrCreateInquiryConversation } from "@/features/chat/actions";
import { getInteractionProfileMap } from "@/features/profile/interaction-data";
import {
  actionFailure,
  actionSuccess,
  type ActionResult,
} from "@/lib/action-result";
import { requirePersona } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { createUntypedClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

import { BUYER_INTEREST_STATUSES, type BuyerInterestStatus } from "./pipeline";
import { type PurchaseStage } from "./progress";
import { savePurchaseStage } from "./progress-save";

const listingIdSchema = z.string().uuid("Invalid listing id.");
const interestIdSchema = z.string().uuid("Invalid buyer interest id.");
const progressStageSchema = z.enum([
  "property_saved",
  "viewing_scheduled",
  "viewing_completed",
  "contacted_seller",
  "negotiating",
  "sale_agreed",
  "purchase_complete",
] satisfies [PurchaseStage, ...PurchaseStage[]]);

const updateInterestSchema = z.object({
  buyerInterestId: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
  status: z.enum(
    BUYER_INTEREST_STATUSES as [BuyerInterestStatus, ...BuyerInterestStatus[]],
  ),
  notes: z.string().max(2_000).optional(),
  viewingDate: z.string().datetime().optional().nullable(),
});

const viewingSlotSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
});

const proposeBuyerViewingSchema = z.object({
  buyerInterestId: z.string().uuid(),
  mode: z.enum(["in_person", "video_call"]).default("in_person"),
  slots: z.array(viewingSlotSchema).min(1).max(20),
});

const bookBuyerViewingSchema = z.object({
  buyerInterestId: z.string().uuid(),
  slotId: z.string().uuid(),
});

type ListingForInterest = {
  id: string;
  landlord_id: string;
  listing_type: Database["public"]["Enums"]["listing_type"];
  status: Database["public"]["Enums"]["listing_status"];
};

async function getSaleListingForBuyer(listingId: string, buyerId: string) {
  const supabase = await createClient();
  const { data: listing, error } = await supabase
    .from("listings")
    .select("id, landlord_id, listing_type, status")
    .eq("id", listingId)
    .eq("status", "published")
    .eq("listing_type", "sale")
    .single();

  if (error || !listing) {
    return { error: "Sale listing not found." } as const;
  }

  const typedListing = listing as ListingForInterest;
  if (typedListing.landlord_id === buyerId) {
    return {
      error: "You cannot register interest in your own property.",
    } as const;
  }

  return { listing: typedListing } as const;
}

export async function advancePurchaseProgress(
  listingId: string,
  stage: PurchaseStage,
): Promise<
  ActionResult<{
    currentStage: PurchaseStage;
    completedStages: PurchaseStage[];
  }>
> {
  const parsedListingId = listingIdSchema.safeParse(listingId);
  const parsedStage = progressStageSchema.safeParse(stage);
  if (!parsedListingId.success || !parsedStage.success) {
    return actionFailure("Invalid purchase progress update.");
  }

  await requirePersona("buyer", { redirectTo: `/listing/${parsedListingId.data}` });
  const supabase = await createClient();

  const result = await savePurchaseStage(supabase,parsedListingId.data,parsedStage.data);
  if (!result.success) return result;
  revalidatePath("/saved");
  revalidatePath(`/listing/${parsedListingId.data}`);
  return result;
}

export async function getPurchaseProgress(listingId: string) {
  const parsedListingId = listingIdSchema.safeParse(listingId);
  if (!parsedListingId.success) return actionFailure("Invalid listing id.");

  const { user } = await requirePersona("buyer", { redirectTo: `/listing/${parsedListingId.data}` });
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("purchase_progress")
    .select("current_stage, completed_stages, updated_at")
    .eq("user_id", user.id)
    .eq("listing_id", parsedListingId.data)
    .maybeSingle();

  if (error) {
    logger.error("Purchase progress read failed", {
      userId: user.id,
      listingId: parsedListingId.data,
      error: error.message,
    });
    return actionFailure("Unable to load purchase progress.");
  }

  return actionSuccess(data ?? null);
}

export async function createBuyerInterest(
  listingId: string,
): Promise<ActionResult<{ buyerInterestId: string }>> {
  const parsedListingId = listingIdSchema.safeParse(listingId);
  if (!parsedListingId.success) return actionFailure("Invalid listing id.");

  const { user } = await requirePersona("buyer", { redirectTo: `/listing/${parsedListingId.data}` });
  const saleListing = await getSaleListingForBuyer(
    parsedListingId.data,
    user.id,
  );
  if ("error" in saleListing)
    return actionFailure(saleListing.error ?? "Sale listing not found.");

  const supabase = await createClient();
  // Buyers have INSERT and SELECT, not UPDATE: repeated interest must not upsert-update.
  const inserted = await supabase.from("buyer_interests").upsert({
    buyer_id: user.id, seller_id: saleListing.listing.landlord_id, listing_id: saleListing.listing.id,
  }, { onConflict: "buyer_id,listing_id", ignoreDuplicates: true });
  const { data, error } = inserted.error ? { data: null, error: inserted.error } : await supabase
    .from("buyer_interests").select("id").eq("buyer_id", user.id).eq("listing_id", saleListing.listing.id).single();

  if (error || !data?.id) {
    logger.error("Buyer interest upsert failed", {
      userId: user.id,
      listingId: parsedListingId.data,
      error: error?.message,
    });
    return actionFailure("Unable to register interest in this property.");
  }

  await advancePurchaseProgress(parsedListingId.data, "property_saved");
  revalidatePath("/dashboard/buyers");
  return actionSuccess({ buyerInterestId: data.id });
}

export async function contactSellerForPurchase(
  listingId: string,
): Promise<ActionResult<{ conversationId: string }>> {
  const interest = await createBuyerInterest(listingId);
  if (!interest.success) return interest;

  const conversation = await getOrCreateInquiryConversation(listingId);
  if (!conversation.success || !conversation.conversationId) {
    return actionFailure(conversation.error ?? "Unable to contact seller.");
  }

  await advancePurchaseProgress(listingId, "contacted_seller");
  return actionSuccess({ conversationId: conversation.conversationId });
}

export async function requestPurchaseViewing(
  listingId: string,
): Promise<ActionResult<{ buyerInterestId: string }>> {
  const interest = await createBuyerInterest(listingId);
  if (!interest.success) return interest;

  // Scheduling is recorded only after bookBuyerViewingSlot succeeds.
  return interest;
}

export async function updateBuyerInterest(
  payload: z.infer<typeof updateInterestSchema>,
) {
  const parsed = updateInterestSchema.safeParse(payload);
  if (!parsed.success) return actionFailure("Invalid buyer interest update.");

  const { user } = await requirePersona("seller");
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const sessionId = z.string().uuid().safeParse(claims.data?.claims.session_id);
  if (claims.error || claims.data?.claims.sub !== user.id || !sessionId.success) return actionFailure("Sign in again before updating buyer interest.");
  const { data, error } = await createUntypedClient().rpc("pinpoint_buyer_interest_save", {
    actor_id: user.id, actor_session_id: sessionId.data, target: parsed.data.buyerInterestId,
    expected_updated_at: parsed.data.expectedUpdatedAt, next_status: parsed.data.status,
    next_viewing_date: parsed.data.viewingDate ?? null, private_notes: parsed.data.notes ?? null,
  });
  if (error) return actionFailure(error.code === "PT409" ? "Buyer interest changed. Reload before saving." : "Unable to update buyer interest.");
  const result = z.object({ updatedAt: z.string().datetime({ offset: true }) }).safeParse(data);
  if (!result.success) return actionFailure("Unable to confirm this change. Reload buyer interest.");
  revalidatePath("/dashboard/buyers");
  revalidatePath("/saved");
  return actionSuccess(result.data);
}

export async function proposeBuyerViewingSlots(
  payload: z.infer<typeof proposeBuyerViewingSchema>,
): Promise<ActionResult> {
  const parsed = proposeBuyerViewingSchema.safeParse(payload);
  if (!parsed.success) return actionFailure("Invalid viewing proposal.");

  const { user } = await requirePersona("seller");
  const supabase = await createClient();
  const { data: interest, error: interestError } = await supabase
    .from("buyer_interests")
    .select("id, listing_id, buyer_id")
    .eq("id", parsed.data.buyerInterestId)
    .eq("seller_id", user.id)
    .single();

  if (interestError || !interest)
    return actionFailure("Buyer interest not found.");

  const { data: insertedSlots, error: slotsError } = await supabase
    .from("viewing_slots")
    .insert(
      parsed.data.slots.map((slot) => ({
        listing_id: interest.listing_id,
        created_by: user.id,
        start_time: slot.startTime,
        end_time: slot.endTime,
        mode: parsed.data.mode,
        is_booked: false,
      })),
    )
    .select("id");

  if (slotsError || !insertedSlots) {
    logger.error("Buyer viewing slot create failed", {
      userId: user.id,
      buyerInterestId: interest.id,
      error: slotsError?.message,
    });
    return actionFailure("Failed to create viewing slots.");
  }

  const { error: offersError } = await supabase
    .from("viewing_slot_offers")
    .insert(
      insertedSlots.map((slot) => ({
        slot_id: slot.id,
        buyer_interest_id: interest.id,
      })),
    );

  if (offersError) {
    logger.error("Buyer viewing offer create failed", {
      userId: user.id,
      buyerInterestId: interest.id,
      error: offersError.message,
    });
    return actionFailure("Failed to send viewing slots.");
  }

  await supabase
    .from("buyer_interests")
    .update({
      viewing_date: parsed.data.slots[0]?.startTime ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", interest.id)
    .eq("seller_id", user.id);

  revalidatePath("/dashboard/buyers");
  return actionSuccess(undefined);
}

export async function bookBuyerViewingSlot(
  payload: z.infer<typeof bookBuyerViewingSchema>,
): Promise<ActionResult<string>> {
  const parsed = bookBuyerViewingSchema.safeParse(payload);
  if (!parsed.success) return actionFailure("Invalid viewing booking.");

  const { user } = await requirePersona("buyer");
  const supabase = await createClient();
  const { data: interest } = await supabase
    .from("buyer_interests")
    .select("id, listing_id")
    .eq("id", parsed.data.buyerInterestId)
    .eq("buyer_id", user.id)
    .single();

  if (!interest) return actionFailure("Buyer interest not found.");

  const { data: viewingId, error } = await supabase.rpc(
    "book_buyer_viewing_slot_atomic",
    {
      target_slot_id: parsed.data.slotId,
      target_buyer_interest_id: parsed.data.buyerInterestId,
    },
  );

  if (error || !viewingId) {
    logger.warn("Buyer viewing booking failed", {
      userId: user.id,
      buyerInterestId: parsed.data.buyerInterestId,
      error: error?.message,
    });
    return actionFailure(
      "Failed to book viewing. It may have already been booked.",
    );
  }

  await advancePurchaseProgress(interest.listing_id, "viewing_scheduled");
  revalidatePath("/saved");
  return actionSuccess(viewingId as string);
}

export async function getSellerBuyerInterests() {
  const { user } = await requirePersona("seller");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("buyer_interests")
    .select(
      `
      *,
      listing:listings!inner(id, title, address, sale_price, price, listing_images(public_url, sort_order)),
      viewings(id, status, meeting_join_url, meeting_room_id, slot:viewing_slots(id, start_time, end_time, mode)),
      viewing_slot_offers(id, slot:viewing_slots(id, start_time, end_time, is_booked, mode))
    `,
    )
    .eq("seller_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    logger.error("Seller buyer interests query failed", {
      userId: user.id,
      error: error.message,
    });
    return actionFailure("Unable to load buyer interest.");
  }

  const interests = data ?? [];
  const interestIds = interests.map((interest) => interest.id);
  const { data: privateNotes, error: notesError } = interestIds.length
    ? await supabase
        .from("buyer_interest_private_notes")
        .select("buyer_interest_id, notes")
        .in("buyer_interest_id", interestIds)
    : { data: [], error: null };

  if (notesError) {
    logger.error("Seller buyer interest notes query failed", {
      userId: user.id,
      error: notesError.message,
    });
    return actionFailure("Unable to load buyer interest notes.");
  }

  const notesByInterestId = new Map(
    (privateNotes ?? []).map((note) => [note.buyer_interest_id, note.notes]),
  );
  const profiles = await getInteractionProfileMap(
    interests.map((interest) => interest.buyer_id),
  );
  return actionSuccess(
    interests.map((interest) => ({
      ...interest,
      buyer: profiles.get(interest.buyer_id) ?? null,
      notes: notesByInterestId.get(interest.id) ?? null,
    })),
  );
}

export async function getOrCreateBuyerInterestConversation(
  buyerInterestId: string,
): Promise<ActionResult<{ conversationId: string }>> {
  const parsed = interestIdSchema.safeParse(buyerInterestId);
  if (!parsed.success) return actionFailure("Invalid buyer interest id.");

  const { user } = await requirePersona("seller");
  const supabase = await createClient();
  const { data: interest, error: interestError } = await supabase
    .from("buyer_interests")
    .select("listing_id, buyer_id")
    .eq("id", parsed.data)
    .eq("seller_id", user.id)
    .single();

  if (interestError || !interest) {
    return actionFailure("Buyer interest not found.");
  }

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("listing_id", interest.listing_id)
    .eq("renter_id", interest.buyer_id)
    .maybeSingle();

  if (existing) {
    return actionSuccess({ conversationId: existing.id });
  }

  const { data: conversation, error } = await supabase
    .from("conversations")
    .insert({
      listing_id: interest.listing_id,
      renter_id: interest.buyer_id,
      landlord_id: user.id,
      type: "inquiry",
    })
    .select("id")
    .single();

  if (error || !conversation) {
    logger.error("Buyer interest conversation create failed", {
      userId: user.id,
      buyerInterestId: parsed.data,
      error: error?.message,
    });
    return actionFailure("Unable to open conversation.");
  }

  return actionSuccess({ conversationId: conversation.id });
}

export async function getBuyerInterestForListing(listingId: string) {
  const parsedListingId = listingIdSchema.safeParse(listingId);
  if (!parsedListingId.success) return actionFailure("Invalid listing id.");

  const { user } = await requirePersona("buyer");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("buyer_interests")
    .select(
      `
      id,
      status,
      viewing_date,
      viewings(id, status, meeting_join_url, meeting_room_id, slot:viewing_slots(id, start_time, end_time, mode)),
      viewing_slot_offers(id, slot:viewing_slots(id, start_time, end_time, is_booked, mode))
    `,
    )
    .eq("buyer_id", user.id)
    .eq("listing_id", parsedListingId.data)
    .maybeSingle();

  if (error) return actionFailure("Unable to load buyer interest.");

  return actionSuccess(data ?? null);
}

export async function ensureBuyerInterestById(buyerInterestId: string) {
  const parsed = interestIdSchema.safeParse(buyerInterestId);
  if (!parsed.success) return actionFailure("Invalid buyer interest id.");
  const { user } = await requirePersona("buyer");
  const supabase = await createClient();
  const { data } = await supabase
    .from("buyer_interests")
    .select("id, listing_id")
    .eq("id", parsed.data)
    .eq("buyer_id", user.id)
    .single();
  return data
    ? actionSuccess(data)
    : actionFailure("Buyer interest not found.");
}
