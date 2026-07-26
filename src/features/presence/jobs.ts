import "server-only";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/admin";

type PresenceSweepResult =
  | { success: true; swept: number }
  | { success: false; code: "server_error"; message: string; httpStatus: number };

/**
 * Runs the presence staleness sweep (design §3.1). Forces any profile marked
 * non-offline but not seen for > 2 min back to `offline`, closing the gap where
 * a client dies without firing its unload beacon.
 *
 * Delegates to the `sweep_stale_presence()` SECURITY DEFINER RPC via the
 * service-role client (the sweep updates rows it does not own). Idempotent and
 * safe to run on every cron tick.
 */
export async function sweepStalePresence(requestId: string): Promise<PresenceSweepResult> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("sweep_stale_presence");

  if (error) {
    logger.error("Presence sweep failed", { requestId, error });
    return { success: false, code: "server_error", message: "Presence sweep failed.", httpStatus: 500 };
  }

  const swept = typeof data === "number" ? data : 0;
  logger.debug("Presence sweep completed", { requestId, swept });
  return { success: true, swept };
}
