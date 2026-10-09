import { z } from "zod";
import { entryCategorySchema, entryDraftSchema, entryContentSchema } from "./schema";

const uuid = z.string().uuid();
const expectedVersion = z.number().int().min(1).max(2_147_483_646);
const storedVersion = z.number().int().min(1).max(2_147_483_647);
const target = { category: entryCategorySchema, entryId: uuid };

export const entryPosterSchema = z.object({
  userId: uuid, category: entryCategorySchema,
  enrolledAt: z.string().datetime({ offset: true }), revokedAt: z.null(),
}).strict();
export const entryIntakeCommandSchema = z.discriminatedUnion("command", [
  z.object({ ...target, command: z.literal("create"), expectedVersion: z.literal(0) }).strict(),
  z.object({ ...target, command: z.literal("save"), expectedVersion, draft: entryDraftSchema }).strict(),
  z.object({ ...target, command: z.literal("submit"), expectedVersion, revisionId: uuid }).strict(),
  z.object({ ...target, command: z.literal("withdraw"), expectedVersion }).strict(),
]);
export type EntryIntakeCommand = z.infer<typeof entryIntakeCommandSchema>;
export const entryIntakeResultSchema = z.object({
  entryId: uuid, category: entryCategorySchema, version: storedVersion, pendingRevisionId: uuid.nullable(),
}).strict();
export const entryOwnedRowSchema = z.object({
  id: uuid, category: entryCategorySchema, poster_id: uuid, draft: entryDraftSchema, version: storedVersion,
  pending_revision_id: uuid.nullable(), withdrawn_at: z.string().datetime({ offset: true }).nullable(),
  updated_at: z.string().datetime({ offset: true }),
}).strict();
export const entryReviewSnapshotSchema = z.object({
  entryId: uuid, category: entryCategorySchema, version: storedVersion, posterId: uuid, revisionId: uuid,
  content: entryContentSchema, submittedAt: z.string().datetime({ offset: true }),
}).strict();
export const entryCorrectionInputSchema = z.object({
  ...target, expectedVersion, revisionId: uuid, reason: z.string().trim().min(1).max(2000),
}).strict();
export type EntryCorrectionInput = z.infer<typeof entryCorrectionInputSchema>;
export type OwnedEntryDraft = Readonly<{
  id: string; category: z.infer<typeof entryCategorySchema>; draft: z.infer<typeof entryDraftSchema>; version: number;
  pendingRevisionId: string | null; withdrawnAt: string | null; updatedAt: string;
}>;
