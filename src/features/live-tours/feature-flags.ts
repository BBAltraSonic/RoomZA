import "server-only";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

export type InstantConnectPhase3Flags = {
  scheduledTours: boolean;
  moderation: boolean;
  pictureInPicture: boolean;
  recording: boolean;
};

const disabledFlags: InstantConnectPhase3Flags = {
  scheduledTours: false,
  moderation: false,
  pictureInPicture: false,
  recording: false,
};

export async function getInstantConnectPhase3Flags(): Promise<InstantConnectPhase3Flags> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "get_public_instant_connect_phase3_flags",
  );

  if (error || !data?.[0]) {
    logger.warn("Instant Connect Phase 3 flags unavailable", {
      error: error?.message,
    });
    return disabledFlags;
  }

  const flags = data[0];
  return {
    scheduledTours: flags.scheduled_tours,
    moderation: flags.moderation,
    pictureInPicture: flags.picture_in_picture,
    recording: flags.recording,
  };
}
