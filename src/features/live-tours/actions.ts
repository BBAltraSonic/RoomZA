"use server";

import { z } from "zod";

import { buildJoinUrl, buildTourRoomId } from "@/features/chat/room";
import { persistAndEnqueueNotifications } from "@/features/notifications/outbox";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/action-result";
import { requireAnyPersona } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import {
  enqueueScheduledTourReminder,
  notifyScheduledTourAudience,
} from "./notifications";
import type { LiveTour, LiveTourWithListing } from "./types";
import { RECORDING_POLICY_VERSION } from "./recording-policy";

const liveTourIdSchema = z.string().uuid("Invalid id.");
const peakSchema = z.number().int().min(0).max(10_000);
const scheduleSchema = z.object({
  listingId: z.string().uuid("Invalid listing id."),
  scheduledAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().min(15).max(120),
});
const participantIdsSchema = z.array(z.string().uuid()).max(250);
const recordingLinkSchema = z.object({
  url: z.string().url().max(2_000).refine((value) => value.startsWith("https://")),
  externalId: z.string().max(500).nullable().optional(),
});

async function notifySavedListingUsers(tour: LiveTour) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  try {
    const admin = createAdminClient();
    const { data: favorites, error: favoritesError } = await admin
      .from("user_favorites")
      .select("user_id")
      .eq("listing_id", tour.listing_id)
      .neq("user_id", tour.host_id)
      .limit(500);

    if (favoritesError) {
      logger.warn("Live-tour saved audience unavailable", { tourId: tour.id, error: favoritesError.message });
      return;
    }
    if (!favorites?.length) return;
    const recipientIds = favorites.map((favorite) => favorite.user_id);
    const { data: recentEvents, error: recentEventsError } = await admin
      .from("notification_events")
      .select("recipient_id")
      .eq("type", "live_tour_started")
      .in("recipient_id", recipientIds)
      .contains("payload", { listingId: tour.listing_id })
      .gte(
        "created_at",
        new Date(Date.now() - 6 * 60 * 60_000).toISOString(),
      );
    if (recentEventsError) {
      logger.warn("Live-tour alert history unavailable", { tourId: tour.id, error: recentEventsError.message });
      return;
    }
    const recentlyNotified = new Set(
      (recentEvents ?? []).map((event) => event.recipient_id),
    );
    const eligibleFavorites = favorites.filter(
      (favorite) => !recentlyNotified.has(favorite.user_id),
    );
    if (!eligibleFavorites.length) return;

    await persistAndEnqueueNotifications(
        eligibleFavorites.map((favorite) => ({
          recipient_id: favorite.user_id,
          actor_id: tour.host_id,
          category: "viewings" as const,
          source_kind: "tour",
          source_id: tour.id,
          type: "live_tour_started" as const,
          idempotency_key: `live_tour_started:${tour.id}:${favorite.user_id}`,
          payload: {
            tourId: tour.id,
            listingId: tour.listing_id,
            message: "A live video tour has started for a home you saved.",
          },
        })),
    );
  } catch (error) {
    logger.error("Failed to enqueue live-tour notifications", {
      tourId: tour.id,
      error,
    });
  }
}

export async function startLiveTour(
  listingId: string,
): Promise<ActionResult<{ tour: LiveTour }>> {
  const parsed = liveTourIdSchema.safeParse(listingId);
  if (!parsed.success) return actionFailure("Invalid listing id.");

  await requireAnyPersona(["landlord", "seller"]);
  const supabase = await createClient();
  const tourId = crypto.randomUUID();
  const roomId = buildTourRoomId(tourId);
  const joinUrl = buildJoinUrl(roomId);

  const { data, error } = await supabase.rpc("start_live_tour", {
    target_listing_id: parsed.data,
    target_tour_id: tourId,
    target_room_id: roomId,
    target_join_url: joinUrl,
  });

  if (error) {
    logger.error("Live tour start RPC failed", {
      listingId: parsed.data,
      error: error.message,
    });
    return actionFailure("The live tour could not be started.");
  }

  const rpcResult = data?.[0];
  if (!rpcResult?.tour_id) {
    const message = rpcResult?.result === "listing_unavailable"
      ? "Publish this listing before going live."
      : rpcResult?.result === "access_denied"
        ? "You cannot start a tour for this listing."
        : "The live tour could not be started.";
    return actionFailure(message);
  }

  const { data: tour, error: tourError } = await supabase
    .from("live_tours")
    .select("*")
    .eq("id", rpcResult.tour_id)
    .single();

  if (tourError || !tour) {
    return actionFailure("The live tour started, but its room could not be loaded.");
  }

  if (tour.status === "live") {
    await notifySavedListingUsers(tour);
  }

  return actionSuccess({ tour });
}

export async function scheduleLiveTour(
  input: z.infer<typeof scheduleSchema>,
): Promise<ActionResult<{ tour: LiveTour }>> {
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure("Choose a valid open-house time and duration.");
  }

  const scheduledAt = new Date(parsed.data.scheduledAt);
  if (
    !Number.isFinite(scheduledAt.getTime())
    || scheduledAt.getTime() < Date.now() + 15 * 60_000
    || scheduledAt.getTime() > Date.now() + 90 * 24 * 60 * 60_000
  ) {
    return actionFailure(
      "Schedule the open house between 15 minutes and 90 days from now.",
    );
  }

  await requireAnyPersona(["landlord", "seller"]);
  const supabase = await createClient();
  const tourId = crypto.randomUUID();
  const roomId = buildTourRoomId(tourId);
  const joinUrl = buildJoinUrl(roomId);
  const { data, error } = await supabase.rpc("schedule_live_tour", {
    target_listing_id: parsed.data.listingId,
    target_tour_id: tourId,
    target_room_id: roomId,
    target_join_url: joinUrl,
    target_scheduled_at: scheduledAt.toISOString(),
    target_duration_minutes: parsed.data.durationMinutes,
  });

  if (error) {
    logger.error("Live tour schedule RPC failed", {
      listingId: parsed.data.listingId,
      error: error.message,
    });
    return actionFailure("The open house could not be scheduled.");
  }

  const rpcResult = data?.[0];
  if (!rpcResult?.tour_id) {
    const message = rpcResult?.result === "listing_unavailable"
      ? "Publish this listing before scheduling an open house."
      : rpcResult?.result === "access_denied"
        ? "You cannot schedule an open house for this listing."
        : rpcResult?.result === "schedule_conflict"
          ? "An open house already uses that time for this listing."
          : rpcResult?.result === "schedule_limit"
            ? "You can keep up to 20 upcoming open houses."
            : rpcResult?.result === "feature_disabled"
              ? "Scheduled open houses are currently unavailable."
              : "The open house could not be scheduled.";
    return actionFailure(message);
  }

  const { data: tour, error: tourError } = await supabase
    .from("live_tours")
    .select("*")
    .eq("id", rpcResult.tour_id)
    .single();

  if (tourError || !tour) {
    return actionFailure(
      "The open house was scheduled, but its details could not be loaded.",
    );
  }

  if (tour.status === "scheduled") {
    await Promise.all([
      notifyScheduledTourAudience(tour, "scheduled"),
      enqueueScheduledTourReminder(tour),
    ]);
  }

  return actionSuccess({ tour });
}

export async function startScheduledLiveTour(
  tourId: string,
): Promise<ActionResult<{ tour: LiveTour }>> {
  const parsed = liveTourIdSchema.safeParse(tourId);
  if (!parsed.success) return actionFailure("Invalid scheduled open house.");

  await requireAnyPersona(["landlord", "seller"]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_scheduled_live_tour", {
    target_tour_id: parsed.data,
  });
  const rpcResult = data?.[0];

  if (error || !rpcResult?.tour_id) {
    if (error) {
      logger.error("Scheduled live tour start RPC failed", {
        tourId: parsed.data,
        error: error.message,
      });
    }
    const message = rpcResult?.result === "outside_start_window"
      ? "This open house can start up to 30 minutes before its scheduled time."
      : rpcResult?.result === "already_live"
        ? "A live tour is already running for this listing."
        : "The scheduled open house could not be started.";
    return actionFailure(message);
  }

  const { data: tour, error: tourError } = await supabase
    .from("live_tours")
    .select("*")
    .eq("id", rpcResult.tour_id)
    .single();
  if (tourError || !tour) {
    return actionFailure("The live room could not be loaded.");
  }

  if (tour.status !== "live") return actionFailure("The scheduled open house is not live. Check its current status.");
  await notifySavedListingUsers(tour);
  return actionSuccess({ tour });
}

export async function cancelScheduledLiveTour(
  tourId: string,
): Promise<ActionResult<{ status: "cancelled" }>> {
  const parsed = liveTourIdSchema.safeParse(tourId);
  if (!parsed.success) return actionFailure("Invalid scheduled open house.");

  await requireAnyPersona(["landlord", "seller"]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_scheduled_live_tour", {
    target_tour_id: parsed.data,
  });
  const rpcResult = data?.[0];

  if (
    error
    || !rpcResult
    || rpcResult.result === "access_denied"
    || rpcResult.result === "invalid_state"
  ) {
    if (error) {
      logger.error("Scheduled live tour cancel RPC failed", {
        tourId: parsed.data,
        error: error.message,
      });
    }
    return actionFailure("The scheduled open house could not be cancelled.");
  }

  return actionSuccess({ status: "cancelled" });
}

export async function endLiveTour(
  tourId: string,
  peakViewers: number,
): Promise<ActionResult<{ status: "ended" }>> {
  const parsedId = liveTourIdSchema.safeParse(tourId);
  const parsedPeak = peakSchema.safeParse(peakViewers);
  if (!parsedId.success || !parsedPeak.success) {
    return actionFailure("Invalid live tour.");
  }

  await requireAnyPersona(["landlord", "seller"]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("end_live_tour", {
    target_tour_id: parsedId.data,
    observed_peak_viewers: parsedPeak.data,
  });

  const rpcResult = data?.[0];
  if (error || !rpcResult || !["ended", "noop"].includes(rpcResult.result) || rpcResult.new_status !== "ended") {
    if (error) {
      logger.error("Live tour end RPC failed", {
        tourId: parsedId.data,
        error: error.message,
      });
    }
    return actionFailure("The live tour could not be ended.");
  }

  return actionSuccess({ status: "ended" });
}

export async function setLiveTourRecordingConsent(
  tourId: string,
  granted: boolean,
): Promise<ActionResult<{ granted: boolean }>> {
  const parsed = liveTourIdSchema.safeParse(tourId);
  if (!parsed.success || typeof granted !== "boolean") {
    return actionFailure("Invalid recording consent.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return actionFailure("Sign in to manage recording consent.");

  const { data, error } = await supabase.rpc(
    "set_live_tour_recording_consent",
    {
      target_tour_id: parsed.data,
      target_granted: granted,
      target_policy_version: RECORDING_POLICY_VERSION,
    },
  );
  const rpcResult = data?.[0];
  if (error || !rpcResult || rpcResult.result !== "updated") {
    if (error) {
      logger.error("Live tour recording consent RPC failed", {
        tourId: parsed.data,
        userId: user.id,
        error: error.message,
      });
    }
    return actionFailure("Your recording choice could not be saved.");
  }

  return actionSuccess({ granted: rpcResult.granted });
}

export async function startLiveTourRecording(
  tourId: string,
  activeParticipantIds: string[],
): Promise<ActionResult<{ status: "recording" }>> {
  const parsedTour = liveTourIdSchema.safeParse(tourId);
  const parsedParticipants = participantIdsSchema.safeParse(activeParticipantIds);
  if (!parsedTour.success || !parsedParticipants.success) {
    return actionFailure("Invalid recording participants.");
  }

  await requireAnyPersona(["landlord", "seller"]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_live_tour_recording", {
    target_tour_id: parsedTour.data,
    target_participant_ids: [...new Set(parsedParticipants.data)],
  });
  const rpcResult = data?.[0];

  if (error || !rpcResult || rpcResult.result !== "recording") {
    if (error) {
      logger.error("Live tour recording start RPC failed", {
        tourId: parsedTour.data,
        error: error.message,
      });
    }
    const message = rpcResult?.result === "feature_disabled"
      ? "Recording is unavailable until legal review enables it."
      : rpcResult?.result === "consent_required"
        ? `${rpcResult.missing_consents} active participant${rpcResult.missing_consents === 1 ? "" : "s"} still need to consent.`
        : rpcResult?.result === "viewer_required"
          ? "At least one viewer must join and consent before recording."
          : "Recording could not be started.";
    return actionFailure(message);
  }

  return actionSuccess({ status: "recording" });
}

export async function finishLiveTourRecording(
  tourId: string,
  result: "stopped" | "failed",
  errorMessage?: string,
): Promise<ActionResult<{ status: "stopped" | "failed" }>> {
  const parsed = liveTourIdSchema.safeParse(tourId);
  if (!parsed.success || !["stopped", "failed"].includes(result)) return actionFailure("Invalid live tour.");

  await requireAnyPersona(["landlord", "seller"]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("finish_live_tour_recording", {
    target_tour_id: parsed.data,
    target_result: result,
    target_error: errorMessage?.slice(0, 1_000),
  });
  const rpcResult = data?.[0];
  if (error || !rpcResult || !["stopped", "failed"].includes(rpcResult.new_status ?? "")) {
    if (error) {
      logger.error("Live tour recording finish RPC failed", {
        tourId: parsed.data,
        result,
        error: error.message,
      });
    }
    return actionFailure("The recording state could not be updated.");
  }

  return actionSuccess({ status: rpcResult.new_status as "stopped" | "failed" });
}

export async function saveLiveTourRecordingLink(
  tourId: string,
  input: { url: string; externalId?: string | null },
): Promise<ActionResult<{ saved: true }>> {
  const parsedTour = liveTourIdSchema.safeParse(tourId);
  const parsedLink = recordingLinkSchema.safeParse(input);
  if (!parsedTour.success || !parsedLink.success) {
    return actionFailure("Invalid recording link.");
  }

  await requireAnyPersona(["landlord", "seller"]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "set_live_tour_recording_link",
    {
      target_tour_id: parsedTour.data,
      target_recording_url: parsedLink.data.url,
      target_external_id: parsedLink.data.externalId ?? undefined,
    },
  );
  if (error || data?.[0]?.result !== "saved") {
    if (error) {
      logger.error("Live tour recording link RPC failed", {
        tourId: parsedTour.data,
        error: error.message,
      });
    }
    return actionFailure("The recording link could not be saved.");
  }

  return actionSuccess({ saved: true });
}

export async function getHostUpcomingLiveTours(): Promise<LiveTour[]> {
  await requireAnyPersona(["landlord", "seller"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("live_tours")
    .select("*")
    .eq("status", "scheduled")
    .gte("scheduled_at", new Date(Date.now() - 30 * 60_000).toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(100);

  if (error) {
    logger.error("Host scheduled live tours query failed", {
      error: error.message,
    });
    return [];
  }
  return data ?? [];
}

export async function getLiveTour(
  tourId: string,
): Promise<LiveTourWithListing | null> {
  const parsed = liveTourIdSchema.safeParse(tourId);
  if (!parsed.success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("live_tours")
    .select(`
      *,
      listing:listings!inner(id, title, address, landlord_id, status)
    `)
    .eq("id", parsed.data)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as LiveTourWithListing;
}

export async function getLiveTourTerminalState(tourId: string): Promise<{ status: "ended" | "cancelled"; listingId: string } | null> {
  const parsed = liveTourIdSchema.safeParse(tourId);
  if (!parsed.success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_live_tour_terminal_state", { target_tour_id: parsed.data });
  const terminal = data?.[0];
  if (error || !terminal || !["ended", "cancelled"].includes(terminal.status)) return null;
  return { status: terminal.status as "ended" | "cancelled", listingId: terminal.listing_id };
}
