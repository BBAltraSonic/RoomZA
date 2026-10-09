import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/features/admin/auth";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import type { OfferIntakeDatabase } from "./intake";
import { locationEvidenceRequestSchema, locationReviewSnapshotSchema, type LocationEvidenceRequest } from "./location-review-contract";

type LocationReviewDatabase = Omit<OfferIntakeDatabase, "public"> & {
  public: Omit<OfferIntakeDatabase["public"], "Functions"> & {
    Functions: OfferIntakeDatabase["public"]["Functions"] & {
      pinpoint_offer_location_review_read: { Args: { target: string }; Returns: Json };
      pinpoint_offer_location_review_write: {
        Args: { target: string; revision: string; expected_version: number; request_id: string; permission_review_id: string; place_snapshot: Json;
          provenance_reference: string; shop_reference: string; verification_note: string;
          provenance_checked: boolean; shop_checked: boolean; content_checked: boolean; dates_checked: boolean; statement_version: string };
        Returns: Json;
      };
    };
  };
};
async function reviewerClient(offerId: string) {
  await requireAdmin({ redirectTo: `/admin/offers/${offerId}` });
  return await createClient() as unknown as SupabaseClient<LocationReviewDatabase>;
}
export async function readOfferLocationReview(offerId: string) {
  const target = z.string().uuid().parse(offerId);
  const client = await reviewerClient(target);
  const { data, error } = await client.rpc("pinpoint_offer_location_review_read", { target });
  if (error) throw error;
  return data === null ? null : locationReviewSnapshotSchema.parse(data);
}
export async function recordOfferLocationEvidence(input: LocationEvidenceRequest) {
  const parsed = locationEvidenceRequestSchema.parse(input);
  const client = await reviewerClient(parsed.offerId);
  const { data, error } = await client.rpc("pinpoint_offer_location_review_write", {
    target: parsed.offerId, revision: parsed.revisionId, expected_version: parsed.expectedVersion, request_id: parsed.requestId,
    permission_review_id: parsed.permissionReviewId, place_snapshot: parsed.placeSnapshot,
    provenance_reference: parsed.provenanceReference, shop_reference: parsed.shopReference, verification_note: parsed.verificationNote,
    provenance_checked: parsed.provenanceChecked, shop_checked: parsed.shopChecked, content_checked: parsed.contentChecked,
    dates_checked: parsed.datesChecked, statement_version: parsed.statementVersion,
  });
  if (error) throw error;
  return z.object({ id: z.string().uuid(), offerId: z.string().uuid(), revisionId: z.string().uuid(), version: z.number().int().positive(), checkedAt: z.string().datetime({ offset: true }) }).strict().parse(data);
}
