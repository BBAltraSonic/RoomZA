import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";
import { createUntypedClient } from "@/lib/supabase/admin";
import { enqueueImportJob } from "@/features/listing-imports/queue";
import { requireAccessibleImportJob, toJobSummary } from "@/features/listing-imports/repository";
import { importJobActionSchema } from "@/features/listing-imports/schemas";
import { ImportRollbackError, rollbackListingImport } from "@/features/listing-imports/rollback";
import { addressFingerprint } from "@/features/listing-imports/normalization";
import { applyImportReview, type ImportReviewReceipt } from "@/features/listing-imports/review";
import { IMPORT_JOB_STAGES, type ImportJobStage } from "@/features/listing-imports/types";
import { IMPORT_LIMITS } from "@/features/listing-imports/limits";
import { LEGACY_IMPORT_REVIEW_MESSAGE } from "@/features/listing-imports/selection";

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const requestId = getRequestId(request);
  const { jobId } = await context.params;
  const result = await requireAccessibleImportJob(jobId);
  if (!result.job) return apiFailure({ code: "not_found", message: result.error }, 404, { requestId });
  return apiSuccess({ job: toJobSummary(result.job), configuration: {
    mapping: result.job.mapping,
    defaults: result.job.defaults,
    selection: result.job.selection,
    sheetName: result.job.sheet_name,
    recordPath: result.job.record_path,
  } }, { requestId });
}

export async function PATCH(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const requestId = getRequestId(request);
  const { jobId } = await context.params;
  const result = await requireAccessibleImportJob(jobId);
  if (!result.job) return apiFailure({ code: "not_found", message: result.error }, 404, { requestId });

  const parsed = importJobActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiFailure({ code: "validation_failed", message: "This import update is invalid.", details: parsed.error.flatten() }, 400, { requestId });
  }
  const admin = createUntypedClient();
  const now = new Date().toISOString();
  const action = parsed.data;
  const expectedVersion = result.job.version;
  if (action.expectedVersion !== undefined && action.expectedVersion !== expectedVersion) {
    return apiFailure({ code: "bad_request", message: "This import changed. Your edits are still here. Load the latest version before saving." }, 409, { requestId });
  }
  const allowedStages: Partial<Record<typeof action.action, readonly ImportJobStage[]>> = {
    source_uploaded: ["source", "upload", "mapping"], save_mapping: ["source", "upload", "mapping"],
    start_validation: ["mapping"], patch_row: ["resolving", "preview"], bulk_patch: ["resolving", "preview"],
    resolve_duplicate: ["resolving", "preview"], save_selection: ["resolving", "preview", "confirming"],
    continue_preview: ["resolving"], commit_drafts: ["preview"], confirm_final: ["confirming"],
    resume: ["cancelled", "failed"], retry: ["cancelled", "failed"], rollback: ["complete"],
  };
  const permitted = allowedStages[action.action];
  if ((permitted && !permitted.includes(result.job.stage)) || (result.job.stage === "complete" && action.action !== "rollback")) {
    return apiFailure({ code: "bad_request", message: "This action is not available at the current import step. Reload its current state." }, 409, { requestId });
  }
  let reviewReceipt: ImportReviewReceipt | undefined;
  async function writeJob(values: Record<string, unknown>, stage?: string) {
    let update = admin.from("listing_import_jobs").update(values).eq("id", jobId).eq("version", expectedVersion);
    if (stage) update = update.eq("stage", stage);
    const { data, error } = await update.select("id").maybeSingle();
    if (error) return apiFailure({ code: "server_error", message: "Unable to save this import update. Your edits are still here." }, 500, { requestId });
    if (!data) return apiFailure({ code: "bad_request", message: "This import changed. Your edits are still here. Load the latest version before saving." }, 409, { requestId });
    return null;
  }

  if (action.action === "rollback") {
    try {
      await rollbackListingImport(admin, result.job, result.access.user.id);
    } catch (error) {
      return apiFailure({
        code: error instanceof ImportRollbackError
          ? error.status === 503 ? "service_unavailable" : "server_error"
          : "bad_request",
        message: error instanceof Error ? error.message : "Unable to roll back this import.",
      }, error instanceof ImportRollbackError ? error.status : 409, { requestId });
    }
  } else if (action.action === "patch_row" || action.action === "bulk_patch" || action.action === "resolve_duplicate") {
    const reviewRequest = action.action === "resolve_duplicate"
      ? { action: action.action, ...action.resolution }
      : { ...action, ...(action.action === "patch_row" && action.patch.address ? { addressFingerprint: addressFingerprint(action.patch.address) } : {}) };
    const reviewed = await applyImportReview(jobId, expectedVersion, reviewRequest);
    if (reviewed.error) return apiFailure(reviewed.error, reviewed.error.status, { requestId });
    reviewReceipt = reviewed.review;
  } else if (action.action === "source_uploaded") {
    const sourceLimit = result.job.source_kind === "xlsx" ? IMPORT_LIMITS.xlsxBytes : IMPORT_LIMITS.structuredSourceBytes;
    if (action.sourceSizeBytes > sourceLimit) {
      return apiFailure({ code: "validation_failed", message: "The uploaded source exceeds the allowed size for this format." }, 413, { requestId });
    }
    const expectedPrefix = `${result.job.organization_id}/${jobId}/`;
    if (!action.sourcePath.startsWith(expectedPrefix)) {
      return apiFailure({ code: "validation_failed", message: "The uploaded object is outside this import workspace." }, 400, { requestId });
    }
    const failure = await writeJob({
      source_path: action.sourcePath,
      source_name: action.sourceName,
      source_size_bytes: action.sourceSizeBytes,
      sheet_name: action.sheetName ?? null,
      record_path: action.recordPath ?? null,
      source_metadata: action.inspection,
      stage: "mapping",
      version: result.job.version + 1,
    });
    if (failure) return failure;
  } else if (action.action === "save_mapping") {
    const failure = await writeJob({
      mapping: action.mapping,
      defaults: action.defaults ?? {},
      version: result.job.version + 1,
    });
    if (failure) return failure;
    await admin.from("listing_import_templates").upsert({
      organization_id: result.job.organization_id,
      name: `Autosaved ${result.job.source_kind.toUpperCase()}`,
      source_kind: result.job.source_kind,
      adapter_version: result.job.adapter_version,
      mapping: action.mapping,
      defaults: action.defaults ?? {},
      created_by: result.access.user.id,
      updated_at: now,
    }, { onConflict: "organization_id,name" });
  } else if (action.action === "save_selection") {
    const failure = await writeJob({
      selection: action.selection,
      version: result.job.version + 1,
    });
    if (failure) return failure;
  } else if (action.action === "continue_preview") {
    const { count: unresolvedDuplicates, error: duplicateError } = await admin
      .from("listing_import_rows")
      .select("id", { head: true, count: "exact" })
      .eq("job_id", jobId)
      .eq("state", "duplicate_review")
      .is("duplicate_strategy", null);
    if (duplicateError) {
      return apiFailure({ code: "server_error", message: "Unable to verify duplicate resolutions." }, 500, { requestId });
    }
    if ((unresolvedDuplicates ?? 0) > 0) {
      return apiFailure({
        code: "validation_failed",
        message: `Resolve ${unresolvedDuplicates} duplicate ${unresolvedDuplicates === 1 ? "row" : "rows"} before previewing.`,
      }, 409, { requestId });
    }
    const failure = await writeJob({
      stage: "preview",
      version: result.job.version + 1,
      message_code: "preview_ready",
    }, "resolving");
    if (failure) return failure;
  } else if (action.action === "cancel") {
    if (result.job.stage === "cancelled") return apiSuccess({ job: toJobSummary(result.job) }, { requestId });
    const failure = await writeJob({
      cancel_requested_at: now,
      cancelled_at: now,
      stage: "cancelled",
      defaults: { ...result.job.defaults, resumeStage: result.job.stage === "failed" ? result.job.defaults.resumeStage ?? (result.job.source_path ? "validating" : "upload") : result.job.stage },
      message_code: "cancellation_requested",
      version: result.job.version + 1,
    });
    if (failure) return failure;
  } else {
    let nextStage = result.job.stage;
    let defaults = result.job.defaults;
    let draftsPrepared = false;
    if (action.action === "start_validation") {
      nextStage = "validating";
    } else if (action.action === "commit_drafts") {
      nextStage = "committing";
      defaults = { ...defaults, commitMode: "drafts" };
      const { data: preparedVersion, error: prepareError } = await admin.rpc("prepare_listing_import_drafts_with_selection", {
        target_job_id: jobId,
        expected_job_version: expectedVersion,
      });
      if (prepareError) {
        const conflict = prepareError.code === "PT409";
        return apiFailure({ code: conflict ? "bad_request" : "server_error", message: conflict
          ? "This import changed. Your edits are still here. Load the latest version before creating drafts."
          : "Unable to prepare these drafts. Your import is saved. Reload its current state before retrying." }, conflict ? 409 : 500, { requestId });
      }
      if (preparedVersion !== expectedVersion + 1) {
        return apiFailure({ code: "server_error", message: "Could not confirm draft preparation. Reload this import before retrying." }, 500, { requestId });
      }
      draftsPrepared = true;
    } else if (action.action === "confirm_final") {
      if (!result.job.prepared_selection) {
        return apiFailure({ code: "bad_request", message: LEGACY_IMPORT_REVIEW_MESSAGE }, 409, { requestId });
      }
      nextStage = "committing";
      defaults = { ...defaults, commitMode: "final" };
    } else if (action.action === "resume" || action.action === "retry") {
      const resumeStage = typeof defaults.resumeStage === "string" ? defaults.resumeStage : result.job.source_path ? "validating" : "upload";
      if (!IMPORT_JOB_STAGES.includes(resumeStage as ImportJobStage) || ["complete", "failed", "cancelled"].includes(resumeStage)) {
        return apiFailure({ code: "bad_request", message: "This import has no resumable step. Reload its current state." }, 409, { requestId });
      }
      nextStage = resumeStage as ImportJobStage;
    }

    const nextVersion = result.job.version + 1;
    const nextCursor = action.action === "resume" || action.action === "retry" ? result.job.stage_cursor : 0;
    const failure = draftsPrepared ? null : await writeJob({
      stage: nextStage,
      stage_cursor: nextCursor,
      ...(action.action === "retry" || action.action === "resume" ? { created_by: result.access.user.id } : {}),
      defaults,
      cancel_requested_at: null,
      cancelled_at: null,
      message_code: null,
      message_detail: null,
      version: nextVersion,
      heartbeat_at: now,
    });
    if (failure) return failure;

    if (nextStage === "validating" || nextStage === "committing") {
    try {
      await enqueueImportJob(
        { jobId, stage: nextStage, cursor: nextCursor, attempt: 0, version: nextVersion },
        result.job.organization_id,
      );
    } catch {
      const { data: failed, error: failedError } = await admin.from("listing_import_jobs").update({
        stage: "failed",
        defaults: { ...defaults, resumeStage: nextStage },
        version: nextVersion + 1,
        heartbeat_at: null,
        message_code: "queue_delivery_failed",
        message_detail: "Processing could not be queued. Your import is saved. Retry when processing is available.",
      }).eq("id", jobId).eq("version", nextVersion).select("id").maybeSingle();
      if (failedError) return apiFailure({ code: "server_error", message: "Processing could not be queued. Reload this import to check its current state." }, 500, { requestId });
      if (!failed) return apiFailure({ code: "bad_request", message: "This import changed while queueing. Load the latest version before retrying." }, 409, { requestId });
      return apiFailure({ code: "service_unavailable", message: "Processing could not be queued. Your import is saved. Retry when processing is available." }, 503, { requestId });
    }
    }
  }

  const refreshed = await admin.from("listing_import_jobs").select("*").eq("id", jobId).single();
  if (refreshed.error || !refreshed.data) {
    return apiFailure({ code: "server_error", message: "The import was updated but could not be reloaded." }, 500, { requestId });
  }
  return apiSuccess({ job: toJobSummary(refreshed.data as never), ...(reviewReceipt ? { review: reviewReceipt } : {}) }, { requestId });
}
