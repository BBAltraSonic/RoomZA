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
  await persistAndEnqueueNotifications(events, requestId);
}

/** Reports persistence for jobs that must remain retryable after a failed write. */
export async function persistAndEnqueueNotifications(
  events: NotificationInsert | NotificationInsert[],
  requestId?: string,
): Promise<{ success: boolean; created: number }> {
  const rows = Array.isArray(events) ? events : [events];
  if (!rows.length) return { success: true, created: 0 };

  const { data, error } = await createAdminClient()
    .from("notification_events")
    .insert(rows)
    .select("id");

  if (error) {
    if (error.code === "23505" && error.message.includes("notification_events_idempotency_key_idx")) {
      // A bulk insert is atomic: one existing key rolls back every new row.
      // Retry rows independently so an already-notified recipient cannot
      // suppress another recipient's new event. The unique index still
      // serializes concurrent retries without changing any saved event.
      if (rows.length > 1) {
        const results = await Promise.all(rows.map(row => persistAndEnqueueNotifications(row, requestId)));
        return { success: results.every(result => result.success), created: results.reduce((total, result) => total + result.created, 0) };
      }
      return { success: true, created: 0 };
    }
    logger.warn("Failed to record notification events", {
      requestId,
      count: rows.length,
      error: error.message,
    });
    return { success: false, created: 0 };
  }

  await Promise.all((data ?? []).map((event) => enqueueNotificationEvent(event.id, requestId)));
  return { success: true, created: data?.length ?? 0 };
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
