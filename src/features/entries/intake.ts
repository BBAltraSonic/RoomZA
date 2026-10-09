import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import { requireAdmin } from "@/features/admin/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/types";
import { entryCategorySchema, type EntryCategory } from "./schema";
import {
  entryPosterSchema, entryIntakeCommandSchema, entryIntakeResultSchema, entryOwnedRowSchema,
  entryReviewSnapshotSchema, entryCorrectionInputSchema,
  type EntryIntakeCommand, type OwnedEntryDraft, type EntryCorrectionInput,
} from "./intake-contract";

// Narrow additive contracts; retain the existing generated Property types.
export type EntryIntakeDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Functions" | "Tables"> & {
    Tables: Database["public"]["Tables"] & {
      entry_posters: {
        Row: { user_id: string; category: string; enrolled_at: string; revoked_at: string | null };
        Insert: never; Update: never; Relationships: [];
      };
      pinpoint_entries: {
        Row: { id: string; category: string; poster_id: string; draft: Json; version: number;
          pending_revision_id: string | null; withdrawn_at: string | null; updated_at: string };
        Insert: never; Update: never; Relationships: [];
      };
    };
    Functions: Database["public"]["Functions"] & {
      pinpoint_entry_enroll: { Args: { category: EntryCategory }; Returns: Json };
      pinpoint_entry_write: {
        Args: { command: string; category: EntryCategory; target: string; expected_version: number; payload: Json; revision?: string };
        Returns: Json;
      };
      pinpoint_entry_review_read: { Args: { category: EntryCategory; target: string }; Returns: Json };
      pinpoint_entry_reject: {
        Args: { category: EntryCategory; target: string; revision: string; expected_version: number; reason: string };
        Returns: Json;
      };
    };
  };
};

async function ownerSession() {
  const { user } = await requireUser();
  if (user.is_anonymous || !user.email_confirmed_at) throw new Error("Confirmed poster account required");
  // Cookie credentials only. The RPC rechecks current database eligibility and
  // category capability atomically; this guard is not a replacement for it.
  const client = await createClient() as unknown as SupabaseClient<EntryIntakeDatabase>;
  return { client, user };
}

export async function enrollEntryPoster(category: EntryCategory) {
  const { client, user } = await ownerSession();
  const requestedCategory = entryCategorySchema.parse(category);
  const { data, error } = await client.rpc("pinpoint_entry_enroll", { category: requestedCategory });
  if (error) throw error;
  const poster = entryPosterSchema.parse(data);
  if (poster.userId !== user.id || poster.category !== requestedCategory) throw new Error("Category enrollment response mismatch");
  return Object.freeze(poster);
}

// Internal adapter, not a Server Action/route. No actor, permission, content on
// submit, service credential or review command can enter the RPC argument set.
export async function writeEntryIntake(input: EntryIntakeCommand) {
  const { client } = await ownerSession();
  const command = entryIntakeCommandSchema.parse(input);
  const { data, error } = await client.rpc("pinpoint_entry_write", {
    command: command.command, category: command.category, target: command.entryId,
    expected_version: command.expectedVersion, payload: command.command === "save" ? command.draft : {},
    ...(command.command === "submit" ? { revision: command.revisionId } : {}),
  });
  // Preserve PT409; the caller must retain input and explicitly reload. Never retry.
  if (error) throw error;
  const result = entryIntakeResultSchema.parse(data);
  const expected = command.command === "create" ? 1 : command.expectedVersion + 1;
  const validVersion = result.version === expected || (command.command === "withdraw" && result.version === command.expectedVersion);
  const validPending = command.command === "submit" ? result.pendingRevisionId === command.revisionId
    : command.command === "create" || command.command === "withdraw" ? result.pendingRevisionId === null : true;
  if (result.entryId !== command.entryId || result.category !== command.category || !validVersion || !validPending) {
    throw new Error("Entry mutation response mismatch");
  }
  return Object.freeze(result);
}

export async function readOwnedEntryDraft(category: EntryCategory, entryId: string): Promise<OwnedEntryDraft | null> {
  const { client, user } = await ownerSession();
  const requestedCategory = entryCategorySchema.parse(category), target = z.string().uuid().parse(entryId);
  const { data, error } = await client.from("pinpoint_entries")
    .select("id,category,poster_id,draft,version,pending_revision_id,withdrawn_at,updated_at")
    .eq("poster_id", user.id).eq("category", requestedCategory).eq("id", target).maybeSingle();
  if (error) throw error;
  if (data === null) return null;
  const row = entryOwnedRowSchema.parse(data);
  if (row.id !== target || row.poster_id !== user.id || row.category !== requestedCategory) throw new Error("Entry owner response mismatch");
  return Object.freeze({ id: row.id, category: row.category, draft: Object.freeze(row.draft), version: row.version,
    pendingRevisionId: row.pending_revision_id, withdrawnAt: row.withdrawn_at, updatedAt: row.updated_at });
}

async function reviewerSession() {
  await requireAdmin();
  // Current membership and actual MFA are checked again by the locked RPC.
  return await createClient() as unknown as SupabaseClient<EntryIntakeDatabase>;
}

export async function readEntrySubmissionForReview(category: EntryCategory, entryId: string) {
  const client = await reviewerSession();
  const requestedCategory = entryCategorySchema.parse(category), target = z.string().uuid().parse(entryId);
  const { data, error } = await client.rpc("pinpoint_entry_review_read", { category: requestedCategory, target });
  if (error) throw error;
  if (data === null) return null;
  const snapshot = entryReviewSnapshotSchema.parse(data);
  if (snapshot.entryId !== target || snapshot.category !== requestedCategory) throw new Error("Entry review response mismatch");
  return Object.freeze({ ...snapshot, content: Object.freeze(snapshot.content) });
}

export async function rejectEntrySubmission(input: EntryCorrectionInput) {
  const client = await reviewerSession();
  const correction = entryCorrectionInputSchema.parse(input);
  const { data, error } = await client.rpc("pinpoint_entry_reject", {
    category: correction.category, target: correction.entryId, revision: correction.revisionId,
    expected_version: correction.expectedVersion, reason: correction.reason,
  });
  if (error) throw error;
  const result = entryIntakeResultSchema.parse(data);
  if (result.entryId !== correction.entryId || result.category !== correction.category
    || result.version !== correction.expectedVersion + 1 || result.pendingRevisionId !== null) {
    throw new Error("Entry correction response mismatch");
  }
  return Object.freeze(result);
}
