import { sendEmail } from "@/features/notifications/send";
import { enqueueNotificationEvent } from "@/features/notifications/outbox";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import { shouldSendMessageDigest } from "./preference-policy";

type NotificationEvent = {
  id: string;
  recipient_id: string;
  type: string;
  payload: Json;
  attempt_count?: number | null;
  profiles: { email: string } | { email: string }[] | null;
};

type NotificationPayload = {
  message?: string;
};

type NotificationJobResult =
  | { sent: true }
  | { sent: false; code: "not_found" | "validation_failed" | "server_error"; message: string; httpStatus: number };

type DigestEvent = {
  id: string;
  recipient_id: string;
  type: string;
  payload: Json;
  profiles: { email: string } | { email: string }[] | null;
};

type DigestResult =
  | { success: true; message?: string; processed?: number }
  | { success: false; code: "server_error"; message: string; httpStatus: number };

function getRecipientEmail(event: NotificationEvent | DigestEvent) {
  const profile = Array.isArray(event.profiles) ? event.profiles[0] : event.profiles;
  return profile?.email ?? null;
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

async function createFailureAlerts(eventId: string, attemptCount: number, requestId: string) {
  if (attemptCount < 3) return;
  const supabase = createClient();
  const { data: owners } = await supabase.from("admin_memberships" as never).select("user_id").eq("level", "owner").is("revoked_at", null) as unknown as { data: { user_id: string }[] | null };
  for (const owner of owners ?? []) {
    const { data } = await supabase.from("notification_events").upsert({
      recipient_id: owner.user_id,
      type: "admin_alert",
      payload: { message: "A notification failed three delivery attempts and needs review.", eventId },
      idempotency_key: `notification-failure:${eventId}:${owner.user_id}`,
    } as never, { onConflict: "idempotency_key", ignoreDuplicates: true }).select("id").maybeSingle();
    if (data?.id) await enqueueNotificationEvent(data.id, requestId);
  }
}

export async function processNotificationJob(eventId: string, requestId: string): Promise<NotificationJobResult> {
  const supabase = createClient();
  const now = new Date().toISOString();
  const { data: event, error } = await supabase
    .from("notification_events")
    .update({ locked_at: now } as never)
    .eq("id", eventId)
    .is("sent_at", null)
    .select("id, recipient_id, type, payload, attempt_count, profiles!inner(email)")
    .single();

  if (error || !event) {
    logger.warn("Notification job event unavailable", { requestId, eventId, error });
    return { sent: false, code: "not_found", message: "Notification event not found.", httpStatus: 404 };
  }

  const notification = event as unknown as NotificationEvent;
  const email = getRecipientEmail(notification);
  if (!email) {
    await supabase
      .from("notification_events")
      .update({ last_error: "recipient_email_missing", locked_at: null } as never)
      .eq("id", notification.id);
    return { sent: false, code: "validation_failed", message: "Recipient email missing.", httpStatus: 422 };
  }

  const payload = notification.payload as NotificationPayload | null;
  const message = payload?.message || "You have a new Pinpoints update.";
  const html = `<div style="font-family:sans-serif;padding:20px;"><h2>Pinpoints update</h2><p>${escapeHtml(message)}</p></div>`;
  const result = await sendEmail(email, "Pinpoints notification", html);

  if (result.error) {
    const attemptCount = (notification.attempt_count ?? 0) + 1;
    const nextAttempt = new Date(Date.now() + Math.min(60 * 60 * 1000, 2 ** attemptCount * 60 * 1000)).toISOString();
    await supabase
      .from("notification_events")
      .update({
        attempt_count: attemptCount,
        last_error: String(result.error instanceof Error ? result.error.message : result.error),
        locked_at: null,
        next_attempt_at: nextAttempt,
      } as never)
      .eq("id", notification.id);

    logger.error("Notification job send failed", { requestId, eventId: notification.id, error: result.error });
    if (notification.type !== "admin_alert") await createFailureAlerts(notification.id, attemptCount, requestId);
    return { sent: false, code: "server_error", message: "Notification send failed.", httpStatus: 500 };
  }

  await supabase
    .from("notification_events")
    .update({ sent_at: now, locked_at: null, last_error: null } as never)
    .eq("id", notification.id);

  return { sent: true };
}

export async function processNotificationDigest(requestId: string): Promise<DigestResult> {
  const supabase = createClient();
  const now = new Date();

  const { data: events, error } = await supabase
    .from("notification_events")
    .select("id, recipient_id, type, payload, profiles!inner(email)")
    .is("sent_at", null)
    .is("digest_at", null)
    .is("locked_at", null)
    .lte("next_attempt_at", new Date().toISOString());

  if (error || !events) {
    logger.error("Notification digest fetch failed", { requestId, error });
    return { success: false, code: "server_error", message: "Failed to fetch events", httpStatus: 500 };
  }

  if (events.length === 0) {
    return { success: true, message: "No events to process" };
  }

  const digestEvents = (events as DigestEvent[]).filter((event) => event.type === "new_message");
  const recipientIds = [...new Set(digestEvents.map((event) => event.recipient_id))];
  const { data: preferenceRows } = recipientIds.length
    ? await supabase.from("notification_preferences" as never).select("user_id, message_digest, digest_frequency").in("user_id", recipientIds) as unknown as { data: { user_id: string; message_digest: boolean; digest_frequency: "never" | "daily" | "weekly" }[] | null }
    : { data: [] };
  const preferenceMap = new Map((preferenceRows ?? []).map((row) => [row.user_id, row]));
  const eligibleEvents = digestEvents.filter((event) => {
    const row = preferenceMap.get(event.recipient_id);
    return shouldSendMessageDigest({ messageDigest: row?.message_digest ?? true, digestFrequency: row?.digest_frequency ?? "daily" }, now);
  });
  const disabledIds = digestEvents.filter((event) => !eligibleEvents.includes(event)).filter((event) => {
    const row = preferenceMap.get(event.recipient_id);
    return row?.message_digest === false || row?.digest_frequency === "never";
  }).map((event) => event.id);
  if (disabledIds.length) await supabase.from("notification_events").update({ digest_at: now.toISOString() }).in("id", disabledIds);

  const userDigests = eligibleEvents.reduce(
    (acc, event) => {
      const email = getRecipientEmail(event);
      if (!email) return acc;

      acc[email] ??= { events: [], ids: [] };
      acc[email].events.push(event);
      acc[email].ids.push(event.id);
      return acc;
    },
    {} as Record<string, { events: DigestEvent[]; ids: string[] }>,
  );

  for (const [email, userObj] of Object.entries(userDigests)) {
    const htmlContent = `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #000; text-transform: uppercase;">Pinpoints Updates</h2>
        <ul style="border: 2px solid #000; padding: 20px; background: #fff;">
          ${userObj.events.map((event) => {
            const payload = event.payload as NotificationPayload | null;
            return `<li style="margin-bottom: 10px;"><strong>${event.type}:</strong> ${payload?.message || "New update"}</li>`;
          }).join("")}
        </ul>
      </div>
    `;
    const result = await sendEmail(email, "Your Pinpoints Digest", htmlContent);

    if (!result.error) {
      await supabase
        .from("notification_events")
        .update({ digest_at: now.toISOString() })
        .in("id", userObj.ids);
    } else {
      logger.error("Notification digest send failed", { requestId, error: result.error });
      await supabase
        .from("notification_events")
        .update({
          attempt_count: 1,
          last_error: String(result.error instanceof Error ? result.error.message : result.error),
          next_attempt_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        })
        .in("id", userObj.ids);
    }
  }

  return { success: true, processed: eligibleEvents.length };
}
