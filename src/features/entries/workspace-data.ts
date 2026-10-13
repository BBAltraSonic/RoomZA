import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import { toDiscoveryPlace, type DiscoveryPlaceRow } from "@/features/places/place";
import { entryCategorySchema, entryDraftSchema, type EntryCategory } from "./schema";
import { entryOwnedRowSchema, type OwnedEntryDraft } from "./intake-contract";
import type { EntryIntakeDatabase } from "./intake";
import { readOwnedEntryPublication } from "./publication-data";
import type { entryPublicationStateSchema } from "./publication-contract";

type WorkspaceDatabase = Omit<EntryIntakeDatabase, "public"> & {
  public: Omit<EntryIntakeDatabase["public"], "Tables"> & {
    Tables: EntryIntakeDatabase["public"]["Tables"] & {
      pinpoint_entry_revisions: { Row: { id: string; entry_id: string; poster_id: string; category: string; content: Json; submitted_at: string }; Insert: never; Update: never; Relationships: [] };
      pinpoint_entry_events: { Row: { id: string; poster_id: string; category: string; entry_id: string | null; revision_id: string | null; actor_id: string; action: string; version: number | null; created_at: string }; Insert: never; Update: never; Relationships: [] };
      discovery_places: { Row: DiscoveryPlaceRow; Insert: never; Update: never; Relationships: [] };
    };
  };
};

const entryColumns = "id,category,poster_id,draft,version,pending_revision_id,withdrawn_at,updated_at,guest_contact_exempt";
const revisionRowSchema = z.object({ id: z.string().uuid(), entry_id: z.string().uuid(), poster_id: z.string().uuid(), category: entryCategorySchema,
  content: entryDraftSchema, submitted_at: z.string().datetime({ offset: true }) }).strict();
const eventRowSchema = z.object({ id: z.string().uuid(), action: z.enum(["create", "save", "submit", "withdraw", "reject", "approve", "unpublish"]), version: z.number().int().positive(), created_at: z.string().datetime({ offset: true }) }).strict();

async function ownerClient(path: string) {
  const { user } = await requireUser({ redirectTo: path });
  if (user.is_anonymous) throw new Error("Poster account required");
  const client = await createClient() as unknown as SupabaseClient<WorkspaceDatabase>;
  return { client, user };
}

export type EntryWorkspace = {
  category: EntryCategory;
  enrollment: "required" | "active" | "revoked";
  entries: OwnedEntryDraft[];
  hasNext: boolean;
};

export async function readEntryWorkspace(category: EntryCategory, page = 1): Promise<EntryWorkspace> {
  const requestedCategory = entryCategorySchema.parse(category);
  z.number().int().min(1).max(10000).parse(page);
  const { client, user } = await ownerClient(`/post/entries/${requestedCategory}`);
  const { data: poster, error: posterError } = await client.from("entry_posters").select("user_id,category,enrolled_at,revoked_at")
    .eq("user_id", user.id).eq("category", requestedCategory).maybeSingle();
  if (posterError) throw posterError;
  if (!poster) return { category: requestedCategory, enrollment: "required", entries: [], hasNext: false };
  if (poster.revoked_at) return { category: requestedCategory, enrollment: "revoked", entries: [], hasNext: false };
  const { data, error } = await client.from("pinpoint_entries").select(entryColumns)
    .eq("poster_id", user.id).eq("category", requestedCategory).order("updated_at", { ascending: false }).order("id")
    .range((page - 1) * 20, page * 20);
  if (error) throw error;
  const rows = (data ?? []).map((row) => {
    const value = entryOwnedRowSchema.parse(row);
    if (value.poster_id !== user.id || value.category !== requestedCategory) throw new Error("Entry owner response mismatch");
    return Object.freeze({ guestContactExempt: value.guest_contact_exempt, id: value.id, category: value.category, draft: Object.freeze(value.draft), version: value.version,
      pendingRevisionId: value.pending_revision_id, withdrawnAt: value.withdrawn_at, updatedAt: value.updated_at });
  });
  return { category: requestedCategory, enrollment: "active", entries: rows.slice(0, 20), hasNext: rows.length > 20 };
}

export type EntryWorkspaceDetail = {
  entry: OwnedEntryDraft;
  placeLabel: string | null;
  submission: { id: string; content: z.infer<typeof entryDraftSchema>; submittedAt: string } | null;
  history: { id: string; action: string; version: number; occurredAt: string }[];
  publication?: z.infer<typeof entryPublicationStateSchema>;
};

export async function readEntryWorkspaceDetail(category: EntryCategory, entryId: string): Promise<EntryWorkspaceDetail | null> {
  const requestedCategory = entryCategorySchema.parse(category), target = z.string().uuid().parse(entryId);
  const { client, user } = await ownerClient(`/post/entries/${requestedCategory}/${target}`);
  const { data, error } = await client.from("pinpoint_entries").select(entryColumns)
    .eq("poster_id", user.id).eq("category", requestedCategory).eq("id", target).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = entryOwnedRowSchema.parse(data);
  if (row.poster_id !== user.id || row.category !== requestedCategory || row.id !== target) throw new Error("Entry owner response mismatch");
  const entry: OwnedEntryDraft = Object.freeze({ guestContactExempt: row.guest_contact_exempt, id: row.id, category: row.category, draft: Object.freeze(row.draft), version: row.version,
    pendingRevisionId: row.pending_revision_id, withdrawnAt: row.withdrawn_at, updatedAt: row.updated_at });
  const [revisions, events, place, publication] = await Promise.all([
    client.from("pinpoint_entry_revisions").select("id,entry_id,poster_id,category,content,submitted_at")
      .eq("entry_id", target).eq("poster_id", user.id).eq("category", requestedCategory).order("submitted_at", { ascending: false }).limit(1),
    client.from("pinpoint_entry_events").select("id,action,version,created_at")
      .eq("entry_id", target).eq("poster_id", user.id).eq("category", requestedCategory).order("version", { ascending: false }).limit(20),
    row.draft.areaId ? client.from("discovery_places").select("id,provider_id,name,region,full_address,center_lat,center_lng,west,south,east,north").eq("id", row.draft.areaId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    readOwnedEntryPublication(requestedCategory,target),
  ]);
  for (const response of [revisions, events, place]) if (response.error) throw response.error;
  const rawRevision = revisions.data?.[0] ?? null;
  const submitted = rawRevision ? revisionRowSchema.parse(rawRevision) : null;
  if (submitted && (submitted.entry_id !== target || submitted.poster_id !== user.id || submitted.category !== requestedCategory)) {
    throw new Error("Entry submission response mismatch");
  }
  const history = (events.data ?? []).map((event) => eventRowSchema.parse(event)).map((event) => ({
    id: event.id, action: event.action, version: event.version, occurredAt: event.created_at,
  }));
  return { entry, placeLabel: place.data ? (() => { const value = toDiscoveryPlace(place.data); return `${value.label}, ${value.secondaryLabel}`; })() : null,
    submission: submitted ? { id: submitted.id, content: Object.freeze(submitted.content), submittedAt: submitted.submitted_at } : null, history, publication };
}
