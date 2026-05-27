import { Receiver } from "@upstash/qstash";
import { z } from "zod";

import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import { sendEmail } from "@/features/notifications/send";

const jobSchema = z.object({
  eventId: z.string().uuid(),
});

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

function getRecipientEmail(event: NotificationEvent) {
  const profile = Array.isArray(event.profiles) ? event.profiles[0] : event.profiles;
  return profile?.email ?? null;
}

async function verifyQstashSignature(request: Request, body: string) {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentSigningKey || !nextSigningKey) {
    return process.env.NODE_ENV !== "production";
  }

  const signature = request.headers.get("upstash-signature");
  if (!signature) return false;

  const receiver = new Receiver({ currentSigningKey, nextSigningKey });
  return receiver.verify({
    signature,
    body,
    url: request.url,
  });
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const rawBody = await request.text();
  const verified = await verifyQstashSignature(request, rawBody);

  if (!verified) {
    return apiFailure({ code: "unauthorized", message: "Invalid job signature." }, 401, { requestId });
  }

  const parsed = jobSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) {
    return apiFailure({ code: "validation_failed", message: "Invalid notification job.", details: parsed.error.flatten() }, 400, {
      requestId,
    });
  }

  const supabase = createClient();
  const now = new Date().toISOString();
  const { data: event, error } = await supabase
    .from("notification_events")
    .update({ locked_at: now } as never)
    .eq("id", parsed.data.eventId)
    .is("sent_at", null)
    .select("id, recipient_id, type, payload, attempt_count, profiles!inner(email)")
    .single();

  if (error || !event) {
    logger.warn("Notification job event unavailable", { requestId, eventId: parsed.data.eventId, error });
    return apiFailure({ code: "not_found", message: "Notification event not found." }, 404, { requestId });
  }

  const notification = event as unknown as NotificationEvent;
  const email = getRecipientEmail(notification);
  if (!email) {
    await supabase
      .from("notification_events")
      .update({ last_error: "recipient_email_missing", locked_at: null } as never)
      .eq("id", notification.id);
    return apiFailure({ code: "validation_failed", message: "Recipient email missing." }, 422, { requestId });
  }

  const payload = notification.payload as NotificationPayload | null;
  const message = payload?.message || "You have a new RoomZA update.";
  const html = `<div style="font-family:sans-serif;padding:20px;"><h2>RoomZA update</h2><p>${message}</p></div>`;
  const result = await sendEmail(email, "RoomZA notification", html);

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
    return apiFailure({ code: "server_error", message: "Notification send failed." }, 500, { requestId });
  }

  await supabase
    .from("notification_events")
    .update({ sent_at: now, locked_at: null, last_error: null } as never)
    .eq("id", notification.id);

  return apiSuccess({ sent: true }, { requestId });
}
