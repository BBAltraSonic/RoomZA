import { z } from "zod";
import { entryCategorySchema, entryContentSchema } from "./schema";

const uuid = z.string().uuid();
const target = { category: entryCategorySchema, entryId: uuid, expectedVersion: z.number().int().min(1).max(2_147_483_646) };
export const entryPermissionCommandSchema = z.object({ ...target, revisionId: uuid, permissionConfirmed: z.literal(true) }).strict();
export const entryDecisionSchema = z.discriminatedUnion("decision", [
  z.object({ ...target, decision: z.literal("approve"), revisionId: uuid,
    authorityNotes: z.string().trim().min(1).max(2000), locationNotes: z.string().trim().min(1).max(2000),
    mediaState: z.enum(["none", "reviewed"]), reviewed: z.literal(true) }).strict(),
  z.object({ ...target, decision: z.literal("reject"), revisionId: uuid, reason: z.string().trim().min(1).max(2000) }).strict(),
  z.object({ ...target, decision: z.literal("unpublish"), reason: z.string().trim().min(1).max(2000) }).strict(),
]);
export type EntryDecision = z.infer<typeof entryDecisionSchema>;
export const entryPermissionResultSchema = z.object({ entryId: uuid, category: entryCategorySchema, revisionId: uuid,
  confirmed: z.literal(true), version: z.number().int().positive() }).strict();
export const entryReviewQueueSchema = z.array(z.object({ entryId: uuid, category: entryCategorySchema, version: z.number().int().positive(),
  posterId: uuid, revisionId: uuid, content: entryContentSchema, submittedAt: z.string().datetime({ offset: true }),
  pending: z.boolean(), published: z.boolean(), permissionConfirmed: z.boolean() }).strict()).max(100);
export type EntryReviewItem = z.infer<typeof entryReviewQueueSchema>[number];
export const entryPublicationStateSchema = z.object({ permissionConfirmed: z.boolean(),
  state: z.enum(["private", "awaiting_review", "withdrawn", "scheduled", "available", "ended", "unpublished"]),
  correction: z.string().nullable() }).strict();
