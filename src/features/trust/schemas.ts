import { z } from "zod";

export const trustVersionIdSchema = z.string().uuid();
export const trustDocumentIdSchema = z.string().uuid();

export const trustDraftSchema = z.object({
  id: z.string().uuid(),
  bodyMarkdown: z.string().trim().min(200).max(100_000).refine((value) => !/<\/?[a-z][^>]*>/i.test(value), "Raw HTML is not allowed in policy content."),
  changeSummary: z.string().trim().min(5).max(1_000),
  requiresReacceptance: z.boolean(),
});

export const trustApprovalSchema = z.object({
  id: z.string().uuid(),
  externalReviewerName: z.string().trim().min(2).max(200),
  counselReference: z.string().trim().min(2).max(500),
  reviewedAt: z.string().datetime(),
});

export const privacyRequestInputSchema = z.object({
  requestType: z.enum(["correction", "deletion", "objection", "withdraw_consent"]),
  details: z.string().trim().min(20).max(5_000),
});

export const privacyRequestAdminSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["submitted", "in_review", "waiting_on_user", "completed", "declined", "cancelled"]),
  resolutionNote: z.string().trim().max(5_000).nullable().optional(),
  retentionDecision: z.record(z.string(), z.string().max(1_000)).default({}),
});

export const notificationPreferencesSchema = z.object({
  applicationUpdates: z.boolean(),
  viewingUpdates: z.boolean(),
  messageDigest: z.boolean(),
  searchAlerts: z.boolean(),
  marketing: z.boolean(),
  locationPersonalization: z.boolean(),
  digestFrequency: z.enum(["never", "daily", "weekly"]),
});

export const verificationCheckSchema = z.object({
  listingId: z.string().uuid(),
  verified: z.boolean(),
  evidenceNote: z.string().trim().min(10).max(2_000),
});

export const transparencyPeriodSchema = z.object({
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
});

export const trustRollbackSchema = z.object({
  versionId: z.string().uuid(),
  requiresReacceptance: z.boolean(),
});
