import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";
import { getSupabaseEnv } from "@/lib/env";
import { IMPORT_LIMITS } from "@/features/listing-imports/limits";
import { requireAccessibleImportJob } from "@/features/listing-imports/repository";

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const requestId = getRequestId(request);
  const { jobId } = await context.params;
  const result = await requireAccessibleImportJob(jobId);
  if (!result.job) return apiFailure({ code: "not_found", message: result.error }, 404, { requestId });

  const body = await request.json().catch(() => null) as { filename?: string; contentType?: string; uploadKind?: "source" | "asset" | "archive" } | null;
  const filename = body?.filename?.replaceAll(/[^a-zA-Z0-9._-]/g, "-").slice(-180);
  if (!filename) return apiFailure({ code: "validation_failed", message: "Choose a source file." }, 400, { requestId });
  if (body?.uploadKind === "asset") {
    if (!["image/jpeg", "image/png", "image/webp"].includes(body.contentType ?? "")) {
      return apiFailure({ code: "validation_failed", message: "Use a JPEG, PNG, or WebP image." }, 400, { requestId });
    }
  }
  if (body?.uploadKind === "archive" && body.contentType !== "application/zip") {
    return apiFailure({ code: "validation_failed", message: "Use a ZIP image archive." }, 400, { requestId });
  }

  const { supabaseUrl } = getSupabaseEnv();
  const folder = body?.uploadKind === "asset" ? "assets" : body?.uploadKind === "archive" ? "archives" : "source";
  const objectPath = `${result.job.organization_id}/${jobId}/${folder}/${crypto.randomUUID()}-${filename}`;
  return apiSuccess({
    bucket: "listing-imports",
    objectPath,
    tusEndpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
    chunkSize: IMPORT_LIMITS.tusChunkBytes,
    retryDelays: [0, 1_000, 3_000, 5_000, 10_000],
  }, { requestId });
}
