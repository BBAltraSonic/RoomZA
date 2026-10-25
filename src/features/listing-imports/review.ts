import "server-only";

import { z } from "zod";
import type { ApiErrorCode } from "@/lib/api";
import { createUntypedClient } from "@/lib/supabase/admin";

const receiptSchema = z.object({
  affected: z.number().int().nonnegative(),
  rowId: z.string().uuid().nullable(),
  rowVersion: z.number().int().positive().nullable(),
});

export type ImportReviewReceipt = z.infer<typeof receiptSchema>;

export async function applyImportReview(
  jobId: string,
  expectedVersion: number,
  reviewRequest: Record<string, unknown>,
): Promise<
  | { review: ImportReviewReceipt; error: null }
  | { review: null; error: { code: ApiErrorCode; status: number; message: string } }
> {
  const admin = createUntypedClient();
  const { data, error } = await admin.rpc("apply_listing_import_review", {
    target_job_id: jobId,
    expected_job_version: expectedVersion,
    review_request: reviewRequest,
  });
  if (error) {
    if (error.code === "PT409") return {
      review: null,
      error: { code: "bad_request", status: 409, message: "This import or row changed. Your edits are still here. Reload the current rows before saving." },
    };
    if (error.code === "42501") return {
      review: null,
      error: { code: "forbidden", status: 403, message: "Choose an active organization member and an eligible matched listing from this workspace." },
    };
    if (error.code === "P0002") return {
      review: null,
      error: { code: "not_found", status: 404, message: "Import row not found." },
    };
    if (["22023", "22P02"].includes(error.code)) return {
      review: null,
      error: { code: "validation_failed", status: 400, message: "Choose a valid review change and duplicate decision." },
    };
    return {
      review: null,
      error: { code: "server_error", status: 500, message: "Unable to save this review. Your edits are still here." },
    };
  }
  const receipt = receiptSchema.safeParse(data);
  if (!receipt.success) return {
    review: null,
    error: { code: "server_error", status: 500, message: "Could not confirm this review update. Reload its current state before retrying." },
  };
  return { review: receipt.data, error: null };
}
