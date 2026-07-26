import { z } from "zod";

import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

const beatSchema = z.object({
  desired: z.enum(["available", "busy", "offline"]).optional(),
});

export async function handlePresenceBeat(request: Request) {
  const requestId = getRequestId(request);
  let desired: "available" | "busy" | "offline" | undefined;

  try {
    const raw = await request.text();
    if (raw) {
      const parsed = beatSchema.safeParse(JSON.parse(raw));
      if (parsed.success) desired = parsed.data.desired;
    }
  } catch {
    // Unload beacons are best-effort. A malformed body uses the safe default.
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return apiSuccess({ ok: true }, { requestId });

  const { error } = await supabase.rpc("touch_presence", {
    desired: desired ?? "available",
  });
  if (error) {
    logger.warn("Presence beacon touch failed", { requestId, error: error.message });
    return apiFailure(
      { code: "server_error", message: "Presence update failed." },
      500,
      { requestId },
    );
  }

  return apiSuccess({ ok: true }, { requestId });
}
