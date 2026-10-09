import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/features/admin/auth";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import type { OfferIntakeDatabase } from "./intake";
import { offerDecisionRequestSchema, offerDecisionSnapshotSchema, type OfferDecisionRequest } from "./decision-contract";

type DecisionDatabase = Omit<OfferIntakeDatabase, "public"> & {
  public: Omit<OfferIntakeDatabase["public"], "Functions"> & {
    Functions: OfferIntakeDatabase["public"]["Functions"] & {
      pinpoint_offer_decision_read: { Args: { target: string }; Returns: Json };
      pinpoint_offer_approve: { Args: { target: string; revision: string; expected_version: number; request_id: string; permission_review_id: string; location_review_id: string; approval_confirmed: boolean; statement_version: string }; Returns: Json };
      pinpoint_offer_unpublish: { Args: { target: string; revision: string; expected_version: number; request_id: string; reason: string }; Returns: Json };
    };
  };
};
async function reviewerClient(offerId: string) {
  await requireAdmin({ redirectTo: `/admin/offers/${offerId}` });
  return await createClient() as unknown as SupabaseClient<DecisionDatabase>;
}
export async function readOfferDecision(offerId: string) {
  const target = z.string().uuid().parse(offerId);
  const client = await reviewerClient(target);
  const { data, error } = await client.rpc("pinpoint_offer_decision_read", { target });
  if (error) throw error;
  return data === null ? null : offerDecisionSnapshotSchema.parse(data);
}
export async function recordOfferDecision(input: OfferDecisionRequest) {
  const parsed = offerDecisionRequestSchema.parse(input);
  const client = await reviewerClient(parsed.offerId);
  const identity = { target: parsed.offerId, revision: parsed.revisionId, expected_version: parsed.expectedVersion, request_id: parsed.requestId };
  const response = parsed.command === "approve"
    ? await client.rpc("pinpoint_offer_approve", { ...identity, permission_review_id: parsed.permissionReviewId, location_review_id: parsed.locationReviewId, approval_confirmed: parsed.approvalConfirmed, statement_version: parsed.statementVersion })
    : await client.rpc("pinpoint_offer_unpublish", { ...identity, reason: parsed.reason });
  if (response.error) throw response.error;
  const base = { offerId: z.string().uuid(), revisionId: z.string().uuid(), version: z.number().int().positive(), decisionId: z.string().uuid() };
  return parsed.command === "approve"
    ? z.object({ ...base, pendingRevisionId: z.null(), confirmedAt: z.string().datetime({ offset: true }) }).strict().parse(response.data)
    : z.object({ ...base, unpublishedAt: z.string().datetime({ offset: true }) }).strict().parse(response.data);
}
