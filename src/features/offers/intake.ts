import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import { requireAdmin } from "@/features/admin/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/types";
import { offerContentSchema, offerDraftSchema } from "./schema";

// Narrow additive RPC types; retain the existing generated Property types.
type IntakeTable<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
export type OfferIntakeDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Functions" | "Tables"> & {
    Tables: Database["public"]["Tables"] & {
      offer_posters: IntakeTable<{ user_id: string; enrolled_at: string; revoked_at: string | null }>;
      shopping_offers: IntakeTable<{
        id: string; guest_contact_exempt: boolean; poster_id: string; draft: Json; version: number; pending_revision_id: string | null;
        withdrawn_at: string | null; created_at: string; updated_at: string;
      }>;
      shopping_offer_revisions: IntakeTable<{
        id: string; offer_id: string; poster_id: string; content: Json; submitted_at: string;
      }>;
      shopping_offer_events: IntakeTable<{
        id: string; poster_id: string; offer_id: string | null; revision_id: string | null;
        actor_id: string; action: string; version: number | null; reason: string | null; occurred_at: string;
      }>;
    };
    Functions: Database["public"]["Functions"] & {
      pinpoint_offer_enroll: { Args: Record<string, never>; Returns: string };
      pinpoint_offer_write: {
        Args: { command: string; target: string; expected_version: number; payload?: Json; revision?: string };
        Returns: Json;
      };
      pinpoint_offer_review_read: { Args: { target: string }; Returns: Json };
      pinpoint_offer_reject: {
        Args: { target: string; revision: string; expected_version: number; reason: string };
        Returns: Json;
      };
    };
  };
};

const uuid = z.string().uuid();
const version = z.number().int().min(1).max(2_147_483_646);
const mutationSchema = z.object({
  offerId: uuid,
  version: version,
  pendingRevisionId: uuid.nullable(),
}).strict();
const reviewSchema = z.object({
  offerId: uuid,
  version,
  revisionId: uuid,
  content: offerContentSchema,
  submittedAt: z.string().datetime({ offset: true }),
}).strict();

async function sessionClient() {
  // Keep cookie credentials. Never replace this with a service-role client.
  return await createClient() as unknown as SupabaseClient<OfferIntakeDatabase>;
}

export async function enrollOfferPoster() {
  await requireUser();
  const client = await sessionClient();
  const { data, error } = await client.rpc("pinpoint_offer_enroll", {});
  if (error) throw error;
  return uuid.parse(data);
}

export async function writeOfferIntake(input: {
  command: "create" | "save" | "submit" | "withdraw";
  offerId: string;
  expectedVersion: number;
  draft?: unknown;
  revisionId?: string;
}) {
  await requireUser();
  const command = z.enum(["create", "save", "submit", "withdraw"]).parse(input.command);
  const offerId = uuid.parse(input.offerId);
  const expectedVersion = command === "create"
    ? z.literal(0).parse(input.expectedVersion) : version.parse(input.expectedVersion);
  if (command === "create") await enrollOfferPoster();
  const payload = command === "save" ? offerDraftSchema.parse(input.draft) : {};
  const revision = command === "submit" ? uuid.parse(input.revisionId) : undefined;
  const client = await sessionClient();
  const { data, error } = await client.rpc("pinpoint_offer_write", {
    command, target: offerId, expected_version: expectedVersion, payload, ...(revision ? { revision } : {}),
  });
  if (error) throw error;
  return mutationSchema.parse(data);
}

export async function readOfferSubmissionForReview(offerId: string) {
  await requireAdmin();
  const client = await sessionClient();
  const { data, error } = await client.rpc("pinpoint_offer_review_read", { target: uuid.parse(offerId) });
  if (error) throw error;
  return data === null ? null : reviewSchema.parse(data);
}

export async function rejectOfferSubmission(input: {
  offerId: string; revisionId: string; expectedVersion: number; reason: string;
}) {
  await requireAdmin();
  const client = await sessionClient();
  const { data, error } = await client.rpc("pinpoint_offer_reject", {
    target: uuid.parse(input.offerId), revision: uuid.parse(input.revisionId),
    expected_version: version.parse(input.expectedVersion), reason: z.string().trim().min(1).max(2000).parse(input.reason),
  });
  if (error) throw error;
  return mutationSchema.parse(data);
}
