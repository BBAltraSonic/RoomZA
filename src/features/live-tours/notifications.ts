import "server-only";

import { enqueueNotificationEvent } from "@/features/notifications/outbox";
import { sendEmail } from "@/features/notifications/send";
import { logger } from "@/lib/logger";
import { publishJsonJob } from "@/lib/qstash";
import { createClient as createAdminClient } from "@/lib/supabase/admin";

import { selectTourAlertAudience } from "./notification-audience";
import type { LiveTour } from "./types";

type NotificationKind = "scheduled" | "reminder";

type AlertListing = {
  id: string;
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  price: number;
  sale_price: number | null;
  listing_type: "rent" | "sale";
  bedrooms: number;
  bathrooms: number;
  property_type: string | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatScheduledTime(value: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Johannesburg",
  }).format(new Date(value));
}

function messageFor(
  kind: NotificationKind,
  title: string,
  scheduledAt: string,
) {
  const time = formatScheduledTime(scheduledAt);
  return kind === "scheduled"
    ? `A live open house for ${title} is scheduled for ${time}.`
    : `The live open house for ${title} starts at ${time}.`;
}

export async function notifyScheduledTourAudience(
  tour: LiveTour,
  kind: NotificationKind,
) {
  if (!tour.scheduled_at || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { recipients: 0, anonymousEmails: 0 };
  }

  const admin = createAdminClient();
  const [
    { data: listingData, error: listingError },
    { data: favorites },
    { data: searchAlerts },
  ] = await Promise.all([
    admin
      .from("listings")
      .select(
        "id, title, address, latitude, longitude, price, sale_price, listing_type, bedrooms, bathrooms, property_type",
      )
      .eq("id", tour.listing_id)
      .maybeSingle(),
    admin
      .from("user_favorites")
      .select("user_id")
      .eq("listing_id", tour.listing_id)
      .neq("user_id", tour.host_id)
      .limit(1_000),
    admin
      .from("search_alerts")
      .select(
        "user_id, email, bounding_box_west, bounding_box_south, bounding_box_east, bounding_box_north, filters",
      )
      .limit(2_000),
  ]);

  if (listingError || !listingData) {
    logger.error("Scheduled tour audience listing unavailable", {
      tourId: tour.id,
      error: listingError?.message,
    });
    return { recipients: 0, anonymousEmails: 0 };
  }

  const candidateUserIds = [
    ...new Set(
      (searchAlerts ?? [])
        .map((alert) => alert.user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const { data: preferenceRows } = candidateUserIds.length
    ? await admin
        .from("notification_preferences")
        .select("user_id, search_alerts")
        .in("user_id", candidateUserIds)
    : { data: [] };
  const disabledIds = (preferenceRows ?? [])
    .filter((row) => !row.search_alerts)
    .map((row) => row.user_id);
  const listing = listingData as AlertListing;
  const audience = selectTourAlertAudience({
    listing: {
      id: listing.id,
      title: listing.title,
      address: listing.address,
      latitude: Number(listing.latitude),
      longitude: Number(listing.longitude),
      price: listing.price,
      salePrice: listing.sale_price,
      listingType: listing.listing_type,
      bedrooms: Number(listing.bedrooms),
      bathrooms: Number(listing.bathrooms),
      propertyType: listing.property_type,
    },
    savedListings: favorites ?? [],
    searchAlerts: searchAlerts ?? [],
    searchAlertsDisabledFor: disabledIds,
  });
  const message = messageFor(kind, listing.title, tour.scheduled_at);
  const notificationType = kind === "scheduled"
    ? "live_tour_scheduled" as const
    : "live_tour_reminder" as const;

  const { data: events, error: eventError } = audience.recipientIds.length
    ? await admin
        .from("notification_events")
        .upsert(
          audience.recipientIds.map((recipientId) => ({
            recipient_id: recipientId,
            type: notificationType,
            idempotency_key:
              `${notificationType}:${tour.id}:${recipientId}`,
            payload: {
              tourId: tour.id,
              listingId: tour.listing_id,
              scheduledAt: tour.scheduled_at,
              message,
            },
          })),
          { onConflict: "idempotency_key", ignoreDuplicates: true },
        )
        .select("id")
    : { data: [], error: null };

  if (eventError) {
    logger.error("Scheduled tour notifications could not be created", {
      tourId: tour.id,
      kind,
      error: eventError.message,
    });
  }

  await Promise.all(
    (events ?? []).map((event) => enqueueNotificationEvent(event.id)),
  );

  const subject = kind === "scheduled"
    ? "Live open house scheduled"
    : "Live open house reminder";
  const safeMessage = escapeHtml(message);
  const emailResults = await Promise.all(
    audience.anonymousEmails.map((email) =>
      sendEmail(
        email,
        subject,
        `<div style="font-family:sans-serif;padding:20px"><h2>${subject}</h2><p>${safeMessage}</p></div>`,
      )
    ),
  );
  const failedAnonymous = emailResults.filter((result) => "error" in result);
  if (failedAnonymous.length) {
    logger.warn("Some anonymous scheduled-tour alerts failed", {
      tourId: tour.id,
      kind,
      failedCount: failedAnonymous.length,
    });
  }

  return {
    recipients: events?.length ?? 0,
    anonymousEmails: audience.anonymousEmails.length - failedAnonymous.length,
  };
}

export async function enqueueScheduledTourReminder(tour: LiveTour) {
  if (!tour.scheduled_at) return { skipped: true as const };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const notBefore = Math.max(
    Math.floor(Date.now() / 1_000) + 5,
    Math.floor(
      (new Date(tour.scheduled_at).getTime() - 60 * 60_000) / 1_000,
    ),
  );

  try {
    return await publishJsonJob(
      `${appUrl}/api/jobs/live-tours/reminder`,
      { tourId: tour.id, scheduledAt: tour.scheduled_at },
      `live-tour-reminder:${tour.id}:${tour.scheduled_at}`,
      { notBefore },
    );
  } catch (error) {
    logger.error("Scheduled tour reminder queue publish failed", {
      tourId: tour.id,
      error,
    });
    return { skipped: true as const };
  }
}

export async function processScheduledTourReminder(
  tourId: string,
  expectedScheduledAt: string,
  requestId: string,
) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("live_tours")
    .select("*")
    .eq("id", tourId)
    .maybeSingle();

  if (error || !data) {
    logger.warn("Scheduled tour reminder target unavailable", {
      requestId,
      tourId,
      error: error?.message,
    });
    return { success: false as const, code: "not_found" as const };
  }

  if (
    data.status !== "scheduled"
    || data.scheduled_at !== expectedScheduledAt
    || data.reminder_sent_at
  ) {
    return { success: true as const, skipped: true as const };
  }

  await notifyScheduledTourAudience(data, "reminder");
  const { error: updateError } = await admin
    .from("live_tours")
    .update({ reminder_sent_at: new Date().toISOString() })
    .eq("id", tourId)
    .eq("status", "scheduled")
    .is("reminder_sent_at", null);

  if (updateError) {
    logger.error("Scheduled tour reminder could not be marked complete", {
      requestId,
      tourId,
      error: updateError.message,
    });
    return { success: false as const, code: "server_error" as const };
  }

  return { success: true as const, skipped: false as const };
}
