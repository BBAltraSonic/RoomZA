import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import { requireAdmin } from "@/features/admin/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/types";
import { entryCategorySchema, type EntryCategory } from "./schema";
import { entryPosterSchema } from "./intake-contract";

// The poster read is backed by the clone-verified private intake migration.
// Publication evidence is revision-bound and read through the current MFA
// reviewer session; missing or mismatched evidence fails closed.
type EntryAccessDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Functions"> & {
    Functions: Database["public"]["Functions"] & {
      pinpoint_entry_poster: { Args: { category: EntryCategory }; Returns: Json };
      pinpoint_entry_publication_evidence: {
        Args: { category: EntryCategory; target: string; revision: string }; Returns: Json;
      };
    };
  };
};
const uuid = z.string().uuid();
export const entryPublicationEvidenceSchema = z.object({
  entryId: uuid, revisionId: uuid, category: entryCategorySchema, areaId: uuid,
  placeReviewId: uuid, authorityReviewId: uuid, mediaState: z.literal("none"),
}).strict();
export type EntryPublicationEvidence = Readonly<z.infer<typeof entryPublicationEvidenceSchema>>;

async function sessionClient() {
  return await createClient() as unknown as SupabaseClient<EntryAccessDatabase>;
}

export async function requireEntryPoster(category: EntryCategory) {
  const { user } = await requireUser();
  if (user.is_anonymous) throw new Error("Poster account required");
  const validatedCategory = entryCategorySchema.parse(category);
  const client = await sessionClient();
  const { data, error } = await client.rpc("pinpoint_entry_poster", { category: validatedCategory });
  if (error) throw error;
  const poster = entryPosterSchema.parse(data);
  if (poster.userId !== user.id || poster.category !== validatedCategory) {
    throw new Error("Category poster access required");
  }
  return poster.userId;
}

export async function requireEntryReviewer() {
  // Current membership, suspension and actual MFA checks are owned by
  // the existing guard. A supplied canReview flag never enters this path.
  const { user } = await requireAdmin();
  return uuid.parse(user.id);
}

export async function requireEntryPublicationEvidence(category: EntryCategory, entryId: string, revisionId: string) {
  await requireAdmin();
  const client = await sessionClient();
  const { data, error } = await client.rpc("pinpoint_entry_publication_evidence", {
    category: entryCategorySchema.parse(category), target: uuid.parse(entryId), revision: uuid.parse(revisionId),
  });
  if (error) throw error;
  const proof = entryPublicationEvidenceSchema.parse(data);
  if (proof.entryId !== entryId || proof.revisionId !== revisionId || proof.category !== category) {
    throw new Error("Revision publication evidence required");
  }
  return Object.freeze(proof);
}
