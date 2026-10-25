import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const receiptSchema = z.object({
  assetId: z.string().uuid().nullable(),
  affected: z.number().int().nonnegative(),
  stale: z.boolean(),
});

export class ImportAssetReviewError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export async function applyImportAssetReview(admin: SupabaseClient, jobId: string, request: Record<string, unknown>) {
  const { data, error } = await admin.rpc("apply_listing_import_asset_review", {
    target_job_id: jobId,
    asset_request: request,
  });
  if (error) {
    if (error.code === "PT404") throw new ImportAssetReviewError(404, "This image or row is no longer available in this import.");
    if (error.code === "PT409") throw new ImportAssetReviewError(409, error.message === "import_image_limit"
      ? "A row can have at most 20 images. Keep other images unmatched or choose another row."
      : "This import's image review changed. Reload its current step before retrying.");
    if (["22023", "22P02", "22007", "22008"].includes(error.code)) throw new ImportAssetReviewError(400, "This image change is invalid for this import.");
    if (error.code === "42501") throw new ImportAssetReviewError(403, "You cannot change images in this import.");
    throw new ImportAssetReviewError(500, "Unable to save this image change. Reload the saved images before retrying.");
  }
  const receipt = receiptSchema.safeParse(data);
  if (!receipt.success) throw new ImportAssetReviewError(500, "Could not confirm this image change. Reload the saved images before retrying.");
  return receipt.data;
}
