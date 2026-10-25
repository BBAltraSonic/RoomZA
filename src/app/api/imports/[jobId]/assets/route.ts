import { createHash } from "node:crypto";

import { z } from "zod";

import { rematchImportAssets } from "@/features/listing-imports/assets";
import { applyImportAssetReview, ImportAssetReviewError } from "@/features/listing-imports/asset-review";
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
  expectedUpdatedAt: z.string().datetime({ offset: true }),
});

const imageCursorSchema = z.tuple([z.string().datetime({ offset: true }), z.string().uuid()]);
const IMAGE_PAGE_SIZE = 500;

function scopedFilePath(path: string, prefix: string) {
  const name = path.slice(prefix.length);
  return path.startsWith(prefix) && name !== "." && name !== ".." && /^[A-Za-z0-9._-]+$/.test(name);
}

function imageFailure(error: unknown, requestId: string) {
  const status = error instanceof ImportAssetReviewError ? error.status : 500;
  return apiFailure({
    code: status === 400 ? "validation_failed" : status === 403 ? "forbidden" : status === 404 ? "not_found" : status === 409 ? "bad_request" : "server_error",
    message: error instanceof ImportAssetReviewError ? error.message : "Unable to save this image change. Reload the saved images before retrying.",
  }, status, { requestId });
}

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const requestId = getRequestId(request);
  const { jobId } = await context.params;
  const result = await requireAccessibleImportJob(jobId);
  const headers = { "cache-control": "private, no-store" };
  if (!result.job) return apiFailure({ code: "not_found", message: result.error }, 404, { requestId, headers });
  const cursor = new URL(request.url).searchParams.get("cursor");
  let after: z.infer<typeof imageCursorSchema> | undefined;
  if (cursor !== null) {
    try {
      if (cursor.length > 256) throw new Error("Invalid cursor");
      after = imageCursorSchema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
    } catch {
      return apiFailure({ code: "validation_failed", message: "This image page is invalid. Reload the saved images." }, 400, { requestId, headers });
    }
  }
  const admin = createUntypedClient();
  let query = admin.from("listing_import_assets")
    .select("id, row_id, state, source_name, mime_type, size_bytes, sort_order, is_cover, match_method, rejection_code, updated_at, created_at")
    .eq("job_id", jobId)
    .order("created_at").order("id").limit(IMAGE_PAGE_SIZE + 1);
  if (after) query = query.or(`created_at.gt.${after[0]},and(created_at.eq.${after[0]},id.gt.${after[1]})`);
  const { data, error } = await query;
  if (error) return apiFailure({ code: "server_error", message: "Unable to load import images." }, 500, { requestId, headers });
  const assets = (data ?? []).slice(0, IMAGE_PAGE_SIZE);
  const last = assets.at(-1);
  const nextCursor = data && data.length > IMAGE_PAGE_SIZE && last
    ? Buffer.from(JSON.stringify([last.created_at, last.id])).toString("base64url") : null;
  return apiSuccess({ assets, nextCursor }, { requestId, headers });
}

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const requestId = getRequestId(request);
  const { jobId } = await context.params;
  const result = await requireAccessibleImportJob(jobId);
  if (!result.job) return apiFailure({ code: "not_found", message: result.error }, 404, { requestId });
  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiFailure({ code: "validation_failed", message: "This image source is invalid." }, 400, { requestId });
  if (!["resolving", "preview"].includes(result.job.stage)) {
    return apiFailure({ code: "bad_request", message: "Images can only be changed during review or preview. Reload this import's current step." }, 409, { requestId });
  }
  const admin = createUntypedClient();
  if (parsed.data.kind !== "archive" && parsed.data.rowId) {
    const { data: row, error } = await admin.from("listing_import_rows").select("id")
      .eq("id", parsed.data.rowId).eq("job_id", jobId).eq("organization_id", result.job.organization_id).maybeSingle();
    if (error) return apiFailure({ code: "server_error", message: "Unable to verify this image's row." }, 500, { requestId });
    if (!row) return apiFailure({ code: "not_found", message: "This row is not available in this import." }, 404, { requestId });
  }

  try {
    let storagePath: string;
    let sourceName: string;
    let mimeType: string;
    let sizeBytes: number;
    let sourceUrlHash: string | null = null;
    if (parsed.data.kind === "archive") {
      const prefix = `${result.job.organization_id}/${jobId}/archives/`;
      if (!scopedFilePath(parsed.data.storagePath, prefix)) {
        return apiFailure({ code: "validation_failed", message: "The ZIP archive is outside this import workspace." }, 400, { requestId });
      }
      const receipt = await applyImportAssetReview(admin, jobId, { action: "register", asset: {
        kind: "archive", sourceName: parsed.data.sourceName, storagePath: parsed.data.storagePath, sizeBytes: parsed.data.sizeBytes,
      } });
      if (!receipt.assetId) throw new ImportAssetReviewError(500, "Could not confirm this archive registration. Reload the saved images before retrying.");
      return apiSuccess({ assetId: receipt.assetId }, { requestId, status: 201 });
    } else if (parsed.data.kind === "uploaded") {
      const prefix = `${result.job.organization_id}/${jobId}/assets/`;
      if (!scopedFilePath(parsed.data.storagePath, prefix)) {
        return apiFailure({ code: "validation_failed", message: "The image is outside this import workspace." }, 400, { requestId });
      }
      const { data: uploadedBlob, error: downloadError } = await admin.storage.from("listing-imports").download(parsed.data.storagePath);
      if (downloadError || !uploadedBlob) {
        return apiFailure({ code: "validation_failed", message: "The uploaded image could not be verified." }, 400, { requestId });
      }
      const uploadedBytes = new Uint8Array(await uploadedBlob.arrayBuffer());
      const detectedMime = detectImageMime(uploadedBytes);
      if (!detectedMime || detectedMime !== parsed.data.mimeType || uploadedBytes.byteLength !== parsed.data.sizeBytes) {
        const registered = await admin.from("listing_import_assets").select("id")
          .eq("job_id", jobId).eq("organization_id", result.job.organization_id).eq("storage_path", parsed.data.storagePath).limit(1);
        if (!registered.error && registered.data?.length === 0) await admin.storage.from("listing-imports").remove([parsed.data.storagePath]);
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

    const receipt = await applyImportAssetReview(admin, jobId, { action: "register", asset: {
      kind: "image", rowId: parsed.data.rowId ?? null, sourceName, sourceUrlHash, storagePath, mimeType, sizeBytes,
    } });
    if (!receipt.assetId) throw new ImportAssetReviewError(500, "Could not confirm this image registration. Reload the saved images before retrying.");
    if (!parsed.data.rowId) await rematchImportAssets(admin, jobId);
    return apiSuccess({ assetId: receipt.assetId }, { requestId, status: 201 });
  } catch (error) { return imageFailure(error, requestId); }
}

export async function PATCH(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const requestId = getRequestId(request);
  const { jobId } = await context.params;
  const result = await requireAccessibleImportJob(jobId);
  if (!result.job) return apiFailure({ code: "not_found", message: result.error }, 404, { requestId });
  const parsed = arrangeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiFailure({ code: "validation_failed", message: "This image arrangement is invalid." }, 400, { requestId });
  if (!["resolving", "preview"].includes(result.job.stage)) {
    return apiFailure({ code: "bad_request", message: "Images can only be changed during review or preview. Reload this import's current step." }, 409, { requestId });
  }
  const admin = createUntypedClient();
  try {
    const receipt = await applyImportAssetReview(admin, jobId, { action: "arrange", ...parsed.data });
    if (!receipt.assetId) throw new ImportAssetReviewError(500, "Could not confirm this image arrangement. Reload the saved images before retrying.");
    return apiSuccess({ assetId: receipt.assetId }, { requestId });
  } catch (error) { return imageFailure(error, requestId); }
}
