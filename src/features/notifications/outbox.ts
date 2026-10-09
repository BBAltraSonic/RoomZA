import "server-only";

import { logger } from "@/lib/logger";
import { publishJsonJob } from "@/lib/qstash";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type NotificationInsert = Database["public"]["Tables"]["notification_events"]["Insert"];

// Recipient-only SELECT policies prevent the actor from returning an inserted
// notification ID. Authorized server actions persist the event with the service
// role after completing their own ownership checks, then enqueue that ID.
export async function recordAndEnqueueNotifications(
  events: NotificationInsert | NotificationInsert[],
  requestId?: string,
) {
  const rows = Array.isArray(events) ? events : [events];
  if (!rows.length) return;

  const { data, error } = await createAdminClient()
    .from("notification_events")
    .insert(rows)
    .select("id");

  if (error) {
    logger.warn("Failed to record notification events", {
      requestId,
      count: rows.length,
      error: error.message,
    });
    return;
  }

  await Promise.all((data ?? []).map((event) => enqueueNotificationEvent(event.id, requestId)));
}

export async function enqueueNotificationEvent(eventId: string, requestId?: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = `${appUrl}/api/jobs/notifications/send`;

  try {
    const result = await publishJsonJob(url, { eventId }, `notification:${eventId}`);
    if (result.skipped) {
      logger.debug("Notification queue publish skipped", { requestId, eventId, reason: "qstash_not_configured" });
    }
  } catch (error) {
    logger.error("Notification queue publish failed", { requestId, eventId, error });
  }
}
