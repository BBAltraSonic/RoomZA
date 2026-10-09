import { z } from "zod";
import { offerContentSchema } from "./schema";

export const offerReviewSnapshotSchema = z.object({
  offerId: z.string().uuid(), version: z.number().int().positive(), revisionId: z.string().uuid(),
  content: offerContentSchema, submittedAt: z.string().datetime({ offset: true }),
}).strict();
export type OfferReviewSnapshot = z.infer<typeof offerReviewSnapshotSchema>;
export const offerRejectionRequestSchema = z.object({
  offerId: z.string().uuid(), revisionId: z.string().uuid(),
  expectedVersion: z.number().int().min(1).max(2_147_483_646), reason: z.string().trim().min(1).max(2000),
}).strict();
