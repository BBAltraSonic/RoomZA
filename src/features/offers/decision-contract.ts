import { z } from "zod";
import { offerContentSchema } from "./schema";

export const OFFER_APPROVAL_VERSION = "admin-offer-approval-v1";
export const OFFER_APPROVAL_STATEMENT = "I confirm this exact revision after checking current poster authorization, supplied permission evidence, South African place provenance, shop identity, public address, exact point, offer terms and validity dates.";
const version = z.number().int().min(1).max(2_147_483_646);
const identity = { offerId: z.string().uuid(), revisionId: z.string().uuid(), expectedVersion: version, requestId: z.string().uuid() };
export const offerDecisionRequestSchema = z.discriminatedUnion("command", [
  z.object({ command: z.literal("approve"), ...identity, permissionReviewId: z.string().uuid(), locationReviewId: z.string().uuid(), approvalConfirmed: z.literal(true), statementVersion: z.literal(OFFER_APPROVAL_VERSION) }).strict(),
  z.object({ command: z.literal("unpublish"), ...identity, reason: z.string().trim().min(1).max(2000) }).strict(),
]);
export type OfferDecisionRequest = z.infer<typeof offerDecisionRequestSchema>;
export const offerDecisionSnapshotSchema = z.object({
  offerId: z.string().uuid(), version: z.number().int().positive(), pendingRevisionId: z.string().uuid().nullable(), withdrawnAt: z.string().datetime({ offset: true }).nullable(),
  decision: z.object({ id: z.string().uuid(), revisionId: z.string().uuid(), action: z.enum(["approve", "invalidate", "unpublish"]), actorId: z.string().uuid(),
    capturedVersion: version, version: z.number().int().positive(), reason: z.string().nullable(), occurredAt: z.string().datetime({ offset: true }) }).strict(),
  content: offerContentSchema,
}).strict();
export type OfferDecisionSnapshot = z.infer<typeof offerDecisionSnapshotSchema>;
