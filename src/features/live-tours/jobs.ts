import "server-only";

import { logger } from "@/lib/logger";
import { createClient as createAdminClient } from "@/lib/supabase/admin";

export async function purgeExpiredLiveTourRecordingLinks(requestId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc(
    "purge_expired_live_tour_recording_links",
  );
  if (error) {
    logger.error("Expired live-tour recording purge failed", {
      requestId,
      error: error.message,
    });
    return {
      success: false as const,
      code: "server_error" as const,
      message: "Recording retention purge failed.",
      httpStatus: 500,
    };
  }

  return { success: true as const, purged: data ?? 0 };
}
