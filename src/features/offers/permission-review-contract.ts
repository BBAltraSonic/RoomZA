import { z } from "zod";
import { OFFER_PERMISSION_STATEMENT, OFFER_PERMISSION_VERSION } from "./permission-contract";

export const PERMISSION_REVIEW_VERSION = "admin-permission-review-v1";
export const PERMISSION_REVIEW_STATEMENT = "I checked supplied authorization or an existing permissioned business record establishing this poster’s authority for this shop, offer and public address.";
const evidenceKind = z.enum(["written_authorization", "existing_business_permission"]);
const reviewVersion = z.number().int().min(1).max(2_147_483_646);
export const permissionEvidenceRequestSchema = z.object({
  offerId: z.string().uuid(), revisionId: z.string().uuid(), expectedVersion: reviewVersion,
  requestId: z.string().uuid(), evidenceKind,
  sourceReference: z.string().trim().min(1).max(1000), verificationNote: z.string().trim().min(1).max(2000),
  authorizationChecked: z.literal(true), statementVersion: z.literal(PERMISSION_REVIEW_VERSION),
}).strict();
export type PermissionEvidenceRequest = z.infer<typeof permissionEvidenceRequestSchema>;
export const permissionReviewSnapshotSchema = z.object({
  offerId: z.string().uuid(), revisionId: z.string().uuid(), version: reviewVersion,
  permission: z.object({ posterId: z.string().uuid(), statement: z.literal(OFFER_PERMISSION_STATEMENT), statementVersion: z.literal(OFFER_PERMISSION_VERSION), confirmedAt: z.string().datetime({ offset: true }) }).strict().nullable(),
  evidence: z.object({
    id: z.string().uuid(), reviewerId: z.string().uuid(), offerVersion: reviewVersion, evidenceKind,
    sourceReference: z.string(), verificationNote: z.string(), statementVersion: z.literal(PERMISSION_REVIEW_VERSION), checkedAt: z.string().datetime({ offset: true }),
  }).strict().nullable(),
}).strict();
export type PermissionReviewSnapshot = z.infer<typeof permissionReviewSnapshotSchema>;
