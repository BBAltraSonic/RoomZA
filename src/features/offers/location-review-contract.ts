import { z } from "zod";
import { offerContentSchema } from "./schema";

export const LOCATION_REVIEW_VERSION = "admin-location-review-v1";
export const locationReviewChecks = [
  { key: "provenanceChecked", text: "I checked source evidence connecting this stored provider reference to a South African place." },
  { key: "shopChecked", text: "I checked the shop identity, public address and exact shop point against the source." },
  { key: "contentChecked", text: "I checked the offer benefit and terms against the source." },
  { key: "datesChecked", text: "I checked the validity dates against the source, including the South Africa time offsets." },
] as const;
const version = z.number().int().min(1).max(2_147_483_646);
export const reviewedPlaceSchema = z.object({
  id: z.string().uuid(), provider_id: z.string().min(1), level: z.enum(["neighbourhood", "locality", "place", "municipality"]),
  name: z.string(), region: z.string(), full_address: z.string(), center_lat: z.number().finite(), center_lng: z.number().finite(),
  west: z.number().finite(), south: z.number().finite(), east: z.number().finite(), north: z.number().finite(),
  created_at: z.string().datetime({ offset: true }),
}).strict();
export const locationEvidenceRequestSchema = z.object({
  offerId: z.string().uuid(), revisionId: z.string().uuid(), expectedVersion: version, requestId: z.string().uuid(),
  permissionReviewId: z.string().uuid(), placeSnapshot: reviewedPlaceSchema,
  provenanceReference: z.string().trim().min(1).max(1000), shopReference: z.string().trim().min(1).max(1000),
  verificationNote: z.string().trim().min(1).max(2000),
  provenanceChecked: z.literal(true), shopChecked: z.literal(true), contentChecked: z.literal(true), datesChecked: z.literal(true),
  statementVersion: z.literal(LOCATION_REVIEW_VERSION),
}).strict();
export type LocationEvidenceRequest = z.infer<typeof locationEvidenceRequestSchema>;
export const locationReviewSnapshotSchema = z.object({
  offerId: z.string().uuid(), revisionId: z.string().uuid(), version, content: offerContentSchema,
  place: reviewedPlaceSchema.nullable(), permissionReviewId: z.string().uuid().nullable(),
  evidence: z.object({
    id: z.string().uuid(), reviewerId: z.string().uuid(), offerVersion: version, permissionReviewId: z.string().uuid(),
    placeSnapshot: reviewedPlaceSchema, provenanceReference: z.string(), shopReference: z.string(), verificationNote: z.string(),
    statementVersion: z.literal(LOCATION_REVIEW_VERSION), checkedAt: z.string().datetime({ offset: true }),
  }).strict().nullable(),
}).strict();
export type LocationReviewSnapshot = z.infer<typeof locationReviewSnapshotSchema>;
