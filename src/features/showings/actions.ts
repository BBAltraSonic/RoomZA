"use server";

import { z } from "zod";

import { actionFailure, actionSuccess, type ActionResult } from "@/lib/action-result";
import { enqueueNotificationEvent } from "@/features/notifications/outbox";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

import type { ShowingStatus, ShowingWindow } from "./showing-status";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** A single instant-showing request row. */
export type ShowingRequest = Database["public"]["Tables"]["showing_requests"]["Row"];

const idSchema = z.string().min(1, "Invalid id.");
const windowSchema = z.enum(["now", "within_15", "within_30", "today"]);
const requestSchema = z.object({
  listingId: z.string().min(1, "Invalid listing id."),
  window: windowSchema,
  etaMinutes: z.number().int().min(0).max(24 * 60).optional(),
});

export async function getLatestLandlordShowing(): Promise<ShowingRequest | null> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return null;

  const { data, error } = await supabase
    .from("showing_requests")
    .select("*")
    .eq("landlord_id", userData.user.id)
    .in("status", ["requested", "accepted", "checked_in"])
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.warn("Failed to load latest landlord showing", {
      landlordId: userData.user.id,
      error: error.message,
    });
    return null;
  }
  return data;
}

type ShowingNotificationType =
  | "showing_request"
  | "showing_accepted"
  | "showing_declined";

/**
 * Enqueues a single showing notification through the existing outbox pattern
 * (mirrors `enqueueCallNotification`): insert a `notification_events` row, then
 * hand its id to `enqueueNotificationEvent`.
 *
 * Wrapped in try/catch so a notification failure NEVER fails the originating
 * showing action. Idempotency keys namespace by type + request id.
 */
async function enqueueShowingNotification(
  supabase: SupabaseServerClient,
  notification: {
    recipientId: string;
    type: ShowingNotificationType;
    requestId: string;
    listingId: string;
    message: string;
  },
): Promise<void> {
  try {
    const { data: event } = await supabase
      .from("notification_events")
      .insert({
        recipient_id: notification.recipientId,
        type: notification.type,
        idempotency_key: `${notification.type}:${notification.requestId}`,
        payload: {
          requestId: notification.requestId,
          listingId: notification.listingId,
          message: notification.message,
        },
      })
      .select("id")
      .single();

    if (event?.id) {
      await enqueueNotificationEvent(event.id);
    }
  } catch (error) {
    logger.error("Failed to enqueue showing notification", {
      recipientId: notification.recipientId,
      type: notification.type,
      error,
    });
  }
}

/**
 * Requests an instant showing on a listing (design §3.3).
 *
 * Verifies the requester is authenticated, then delegates to `request_showing`,
 * which performs the participant/authorisation check first (requester must not
 * be the landlord, listing must be published), enforces the single-live-request
 * invariant via the partial unique index, and inserts the `requested` row
 * atomically. RPC `result` mapping:
 * - `requested`           → success with the created request
 * - `request_in_progress` → a live request already exists for this pair
 * - `own_listing`         → cannot request a showing on your own listing
 * - `listing_unavailable` → listing missing or not published
 * - `unauthenticated`     → auth error
 */
export async function requestShowing(input: {
  listingId: string;
  window: ShowingWindow;
  etaMinutes?: number;
}): Promise<ActionResult<{ request: ShowingRequest }>> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure(parsed.error.issues[0]?.message ?? "Invalid showing request.");
  }

  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return actionFailure("You must be signed in to request a showing.");
  }

  const { data, error } = await supabase.rpc("request_showing", {
    target_listing_id: parsed.data.listingId,
    window_choice: parsed.data.window,
    eta_minutes: parsed.data.etaMinutes,
  });

  if (error) {
    return actionFailure(error.message);
  }

  const outcome = data?.[0];
  if (!outcome) {
    return actionFailure("Failed to request a showing.");
  }

  switch (outcome.result) {
    case "requested": {
      if (!outcome.request_id) {
        return actionFailure("Failed to request a showing.");
      }

      const { data: request, error: fetchError } = await supabase
        .from("showing_requests")
        .select("*")
        .eq("id", outcome.request_id)
        .single();

      if (fetchError || !request) {
        return actionFailure(fetchError?.message ?? "Failed to load the showing request.");
      }

      // Notify the landlord of the incoming request. Non-fatal.
      await enqueueShowingNotification(supabase, {
        recipientId: request.landlord_id,
        type: "showing_request",
        requestId: request.id,
        listingId: request.listing_id,
        message: "A renter wants to view your listing now.",
      });

      return actionSuccess({ request });
    }
    case "request_in_progress":
      return actionFailure("You already have a live showing request for this listing.");
    case "own_listing":
      return actionFailure("You can't request a showing on your own listing.");
    case "listing_unavailable":
      return actionFailure("This listing is no longer available.");
    default:
      return actionFailure("Failed to request a showing.");
  }
}

/**
 * Shared guarded path for every transition off a live request.
 *
 * Verifies authentication, then delegates to `respond_showing`, which re-checks
 * party membership and transition legality (the DB is authoritative;
 * `showing-status.ts` mirrors the same rules for the UI). RPC `result` mapping:
 * - `updated` / `noop`     → success with the returned `new_status` (idempotent)
 * - `access_denied`        → not a party to this request
 * - `invalid_transition`   → benign; client should refetch to resync
 */
async function transitionShowing(
  requestId: string,
  action: "accept" | "decline" | "check_in" | "complete" | "cancel",
): Promise<ActionResult<{ status: ShowingStatus }>> {
  const parsed = idSchema.safeParse(requestId);
  if (!parsed.success) {
    return actionFailure("Invalid showing id.");
  }

  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return actionFailure("You must be signed in to manage a showing.");
  }

  const { data, error } = await supabase.rpc("respond_showing", {
    target_request_id: parsed.data,
    action,
  });

  if (error) {
    return actionFailure(error.message);
  }

  const outcome = data?.[0];
  if (!outcome) {
    return actionFailure("Failed to update the showing.");
  }

  switch (outcome.result) {
    case "updated":
    case "noop": {
      if (!outcome.new_status) {
        return actionFailure("Failed to update the showing.");
      }
      const status = outcome.new_status as ShowingStatus;

      // Notify the renter when the landlord accepts or declines. Non-fatal.
      if (outcome.result === "updated" && (status === "accepted" || status === "declined")) {
        await notifyShowingResponse(supabase, parsed.data, status);
      }

      return actionSuccess({ status });
    }
    case "access_denied":
      return actionFailure("You are not part of this showing request.");
    case "invalid_transition":
      return actionFailure("This showing request is no longer available.");
    default:
      return actionFailure("Failed to update the showing.");
  }
}

/** Notifies the renter of an accept/decline outcome. Non-fatal. */
async function notifyShowingResponse(
  supabase: SupabaseServerClient,
  requestId: string,
  status: "accepted" | "declined",
): Promise<void> {
  try {
    const { data: request } = await supabase
      .from("showing_requests")
      .select("renter_id, listing_id")
      .eq("id", requestId)
      .single();

    if (!request) {
      return;
    }

    await enqueueShowingNotification(supabase, {
      recipientId: request.renter_id,
      type: status === "accepted" ? "showing_accepted" : "showing_declined",
      requestId,
      listingId: request.listing_id,
      message:
        status === "accepted"
          ? "Your showing request was accepted. Head over now."
          : "Your showing request was declined.",
    });
  } catch (error) {
    logger.error("Failed to notify showing response", { requestId, status, error });
  }
}

/** Landlord accepts a pending request (`requested → accepted`). */
export async function acceptShowing(requestId: string) {
  return transitionShowing(requestId, "accept");
}

/** Landlord declines a pending request (`requested → declined`). */
export async function declineShowing(requestId: string) {
  return transitionShowing(requestId, "decline");
}

/** Renter checks in on an accepted request (`accepted → checked_in`). */
export async function checkInShowing(requestId: string) {
  return transitionShowing(requestId, "check_in");
}

/** Either party completes a checked-in showing (`checked_in → completed`). */
export async function completeShowing(requestId: string) {
  return transitionShowing(requestId, "complete");
}

/** Either party cancels any live request (`* → cancelled`). */
export async function cancelShowing(requestId: string) {
  return transitionShowing(requestId, "cancel");
}
