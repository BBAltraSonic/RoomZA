import { processNextPrivacyExport } from "@/features/trust/privacy-export";
import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) return apiFailure({ code: "unauthorized", message: "Unauthorized" }, 401, { requestId });
  const result = await processNextPrivacyExport(requestId);
  return result.success ? apiSuccess({ processed: result.processed }, { requestId }) : apiFailure({ code: "server_error", message: result.message, details: { reason: result.code } }, result.httpStatus, { requestId });
}
