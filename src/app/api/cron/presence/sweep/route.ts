import { sweepStalePresence } from "@/features/presence/jobs";
import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";

/**
 * Presence staleness sweep HTTP fallback (design §3.1). The production schedule
 * runs in Supabase pg_cron; this authenticated endpoint supports manual and
 * platform-triggered recovery runs.
 */
async function handleSweep(request: Request) {
  const requestId = getRequestId(request);

  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return apiFailure({ code: "unauthorized", message: "Unauthorized" }, 401, { requestId });
  }

  const result = await sweepStalePresence(requestId);
  if (!result.success) {
    return apiFailure({ code: result.code, message: result.message }, result.httpStatus, { requestId });
  }

  return apiSuccess({ success: true, swept: result.swept }, { requestId });
}

export const GET = handleSweep;
export const POST = handleSweep;
