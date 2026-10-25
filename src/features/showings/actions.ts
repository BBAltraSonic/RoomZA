"use server";

import { z } from "zod";

import { actionFailure, actionSuccess, type ActionResult } from "@/lib/action-result";
import { recordAndEnqueueNotifications } from "@/features/notifications/outbox";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

import type { ShowingStatus, ShowingWindow } from "./showing-status";

/** A single instant-showing request row. */
export type ShowingRequest = Database["public"]["Tables"]["showing_requests"]["Row"];

const idSchema = z.string().uuid("Invalid id.");
const windowSchema = z.enum(["now", "within_15", "within_30", "today"]);
const requestSchema = z.object({
  listingId: z.string().uuid("Invalid listing id."),
  window: windowSchema,
  etaMinutes: z.number().int().min(0).max(24 * 60).optional(),
});

export async function getLatestLandlordShowing(): Promise<ShowingRequest | null> {
  const result = await getLandlordShowingState();
  return result.success ? result.data.request : null;
}

/** Distinguish an unavailable read from an empty inbox during client recovery. */
export async function getLandlordShowingState(): Promise<ActionResult<{ request: ShowingRequest | null }>> {
  const supabase = await createClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError && authError.name !== "AuthSessionMissingError") return actionFailure("Showing requests could not be loaded. Try again.");
  if (!userData?.user) return actionSuccess({ request: null });

  const { data, error } = await supabase
    .from("showing_requests")
    .select("*")
    .eq("landlord_id", userData.user.id)
    .in("status", ["requested", "accepted", "checked_in"])
    .or(`status.neq.requested,expires_at.gte.${new Date().toISOString()}`)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.warn("Failed to load latest landlord showing", {
      landlordId: userData.user.id,
      error: error.message,
    });
    return actionFailure("Showing requests could not be loaded. Try again.");
  }
  return actionSuccess({ request: data });
}

/** A renter resumes their own live request after reopening, reload or reconnect. */
export async function getCurrentShowing(listingId: string): Promise<ActionResult<{ request: ShowingRequest | null }>> {
  const parsed = idSchema.safeParse(listingId);
  if (!parsed.success) return actionFailure("Invalid listing id.");
  const supabase = await createClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError && authError.name !== "AuthSessionMissingError") return actionFailure("Your showing request could not be loaded. Try again.");
  if (!userData?.user) return actionSuccess({ request: null });
  const { data, error } = await supabase.from("showing_requests").select("*")
    .eq("listing_id", parsed.data).eq("renter_id", userData.user.id)
    .in("status", ["requested", "accepted", "checked_in"])
    .or(`status.neq.requested,expires_at.gte.${new Date().toISOString()}`)
    .order("requested_at", { ascending: false }).limit(1).maybeSingle();
  return error ? actionFailure("Your showing request could not be loaded. Try again.") : actionSuccess({ request: data });
}

type ShowingNotificationType =
  | "showing_request"
  | "showing_accepted"
  | "showing_declined";

/**
 * Enqueues a single showing notification through the existing outbox pattern
 * (mirrors `enqueueCallNotification`), only after an authorized RPC succeeds.
 *
 * Wrapped in try/catch so a notification failure NEVER fails the originating
 * showing action. Idempotency keys namespace by type + request id.
 */
async function enqueueShowingNotification(
  notification: {
    recipientId: string;
    actorId: string;
    type: ShowingNotificationType;
    requestId: string;
    listingId: string;
    message: string;
  },
): Promise<void> {
  try {
    await recordAndEnqueueNotifications({
      recipient_id: notification.recipientId,
      actor_id: notification.actorId,
      category: "viewings",
      source_kind: "showing",
      source_id: notification.requestId,
      type: notification.type,
      idempotency_key: `${notification.type}:${notification.requestId}`,
      payload: {
        requestId: notification.requestId,
        listingId: notification.listingId,
        message: notification.message,
      },
    });
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
    return actionFailure("The showing request could not be confirmed. Check your current request and try again.");
  }

  const outcome = data?.[0];
  if (!outcome) {
    return actionFailure("Failed to request a showing.");
  }

  switch (outcome.result) {
    case "requested":
    case "request_in_progress": {
      if (!outcome.request_id) {
        return actionFailure(outcome.result === "request_in_progress"
          ? "You already have a live showing request for this listing."
          : "Failed to request a showing.");
      }

      const { data: request, error: fetchError } = await supabase
        .from("showing_requests")
        .select("*")
        .eq("id", outcome.request_id)
        .single();

      if (fetchError || !request) {
        return actionFailure("The showing request could not be loaded. Reopen Connect to check it.");
      }

      // Notify the landlord of the incoming request. Non-fatal.
      if (request.status === "requested") await enqueueShowingNotification({
        recipientId: request.landlord_id,
        actorId: request.renter_id,
        type: "showing_request",
        requestId: request.id,
        listingId: request.listing_id,
        message: "A renter wants to view your listing now.",
      });

      return actionSuccess({ request });
    }
    case "own_listing":
      return actionFailure("You can't request a showing on your own listing.");
    case "listing_unavailable":
      return actionFailure("This listing is no longer available.");
    case "landlord_unavailable":
      return actionFailure("The landlord is unavailable for an immediate showing. Choose another time.");
    case "access_denied":
      return actionFailure("This showing request is unavailable. Check your account or contact preferences.");
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
): Promise<ActionResult<{ status: ShowingStatus; request: ShowingRequest }>> {
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
    return actionFailure("The showing response could not be confirmed. Check the request and try again.");
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
      const { data: request, error: readError } = await supabase.from("showing_requests").select("*").eq("id", parsed.data).single();
      if (readError || !request) return actionFailure("The showing was updated but could not be loaded. Reopen it to check the current status.");
      const status = request.status as ShowingStatus;

      // Notify the renter when the landlord accepts or declines. Non-fatal.
      if (status === "accepted" || status === "declined") {
        await notifyShowingResponse(request, status);
      }

      return actionSuccess({ status, request });
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
  request: ShowingRequest,
  status: "accepted" | "declined",
): Promise<void> {
  try {
    await enqueueShowingNotification({
      recipientId: request.renter_id,
      actorId: request.landlord_id,
      type: status === "accepted" ? "showing_accepted" : "showing_declined",
      requestId: request.id,
      listingId: request.listing_id,
      message:
        status === "accepted"
          ? "Your showing request was accepted. Head over now."
          : "Your showing request was declined.",
    });
  } catch (error) {
    logger.error("Failed to notify showing response", { requestId: request.id, status, error });
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
