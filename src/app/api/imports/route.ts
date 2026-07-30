import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";
import { createUntypedClient } from "@/lib/supabase/admin";
import { getImportAccess } from "@/features/listing-imports/access";
import { IMPORT_LIMITS } from "@/features/listing-imports/limits";
import { listImportJobs, toJobSummary } from "@/features/listing-imports/repository";
import { createImportJobSchema } from "@/features/listing-imports/schemas";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const result = await listImportJobs();
  if (!result.allowed) return apiFailure({ code: "forbidden", message: result.reason ?? "Import access denied." }, 403, { requestId });
  if ("loadError" in result && result.loadError) return apiFailure({ code: "server_error", message: "Unable to load imports." }, 500, { requestId });
  return apiSuccess({ jobs: result.jobs }, { requestId });
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const access = await getImportAccess();
  if (!access.allowed || !access.activeOrganization) {
    return apiFailure({ code: "forbidden", message: access.reason ?? "Import access denied." }, 403, { requestId });
  }

  const parsed = createImportJobSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiFailure({ code: "validation_failed", message: "Choose a supported source.", details: parsed.error.flatten() }, 400, { requestId });
  }
  const { sourceKind, sourceSizeBytes, sourceName } = parsed.data;
  const maxBytes = sourceKind === "xlsx"
    ? IMPORT_LIMITS.xlsxBytes
    : sourceKind === "image_archive"
      ? IMPORT_LIMITS.zipBytes
      : IMPORT_LIMITS.structuredSourceBytes;
  if (sourceSizeBytes && sourceSizeBytes > maxBytes) {
    return apiFailure({ code: "validation_failed", message: "The source exceeds the allowed size for this format." }, 413, { requestId });
  }

  const admin = createUntypedClient();
  const { data, error } = await admin
    .from("listing_import_jobs")
    .insert({
      organization_id: access.activeOrganization.organizationId,
      created_by: access.user.id,
      source_kind: sourceKind,
      source_name: sourceName ?? null,
      source_size_bytes: sourceSizeBytes ?? null,
      stage: "upload",
    })
    .select("*")
    .single();

  if (error || !data) {
    return apiFailure({ code: "server_error", message: "Unable to create the import workspace." }, 500, { requestId });
  }
  return apiSuccess({ job: toJobSummary(data as never) }, { requestId, status: 201 });
}
