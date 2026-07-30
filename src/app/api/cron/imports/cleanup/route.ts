import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";
import { logger } from "@/lib/logger";
import { createUntypedClient } from "@/lib/supabase/admin";

async function handleCleanup(request: Request) {
  const requestId = getRequestId(request);
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return apiFailure({ code: "unauthorized", message: "Unauthorized" }, 401, { requestId });
  }

  const admin = createUntypedClient();
  const now = new Date().toISOString();
  const { data: sourceJobs, error } = await admin
    .from("listing_import_jobs")
    .select("id, organization_id, source_path, source_metadata")
    .lt("retention_source_until", now)
    .not("source_path", "is", null)
    .limit(50);
  if (error) {
    return apiFailure({ code: "server_error", message: "Import cleanup could not load expired jobs." }, 500, { requestId });
  }

  let objectsRemoved = 0;
  let jobsCleaned = 0;
  for (const job of sourceJobs ?? []) {
    const { data: assets } = await admin
      .from("listing_import_assets")
      .select("storage_path")
      .eq("job_id", job.id)
      .not("storage_path", "is", null);
    const paths = [
      job.source_path as string,
      ...(assets ?? []).map((asset) => asset.storage_path as string),
    ].filter(Boolean);
    for (let offset = 0; offset < paths.length; offset += 1_000) {
      const batch = paths.slice(offset, offset + 1_000);
      const { error: removeError } = await admin.storage.from("listing-imports").remove(batch);
      if (removeError) {
        logger.warn("Listing import storage cleanup deferred", {
          requestId,
          jobId: job.id,
          organizationId: job.organization_id,
          stage: "cleanup",
          counts: { paths: batch.length },
        });
        continue;
      }
      objectsRemoved += batch.length;
    }
    await admin.from("listing_import_assets").delete().eq("job_id", job.id);
    await admin.from("listing_import_rows").delete().eq("job_id", job.id);
    await admin.from("listing_import_jobs").update({
      source_path: null,
      source_name: null,
      source_size_bytes: null,
      source_metadata: {
        ...(job.source_metadata as Record<string, unknown>),
        stagingCleanedAt: now,
      },
    }).eq("id", job.id);
    jobsCleaned += 1;
  }

  const { data: expiredAudits, error: auditError } = await admin
    .from("listing_import_jobs")
    .delete()
    .lt("retention_audit_until", now)
    .select("id");
  if (auditError) {
    return apiFailure({ code: "server_error", message: "Source cleanup finished, but audit cleanup must be retried." }, 500, { requestId });
  }

  logger.info("Listing import retention cleanup complete", {
    requestId,
    stage: "cleanup",
    counts: { jobsCleaned, objectsRemoved, auditsRemoved: expiredAudits?.length ?? 0 },
  });
  return apiSuccess({
    jobsCleaned,
    objectsRemoved,
    auditsRemoved: expiredAudits?.length ?? 0,
  }, { requestId });
}

export const GET = handleCleanup;
export const POST = handleCleanup;
