import "server-only";

import { logger } from "@/lib/logger";
import { publishJsonJob } from "@/lib/qstash";

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
