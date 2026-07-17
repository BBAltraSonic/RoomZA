import { z } from "zod";

import { adminLevels, moderationCategories, moderationPriorities, moderationStatuses } from "./types";

export const reportSchema = z.object({
  listingId: z.string().uuid().optional(),
  reportedUserId: z.string().uuid().optional(),
  messageId: z.string().uuid().optional(),
  listingImageId: z.string().uuid().optional(),
  category: z.enum(moderationCategories),
  details: z.string().trim().min(20).max(2000),
}).refine((value) => [value.listingId, value.reportedUserId, value.messageId, value.listingImageId].filter(Boolean).length === 1, {
  message: "Choose exactly one report target.",
  path: ["_form"],
});

export const caseUpdateSchema = z.object({
  caseId: z.string().uuid(),
  status: z.enum(moderationStatuses),
  priority: z.enum(moderationPriorities),
  assignedTo: z.string().uuid().nullable().optional(),
  resolutionNote: z.string().trim().max(5000).nullable().optional(),
});

export const caseNoteSchema = z.object({
  caseId: z.string().uuid(),
  body: z.string().trim().min(1).max(5000),
});

export const suspensionSchema = z.object({
  userId: z.string().uuid(),
  duration: z.enum(["24h", "168h", "720h", "876000h"]),
  reason: z.string().trim().min(10).max(2000),
});

export const restoreAccountSchema = z.object({ userId: z.string().uuid(), reason: z.string().trim().min(10).max(2000) });

export const listingRestrictionSchema = z.object({
  listingId: z.string().uuid(),
  reason: z.string().trim().min(10).max(2000),
});

export const nsfasAccreditationSchema = z.object({
  listingId: z.string().uuid(),
  approved: z.boolean(),
  reason: z.string().trim().min(10).max(2000),
});

export const membershipSchema = z.object({
  email: z.string().trim().email().max(320),
  level: z.enum(adminLevels),
});

export const revokeMembershipSchema = z.object({ userId: z.string().uuid(), reason: z.string().trim().min(10).max(2000) });

export const sensitiveGrantSchema = z.object({
  caseId: z.string().uuid(),
  resourceType: z.enum(["conversation", "document"]),
  resourceId: z.string().uuid(),
  reason: z.string().trim().min(20).max(2000),
});

export const csvFilterSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  status: z.enum(moderationStatuses).optional(),
});
