import { createHash } from "node:crypto";

import { z } from "zod";

import { reconcileImportRowImages, rematchImportAssets } from "@/features/listing-imports/assets";
import { detectImageMime, fetchSafeImage } from "@/features/listing-imports/safe-image-url";
import { requireAccessibleImportJob } from "@/features/listing-imports/repository";
import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";
import { createUntypedClient } from "@/lib/supabase/admin";

const registerSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("uploaded"),
    storagePath: z.string().min(1).max(1_024),
    sourceName: z.string().min(1).max(500),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
    rowId: z.string().uuid().nullable().optional(),
  }),
  z.object({
    kind: z.literal("url"),
    url: z.string().url().max(2_048),
    rowId: z.string().uuid().nullable().optional(),
  }),
  z.object({
    kind: z.literal("archive"),
    storagePath: z.string().min(1).max(1_024),
    sourceName: z.string().min(1).max(500),
    sizeBytes: z.number().int().positive().max(2 * 1024 * 1024 * 1024),
  }),
]);

const arrangeSchema = z.object({
  assetId: z.string().uuid(),
  rowId: z.string().uuid().nullable(),
  sortOrder: z.number().int().min(0).max(19),
  isCover: z.boolean(),
});

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const requestId = getRequestId(request);
  const { jobId } = await context.params;
  const result = await requireAccessibleImportJob(jobId);
  if (!result.job) return apiFailure({ code: "not_found", message: result.error }, 404, { requestId });
  const admin = createUntypedClient();
  const { data, error } = await admin.from("listing_import_assets")
    .select("id, row_id, state, source_name, mime_type, size_bytes, sort_order, is_cover, match_method, rejection_code")
    .eq("job_id", jobId)
    .order("created_at");
  if (error) return apiFailure({ code: "server_error", message: "Unable to load import images." }, 500, { requestId });
  return apiSuccess({ assets: data ?? [] }, { requestId });
}

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const requestId = getRequestId(request);
  const { jobId } = await context.params;
  const result = await requireAccessibleImportJob(jobId);
  if (!result.job) return apiFailure({ code: "not_found", message: result.error }, 404, { requestId });
  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiFailure({ code: "validation_failed", message: "This image source is invalid." }, 400, { requestId });
  const admin = createUntypedClient();

  let storagePath: string;
  let sourceName: string;
  let mimeType: string;
  let sizeBytes: number;
  let sourceUrlHash: string | null = null;
  if (parsed.data.kind === "archive") {
    const prefix = `${result.job.organization_id}/${jobId}/archives/`;
    if (!parsed.data.storagePath.startsWith(prefix)) {
      return apiFailure({ code: "validation_failed", message: "The ZIP archive is outside this import workspace." }, 400, { requestId });
    }
    const { data, error } = await admin.from("listing_import_assets").insert({
      job_id: jobId,
      organization_id: result.job.organization_id,
      state: "rejected",
      source_name: parsed.data.sourceName,
      storage_path: parsed.data.storagePath,
      mime_type: "application/zip",
      size_bytes: null,
      archive_size_bytes: parsed.data.sizeBytes,
      rejection_code: "archive_extracted_to_individual_assets",
    }).select("id").single();
    if (error) return apiFailure({ code: "server_error", message: "Unable to register the ZIP archive." }, 500, { requestId });
    return apiSuccess({ assetId: data.id }, { requestId, status: 201 });
  } else if (parsed.data.kind === "uploaded") {
    const prefix = `${result.job.organization_id}/${jobId}/assets/`;
    if (!parsed.data.storagePath.startsWith(prefix)) {
      return apiFailure({ code: "validation_failed", message: "The image is outside this import workspace." }, 400, { requestId });
    }
    const { data: uploadedBlob, error: downloadError } = await admin.storage.from("listing-imports").download(parsed.data.storagePath);
    if (downloadError || !uploadedBlob) {
      return apiFailure({ code: "validation_failed", message: "The uploaded image could not be verified." }, 400, { requestId });
    }
    const uploadedBytes = new Uint8Array(await uploadedBlob.arrayBuffer());
    const detectedMime = detectImageMime(uploadedBytes);
    if (!detectedMime || detectedMime !== parsed.data.mimeType || uploadedBytes.byteLength !== parsed.data.sizeBytes) {
      await admin.storage.from("listing-imports").remove([parsed.data.storagePath]);
      return apiFailure({ code: "validation_failed", message: "The image content does not match its type or reported size." }, 400, { requestId });
    }
    storagePath = parsed.data.storagePath;
    sourceName = parsed.data.sourceName;
    mimeType = parsed.data.mimeType;
    sizeBytes = uploadedBytes.byteLength;
  } else {
    try {
      const image = await fetchSafeImage(parsed.data.url);
      sourceUrlHash = createHash("sha256").update(parsed.data.url).digest("hex");
      const extension = image.mimeType === "image/png" ? "png" : image.mimeType === "image/webp" ? "webp" : "jpg";
      storagePath = `${result.job.organization_id}/${jobId}/assets/url-${sourceUrlHash}.${extension}`;
      sourceName = new URL(parsed.data.url).pathname.split("/").at(-1) || `remote.${extension}`;
      mimeType = image.mimeType;
      sizeBytes = image.bytes.byteLength;
      const { error: uploadError } = await admin.storage.from("listing-imports").upload(storagePath, image.bytes, {
        contentType: image.mimeType,
        cacheControl: "3600",
        upsert: false,
      });
      if (uploadError && !uploadError.message.toLowerCase().includes("exist")) throw uploadError;
    } catch {
      return apiFailure({ code: "validation_failed", message: "The image URL is unsafe or could not be downloaded as a supported image." }, 400, { requestId });
    }
  }

  const { data, error } = await admin.from("listing_import_assets").insert({
    job_id: jobId,
    organization_id: result.job.organization_id,
    row_id: parsed.data.rowId ?? null,
    state: parsed.data.rowId ? "matched" : "uploaded",
    source_name: sourceName,
    source_url_hash: sourceUrlHash,
    storage_path: storagePath,
    mime_type: mimeType,
    size_bytes: sizeBytes,
  }).select("id").single();
  if (error) return apiFailure({ code: "server_error", message: "Unable to register the image." }, 500, { requestId });
  if (!parsed.data.rowId) await rematchImportAssets(admin, jobId);
  await admin.rpc("refresh_listing_import_job_counters", { target_job_id: jobId });
  return apiSuccess({ assetId: data.id }, { requestId, status: 201 });
}

export async function PATCH(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const requestId = getRequestId(request);
  const { jobId } = await context.params;
  const result = await requireAccessibleImportJob(jobId);
  if (!result.job) return apiFailure({ code: "not_found", message: result.error }, 404, { requestId });
  const parsed = arrangeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiFailure({ code: "validation_failed", message: "This image arrangement is invalid." }, 400, { requestId });
  const admin = createUntypedClient();
  const { data: previous } = await admin.from("listing_import_assets")
    .select("row_id")
    .eq("id", parsed.data.assetId)
    .eq("job_id", jobId)
    .maybeSingle();
  if (parsed.data.isCover && parsed.data.rowId) {
    await admin.from("listing_import_assets")
      .update({ is_cover: false })
      .eq("job_id", jobId)
      .eq("row_id", parsed.data.rowId);
  }
  const { data, error } = await admin.from("listing_import_assets").update({
    row_id: parsed.data.rowId,
    state: parsed.data.rowId ? "matched" : "unmatched",
    match_method: parsed.data.rowId ? "manual" : null,
    sort_order: parsed.data.rowId ? parsed.data.sortOrder : null,
    is_cover: parsed.data.rowId ? parsed.data.isCover : false,
  }).eq("id", parsed.data.assetId).eq("job_id", jobId).select("id").maybeSingle();
  if (error || !data) return apiFailure({ code: "server_error", message: "Unable to save the image arrangement." }, 500, { requestId });
  if (parsed.data.rowId) await reconcileImportRowImages(admin, jobId, parsed.data.rowId);
  if (previous?.row_id && previous.row_id !== parsed.data.rowId) {
    await reconcileImportRowImages(admin, jobId, previous.row_id);
  }
  await admin.rpc("refresh_listing_import_job_counters", { target_job_id: jobId });
  return apiSuccess({ assetId: data.id }, { requestId });
}
