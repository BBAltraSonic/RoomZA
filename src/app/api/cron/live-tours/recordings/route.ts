import { purgeExpiredLiveTourRecordingLinks } from "@/features/live-tours/jobs";
import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";

async function handlePurge(request: Request) {
  const requestId = getRequestId(request);
  const authHeader = request.headers.get("authorization");
  if (
    !process.env.CRON_SECRET
    || authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return apiFailure(
      { code: "unauthorized", message: "Unauthorized" },
      401,
      { requestId },
    );
  }

  const result = await purgeExpiredLiveTourRecordingLinks(requestId);
  if (!result.success) {
    return apiFailure(
      { code: result.code, message: result.message },
      result.httpStatus,
      { requestId },
    );
  }
  return apiSuccess({ purged: result.purged }, { requestId });
}

export const GET = handlePurge;
export const POST = handlePurge;
