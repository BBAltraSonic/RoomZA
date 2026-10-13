import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { OfferIntakeDatabase } from "./intake";
import { offerDraftSchema } from "./schema";
import type { OwnedOffer, OfferWorkspaceDetail } from "./workspace-contract";
import type { Json } from "@/lib/supabase/types";
import { ownedOfferStatusBatchSchema } from "./owned-status-contract";

type WorkspaceDatabase = Omit<OfferIntakeDatabase, "public"> & {
  public: Omit<OfferIntakeDatabase["public"], "Tables" | "Functions"> & {
    Tables: OfferIntakeDatabase["public"]["Tables"] & {
      discovery_places: { Row: { id: string; name: string; region: string }; Insert: never; Update: never; Relationships: [] };
    };
    Functions: OfferIntakeDatabase["public"]["Functions"] & {
      pinpoint_offer_owned_status: { Args: { targets: string[] }; Returns: Json };
    };
  };
};

const columns = "id,draft,version,pending_revision_id,withdrawn_at,updated_at,guest_contact_exempt";
const rowSchema = z.object({
  guest_contact_exempt: z.boolean().optional(),
  id: z.string().uuid(), draft: offerDraftSchema, version: z.number().int().positive(),
  pending_revision_id: z.string().uuid().nullable(), withdrawn_at: z.string().nullable(), updated_at: z.string(),
});
function ownedOffer(row: unknown): OwnedOffer {
  const value = rowSchema.parse(row);
  return { guestContactExempt: value.guest_contact_exempt, id: value.id, draft: value.draft, version: value.version, pendingRevisionId: value.pending_revision_id,
    withdrawnAt: value.withdrawn_at, updatedAt: value.updated_at };
}
async function ownerClient(path: string) {
  const { user } = await requireUser({ redirectTo: path });
  const client = await createClient() as unknown as SupabaseClient<WorkspaceDatabase>;
  return { client, user };
}

async function attachPublication(client: SupabaseClient<WorkspaceDatabase>, offers: OwnedOffer[]) {
  if (!offers.length) return offers;
  const { data, error } = await client.rpc("pinpoint_offer_owned_status", { targets: offers.map(offer => offer.id) });
  if (error) throw error;
  const summaries = ownedOfferStatusBatchSchema.parse(data);
  const byId = new Map(summaries.map(summary => [summary.offerId, summary]));
  if (byId.size !== offers.length) throw new Error("Offer summaries changed. Reload the workspace.");
  return offers.map(offer => {
    const summary = byId.get(offer.id);
    if (!summary || summary.version !== offer.version) throw new Error("Offer version changed. Reload the workspace.");
    const publication = { status: summary.status, checkedAt: summary.checkedAt, revisionId: summary.revisionId,
      confirmedAt: summary.confirmedAt, startsAt: summary.startsAt, endsAt: summary.endsAt };
    return { ...offer, publication };
  });
}

export async function readOfferWorkspace(page = 1) {
  z.number().int().min(1).max(10000).parse(page);
  const { client, user } = await ownerClient("/post/offers");
  const { data: poster, error: posterError } = await client.from("offer_posters")
    .select("revoked_at").eq("user_id", user.id).maybeSingle();
  if (posterError) throw posterError;
  if (!poster || poster.revoked_at) return { enrollment: poster ? "revoked" as const : "required" as const, offers: [], hasNext: false };
  const { data, error } = await client.from("shopping_offers").select(columns)
    .eq("poster_id", user.id).order("updated_at", { ascending: false }).order("id")
    .range((page - 1) * 20, page * 20);
  if (error) throw error;
  return { enrollment: "active" as const, offers: await attachPublication(client, (data ?? []).slice(0, 20).map(ownedOffer)), hasNext: (data?.length ?? 0) > 20 };
}

export async function readOwnedOffer(offerId: string): Promise<OfferWorkspaceDetail | null> {
  z.string().uuid().parse(offerId);
  const { client, user } = await ownerClient(`/post/offers/${offerId}`);
  const { data, error } = await client.from("shopping_offers").select(columns)
    .eq("poster_id", user.id).eq("id", offerId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [offer] = await attachPublication(client, [ownedOffer(data)]);
  if (!offer) throw new Error("Offer summary is unavailable. Reload the workspace.");
  const [revisions, events, place] = await Promise.all([
    client.from("shopping_offer_revisions").select("id,content,submitted_at")
      .eq("poster_id", user.id).eq("offer_id", offerId).order("submitted_at", { ascending: false }).limit(1),
    client.from("shopping_offer_events").select("id,action,reason,occurred_at,version")
      .eq("poster_id", user.id).eq("offer_id", offerId).order("version", { ascending: false }).limit(20),
    offer.draft.areaId ? client.from("discovery_places").select("name,region").eq("id", offer.draft.areaId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  for (const response of [revisions, events, place]) if (response.error) throw response.error;
  const submission = revisions.data?.[0];
  return {
    offer,
    placeLabel: place.data ? `${place.data.name}, ${place.data.region}` : null,
    submission: submission ? { id: submission.id, content: offerDraftSchema.parse(submission.content), submittedAt: submission.submitted_at } : null,
    history: (events.data ?? []).map((event) => ({ id: event.id, action: event.action, reason: event.reason,
      occurredAt: event.occurred_at, version: event.version })),
  };
}
