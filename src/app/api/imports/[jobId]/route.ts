import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";
import { createUntypedClient } from "@/lib/supabase/admin";
import { enqueueImportJob } from "@/features/listing-imports/queue";
import { requireAccessibleImportJob, toJobSummary, updateDuplicateResolution } from "@/features/listing-imports/repository";
import { importJobActionSchema } from "@/features/listing-imports/schemas";
import { rollbackListingImport } from "@/features/listing-imports/rollback";
import { addressFingerprint, rowStateForIssues, validateCanonicalListing } from "@/features/listing-imports/normalization";
import { IMPORT_LIMITS } from "@/features/listing-imports/limits";

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

  if (action.action === "rollback") {
    try {
      await rollbackListingImport(admin, result.job);
    } catch (error) {
      return apiFailure({
        code: "bad_request",
        message: error instanceof Error ? error.message : "Unable to roll back this import.",
      }, 409, { requestId });
    }
  } else if (action.action === "patch_row") {
    const { data: row, error: rowError } = await admin.from("listing_import_rows")
      .select("id, normalized_data, duplicate_candidate_ids, row_version")
      .eq("id", action.rowId)
      .eq("job_id", jobId)
      .maybeSingle();
    if (rowError || !row) return apiFailure({ code: "not_found", message: "Import row not found." }, 404, { requestId });
    const normalizedData = { ...(row.normalized_data as Record<string, unknown>), ...action.patch };
    const issues = validateCanonicalListing(normalizedData);
    const state = row.duplicate_candidate_ids?.length ? "duplicate_review" : rowStateForIssues(issues);
    const { error: updateError } = await admin.from("listing_import_rows").update({
      normalized_data: normalizedData,
      responsible_agent_id: normalizedData.responsibleAgentId ?? null,
      address_fingerprint: addressFingerprint(normalizedData.address as string | undefined) ?? null,
      state,
      row_version: Number(row.row_version) + 1,
      updated_at: now,
    }).eq("id", row.id);
    if (updateError) return apiFailure({ code: "server_error", message: "Unable to save this row." }, 500, { requestId });
    await admin.from("listing_import_issues").delete().eq("row_id", row.id);
    if (issues.length) {
      await admin.from("listing_import_issues").insert(issues.map((issue) => ({
        job_id: jobId,
        organization_id: result.job!.organization_id,
        row_id: row.id,
        severity: issue.severity,
        code: issue.code,
        field: issue.field ?? null,
        message: issue.message,
      })));
    }
    await admin.rpc("refresh_listing_import_job_counters", { target_job_id: jobId });
  } else if (action.action === "resolve_duplicate") {
    const updated = await updateDuplicateResolution(jobId, action.resolution.rowId, action.resolution.strategy, action.resolution.listingId);
    if (updated.error) return apiFailure({ code: "server_error", message: "Unable to save the duplicate resolution." }, 500, { requestId });
    await admin.rpc("refresh_listing_import_job_counters", { target_job_id: jobId });
  } else if (action.action === "source_uploaded") {
    const sourceLimit = result.job.source_kind === "xlsx" ? IMPORT_LIMITS.xlsxBytes : IMPORT_LIMITS.structuredSourceBytes;
    if (action.sourceSizeBytes > sourceLimit) {
      return apiFailure({ code: "validation_failed", message: "The uploaded source exceeds the allowed size for this format." }, 413, { requestId });
    }
    const expectedPrefix = `${result.job.organization_id}/${jobId}/`;
    if (!action.sourcePath.startsWith(expectedPrefix)) {
      return apiFailure({ code: "validation_failed", message: "The uploaded object is outside this import workspace." }, 400, { requestId });
    }
    await admin.from("listing_import_jobs").update({
      source_path: action.sourcePath,
      source_name: action.sourceName,
      source_size_bytes: action.sourceSizeBytes,
      sheet_name: action.sheetName ?? null,
      record_path: action.recordPath ?? null,
      source_metadata: action.inspection,
      stage: "mapping",
      version: result.job.version + 1,
    }).eq("id", jobId).eq("version", result.job.version);
  } else if (action.action === "save_mapping") {
    await admin.from("listing_import_jobs").update({
      mapping: action.mapping,
      defaults: action.defaults ?? {},
      version: result.job.version + 1,
    }).eq("id", jobId).eq("version", result.job.version);
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
    await admin.from("listing_import_jobs").update({
      selection: action.selection,
      version: result.job.version + 1,
    }).eq("id", jobId).eq("version", result.job.version);
  } else if (action.action === "bulk_patch") {
    const { error } = await admin.rpc("apply_listing_import_bulk_patch", {
      target_job_id: jobId,
      target_selection: action.selection,
      target_patch: action.patch,
    });
    if (error) return apiFailure({ code: "server_error", message: "Unable to apply the bulk change." }, 500, { requestId });
    await admin.rpc("refresh_listing_import_job_counters", { target_job_id: jobId });
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
    const { error } = await admin.from("listing_import_jobs").update({
      stage: "preview",
      version: result.job.version + 1,
      message_code: "preview_ready",
    }).eq("id", jobId).eq("version", result.job.version).eq("stage", "resolving");
    if (error) return apiFailure({ code: "server_error", message: "Resolve remaining blockers before previewing." }, 409, { requestId });
  } else if (action.action === "cancel") {
    await admin.from("listing_import_jobs").update({
      cancel_requested_at: now,
      cancelled_at: now,
      stage: "cancelled",
      defaults: { ...result.job.defaults, resumeStage: result.job.stage },
      message_code: "cancellation_requested",
      version: result.job.version + 1,
    }).eq("id", jobId).eq("version", result.job.version);
  } else {
    let nextStage = result.job.stage;
    let defaults = result.job.defaults;
    if (action.action === "start_validation") {
      nextStage = "validating";
    } else if (action.action === "commit_drafts") {
      nextStage = "committing";
      defaults = { ...defaults, commitMode: "drafts" };
      await admin.rpc("apply_listing_import_bulk_patch", {
        target_job_id: jobId,
        target_selection: result.job.selection,
        target_patch: { publicationSelected: true },
      });
    } else if (action.action === "confirm_final") {
      nextStage = "committing";
      defaults = { ...defaults, commitMode: "final" };
    } else if (action.action === "resume" || action.action === "retry") {
      const resumeStage = typeof defaults.resumeStage === "string" ? defaults.resumeStage : "validating";
      nextStage = result.job.stage === "cancelled" || result.job.stage === "failed"
        ? (resumeStage === "committing" ? "committing" : "validating")
        : result.job.stage;
    }

    const nextVersion = result.job.version + 1;
    const nextCursor = action.action === "resume" || action.action === "retry" ? result.job.stage_cursor : 0;
    const { error } = await admin.from("listing_import_jobs").update({
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
    }).eq("id", jobId).eq("version", result.job.version);
    if (error) return apiFailure({ code: "server_error", message: "Unable to start this import stage." }, 409, { requestId });

    await enqueueImportJob(
      { jobId, stage: nextStage, cursor: nextCursor, attempt: 0, version: nextVersion },
      result.job.organization_id,
    );
  }

  const refreshed = await admin.from("listing_import_jobs").select("*").eq("id", jobId).single();
  if (refreshed.error || !refreshed.data) {
    return apiFailure({ code: "server_error", message: "The import was updated but could not be reloaded." }, 500, { requestId });
  }
  return apiSuccess({ job: toJobSummary(refreshed.data as never) }, { requestId });
}
