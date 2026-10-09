import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/features/admin/auth";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import type { OfferIntakeDatabase } from "./intake";
import { permissionEvidenceRequestSchema, permissionReviewSnapshotSchema, type PermissionEvidenceRequest } from "./permission-review-contract";

type PermissionReviewDatabase = Omit<OfferIntakeDatabase, "public"> & {
  public: Omit<OfferIntakeDatabase["public"], "Functions"> & {
    Functions: OfferIntakeDatabase["public"]["Functions"] & {
      pinpoint_offer_permission_review_read: { Args: { target: string }; Returns: Json };
      pinpoint_offer_permission_review_write: {
        Args: { target: string; revision: string; expected_version: number; request_id: string; evidence_kind: string; source_reference: string; verification_note: string; authorization_checked: boolean; statement_version: string };
        Returns: Json;
      };
    };
  };
};
async function reviewerClient(offerId: string) {
  await requireAdmin({ redirectTo: `/admin/offers/${offerId}` });
  return await createClient() as unknown as SupabaseClient<PermissionReviewDatabase>;
}
export async function readOfferPermissionReview(offerId: string) {
  const target = z.string().uuid().parse(offerId);
  const client = await reviewerClient(target);
  const { data, error } = await client.rpc("pinpoint_offer_permission_review_read", { target });
  if (error) throw error;
  return data === null ? null : permissionReviewSnapshotSchema.parse(data);
}
export async function recordOfferPermissionEvidence(input: PermissionEvidenceRequest) {
  const parsed = permissionEvidenceRequestSchema.parse(input);
  const client = await reviewerClient(parsed.offerId);
  const { data, error } = await client.rpc("pinpoint_offer_permission_review_write", {
    target: parsed.offerId, revision: parsed.revisionId, expected_version: parsed.expectedVersion, request_id: parsed.requestId,
    evidence_kind: parsed.evidenceKind, source_reference: parsed.sourceReference, verification_note: parsed.verificationNote,
    authorization_checked: parsed.authorizationChecked, statement_version: parsed.statementVersion,
  });
  if (error) throw error;
  return z.object({ id: z.string().uuid(), offerId: z.string().uuid(), revisionId: z.string().uuid(), version: z.number().int().positive(), checkedAt: z.string().datetime({ offset: true }) }).strict().parse(data);
}
