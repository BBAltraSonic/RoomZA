import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";
import { listImportRows } from "@/features/listing-imports/repository";
import { importRowsQuerySchema } from "@/features/listing-imports/schemas";

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const requestId = getRequestId(request);
  const { jobId } = await context.params;
  const url = new URL(request.url);
  const parsed = importRowsQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return apiFailure({ code: "validation_failed", message: "Invalid row filters.", details: parsed.error.flatten() }, 400, { requestId });
  }

  const result = await listImportRows(jobId, parsed.data);
  if (!result.job) return apiFailure({ code: "not_found", message: result.error }, 404, { requestId });
  if (result.rowsError) return apiFailure({ code: "server_error", message: "Unable to load import rows." }, 500, { requestId });
  return apiSuccess({ rows: result.rows, nextCursor: result.nextCursor }, { requestId });
}
