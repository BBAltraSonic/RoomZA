import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { OrganizationRole } from "@/features/organizations/types";
import { getInteractionProfileMap, type InteractionProfile } from "@/features/profile/interaction-data";
import { serviceClient } from "@/features/services/data";
import { logger } from "@/lib/logger";
import { createUntypedClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

import type { FactListing } from "../listing-facts";
import type { PreviewListing, PreviewService } from "./change-preview";
import { buildPeople, type PeopleInput, type Person } from "./people";

/**
 * Business mode's data layer. Every read goes through the lister's own session, so row
 * security decides what each login sees and the assistant adds no permissions of its own.
 * Two narrow exceptions use the service key, both for rows the session already returned:
 * customer display names (the same helper the applicants page uses) and the lister's own
 * organisation membership. A part that fails to load is reported as failed, never as empty.
 */

type SessionClient = Awaited<ReturnType<typeof createClient>>;

export type ListerContext = {
  supabase: SessionClient;
  userId: string;
  organizationId: string | null;
  role: OrganizationRole | null;
  /** Set only when the database would let this login act on the organisation's listings. */
  managedOrganizationId: string | null;
};

export async function getListerContext(): Promise<ListerContext | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user;
  if (error || !user) return null;

  const [{ data: profile }, memberships] = await Promise.all([
    supabase.from("profiles").select("active_organization_id").eq("id", user.id).maybeSingle(),
    createUntypedClient()
      .from("organization_memberships")
      .select("organization_id, role, organizations!inner(deleted_at)")
      .eq("user_id", user.id)
      .is("revoked_at", null),
  ]);
  type Row = { organization_id: string; role: OrganizationRole; organizations: { deleted_at: string | null } | { deleted_at: string | null }[] | null };
  const live = ((memberships.data ?? []) as Row[]).filter((row) => {
    const organization = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
    return organization && !organization.deleted_at;
  });
  const active = live.find((row) => row.organization_id === profile?.active_organization_id) ?? null;
  return {
    supabase,
    userId: user.id,
    organizationId: active?.organization_id ?? null,
    role: active?.role ?? null,
    // pinpoint_property_save and can_manage_listing accept owners and admins of the active organisation only.
    managedOrganizationId: active && (active.role === "owner" || active.role === "admin") ? active.organization_id : null,
  };
}

export type ListerListing = FactListing & {
  status: string;
  updated_at: string;
  landlord_id: string;
  organization_id: string | null;
  description: string | null;
  property_type: string | null;
  sale_price: number | null;
  latitude: number | null;
  longitude: number | null;
  nsfasApproved: boolean;
  photoCount: number;
};

export type ListerService = { id: string; title: string };

export type LoadPart = "listings" | "services" | "conversations" | "messages" | "showings" | "applications" | "bookings" | "buyerInterests" | "actions" | "photos";

export type ConversationMessage = { conversationId: string; senderId: string; createdAt: string };

export type ListerData = {
  now: Date;
  listings: ListerListing[];
  services: ListerService[];
  peopleInput: PeopleInput;
  people: Person[];
  /** Every message's sender and time (no content), oldest first, for reply times. */
  messages: ConversationMessage[];
  conversationListing: Map<string, string>;
  failed: Set<LoadPart>;
};

const LISTING_COLUMNS = [
  "id", "title", "listing_type", "price", "sale_price", "bedrooms", "bathrooms", "parking_type", "parking_count", "parking_included",
  "parking_estimate", "electricity_type", "electricity_included", "electricity_estimate", "water_availability", "water_included",
  "water_estimate", "wifi_available", "wifi_included", "wifi_estimate", "deposit_amount", "admin_fee", "lease_duration",
  "availability_date", "metadata", "status", "updated_at", "landlord_id", "organization_id", "description", "property_type",
  "latitude", "longitude", "listing_accreditations(nsfas_approved)",
].join(",");

/** People who went quiet more than this long ago drop out of the assistant's view. */
const WINDOW_DAYS = 90;
const MAX_ROWS = 2000;

export function canManageListing(context: Pick<ListerContext, "userId" | "managedOrganizationId">, listing: Pick<ListerListing, "landlord_id" | "organization_id">) {
  return listing.landlord_id === context.userId || Boolean(listing.organization_id && listing.organization_id === context.managedOrganizationId);
}

function serviceTitle(row: { draft: Json; submitted: Json }) {
  for (const content of [row.submitted, row.draft]) {
    const title = content && typeof content === "object" && !Array.isArray(content) ? content.title : undefined;
    if (typeof title === "string" && title.trim()) return title.trim();
  }
  return "Your service";
}

function asMetadata(value: unknown): FactListing["metadata"] {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as FactListing["metadata"]) : null;
}

export async function loadListerData(context: ListerContext, now = new Date()): Promise<ListerData> {
  const { supabase, userId, organizationId } = context;
  const failed = new Set<LoadPart>();
  const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000).toISOString();
  const note = (part: LoadPart, error: { message: string } | null) => {
    if (!error) return;
    failed.add(part);
    logger.warn("assistant.business.load_failed", { part, error: error.message });
  };

  let listingQuery = supabase.from("listings").select(LISTING_COLUMNS).neq("status", "archived");
  listingQuery = organizationId ? listingQuery.or(`landlord_id.eq.${userId},organization_id.eq.${organizationId}`) : listingQuery.eq("landlord_id", userId);
  const services = await serviceClient();
  const [listingResult, serviceResult] = await Promise.all([
    listingQuery.order("updated_at", { ascending: false }).limit(200),
    services.from("service_submissions").select("id,draft,submitted,status").eq("poster_id", userId).in("status", ["approved", "submitted"]).limit(100),
  ]);
  note("listings", listingResult.error);
  note("services", serviceResult.error);

  type ListingRow = Omit<ListerListing, "nsfasApproved" | "photoCount" | "metadata"> & { metadata: unknown; listing_accreditations?: { nsfas_approved: boolean | null }[] | null };
  const listingRows = (listingResult.data ?? []) as unknown as ListingRow[];
  const listingIds = listingRows.map((row) => row.id);
  const serviceRows = (serviceResult.data ?? []) as { id: string; draft: Json; submitted: Json }[];
  const serviceIds = serviceRows.map((row) => row.id);
  const none = Promise.resolve({ data: [], error: null });

  const [photos, conversations, showings, applications, bookings, interests, actions] = await Promise.all([
    listingIds.length ? supabase.from("listing_images").select("listing_id").in("listing_id", listingIds) : none,
    listingIds.length ? supabase.from("conversations").select("id,listing_id,renter_id,created_at").in("listing_id", listingIds).order("created_at", { ascending: false }).limit(MAX_ROWS) : none,
    listingIds.length ? supabase.from("showing_requests").select("id,listing_id,renter_id,status,requested_at,scheduled_for,expires_at,responded_at,completed_at").in("listing_id", listingIds).gte("requested_at", since).limit(MAX_ROWS) : none,
    listingIds.length ? supabase.from("applications").select("id,listing_id,renter_id,status,move_in_date,created_at,updated_at").in("listing_id", listingIds).limit(MAX_ROWS) : none,
    serviceIds.length ? supabase.from("service_bookings").select("id,service_id,customer_id,customer_name,status,slot_start,created_at").eq("provider_id", userId).gte("created_at", since).limit(MAX_ROWS) : none,
    listingIds.length ? supabase.from("buyer_interests").select("id,listing_id,buyer_id,status,viewing_date,created_at,updated_at").in("listing_id", listingIds).limit(MAX_ROWS) : none,
    listingIds.length || serviceIds.length
      ? supabase.from("assistant_action_log").select("actor_id,subject_key,action,created_at").or([listingIds.length ? `listing_id.in.(${listingIds.join(",")})` : "", serviceIds.length ? `service_id.in.(${serviceIds.join(",")})` : ""].filter(Boolean).join(",")).order("created_at", { ascending: false }).limit(MAX_ROWS)
      : none,
  ]);
  note("photos", photos.error);
  note("conversations", conversations.error);
  note("showings", showings.error);
  note("applications", applications.error);
  note("bookings", bookings.error);
  note("buyerInterests", interests.error);
  note("actions", actions.error);

  type ConversationRow = { id: string; listing_id: string; renter_id: string; created_at: string };
  const conversationRows = (conversations.data ?? []) as ConversationRow[];
  const conversationListing = new Map(conversationRows.map((row) => [row.id, row.listing_id]));
  const conversationIds = conversationRows.map((row) => row.id);
  // Senders and times only. Message text is read separately, on the server, for topic counts.
  const messageResult = conversationIds.length
    ? await supabase.from("messages").select("conversation_id,sender_id,created_at").in("conversation_id", conversationIds).gte("created_at", since).order("created_at", { ascending: true }).limit(MAX_ROWS * 3)
    : { data: [], error: null };
  note("messages", messageResult.error);
  const messages: ConversationMessage[] = ((messageResult.data ?? []) as { conversation_id: string; sender_id: string; created_at: string }[])
    .map((row) => ({ conversationId: row.conversation_id, senderId: row.sender_id, createdAt: row.created_at }));
  const lastMessage = new Map<string, ConversationMessage>();
  for (const message of messages) lastMessage.set(message.conversationId, message);

  const photoCounts = new Map<string, number>();
  for (const row of (photos.data ?? []) as { listing_id: string }[]) photoCounts.set(row.listing_id, (photoCounts.get(row.listing_id) ?? 0) + 1);
  const listings: ListerListing[] = listingRows.map(({ listing_accreditations, metadata, ...row }) => ({
    ...row,
    metadata: asMetadata(metadata),
    nsfasApproved: Boolean(listing_accreditations?.some((accreditation) => accreditation.nsfas_approved)),
    photoCount: photoCounts.get(row.id) ?? 0,
  }));

  type ShowingRow = { id: string; listing_id: string; renter_id: string; status: string; requested_at: string; scheduled_for: string | null; expires_at: string; responded_at: string | null; completed_at: string | null };
  type ApplicationRow = { id: string; listing_id: string; renter_id: string; status: string; move_in_date: string | null; created_at: string; updated_at: string };
  type BookingRow = { id: string; service_id: string; customer_id: string; customer_name: string | null; status: string; slot_start: string; created_at: string };
  type InterestRow = { id: string; listing_id: string; buyer_id: string; status: string; viewing_date: string | null; created_at: string; updated_at: string };
  type ActionRow = { actor_id: string; subject_key: string; action: string; created_at: string };
  const showingRows = (showings.data ?? []) as ShowingRow[];
  const applicationRows = (applications.data ?? []) as ApplicationRow[];
  const bookingRows = (bookings.data ?? []) as BookingRow[];
  const interestRows = (interests.data ?? []) as InterestRow[];
  const actionRows = (actions.data ?? []) as ActionRow[];

  const customerIds = [
    ...conversationRows.map((row) => row.renter_id),
    ...showingRows.map((row) => row.renter_id),
    ...applicationRows.map((row) => row.renter_id),
    ...bookingRows.map((row) => row.customer_id),
    ...interestRows.map((row) => row.buyer_id),
  ];
  const profiles = await getInteractionProfileMap([...customerIds, ...actionRows.map((row) => row.actor_id)]).catch((error: unknown) => {
    logger.warn("assistant.business.names_failed", { error: error instanceof Error ? error.message : String(error) });
    return new Map<string, InteractionProfile>();
  });
  const profile = (id: string) => profiles.get(id);

  const peopleInput: PeopleInput = {
    now,
    listings: listings.map((listing) => ({ id: listing.id, title: listing.title, price: listing.listing_type === "sale" ? listing.sale_price ?? listing.price : listing.price, availabilityDate: listing.availability_date, kind: listing.listing_type === "sale" ? "sale" : "rent" })),
    services: serviceRows.map((row) => ({ id: row.id, title: serviceTitle(row) })),
    conversations: conversationRows.map((row) => {
      const last = lastMessage.get(row.id);
      return { id: row.id, listingId: row.listing_id, customerId: row.renter_id, createdAt: row.created_at, lastMessageAt: last?.createdAt ?? null, lastSenderIsCustomer: last ? last.senderId === row.renter_id : null };
    }),
    showings: showingRows.map((row) => ({ id: row.id, listingId: row.listing_id, customerId: row.renter_id, status: row.status, requestedAt: row.requested_at, scheduledFor: row.scheduled_for, expiresAt: row.expires_at, respondedAt: row.responded_at, completedAt: row.completed_at })),
    applications: applicationRows.map((row) => ({ id: row.id, listingId: row.listing_id, customerId: row.renter_id, status: row.status, moveInDate: row.move_in_date, createdAt: row.created_at, updatedAt: row.updated_at })),
    bookings: bookingRows.map((row) => ({ id: row.id, serviceId: row.service_id, customerId: row.customer_id, customerName: row.customer_name, status: row.status, slotStart: row.slot_start, createdAt: row.created_at })),
    buyerInterests: interestRows.map((row) => ({ id: row.id, listingId: row.listing_id, customerId: row.buyer_id, status: row.status, viewingDate: row.viewing_date, createdAt: row.created_at, updatedAt: row.updated_at })),
    profiles: [...new Set(customerIds)].map((id) => ({ id, name: profile(id)?.full_name ?? null, verified: Boolean(profile(id)?.phone_verified) })),
    actions: actionRows.map((row) => ({ subjectKey: row.subject_key, action: row.action, actorName: row.actor_id === userId ? "you" : profile(row.actor_id)?.full_name ?? "a team member", createdAt: row.created_at })),
  };

  return {
    now,
    listings,
    services: peopleInput.services,
    peopleInput,
    people: buildPeople(peopleInput),
    messages,
    conversationListing,
    failed,
  };
}

/** The records a change preview needs, with who may approve each one. */
export function previewInputFrom(context: ListerContext, data: ListerData) {
  const listings: PreviewListing[] = data.listings.map((listing) => ({
    id: listing.id,
    title: listing.title,
    kind: listing.listing_type === "sale" ? "sale" : "rent",
    status: listing.status,
    price: listing.price,
    salePrice: listing.sale_price,
    updatedAt: listing.updated_at,
    canManage: canManageListing(context, listing),
  }));
  // Only the poster's own services are loaded, and the poster manages them.
  const services: PreviewService[] = data.services.map((service) => ({ ...service, canManage: true }));
  return { now: data.now, people: data.people, showings: data.peopleInput.showings, applications: data.peopleInput.applications, bookings: data.peopleInput.bookings, listings, services };
}

/**
 * Customer message text for "what people ask about". Read on the server, matched against a
 * fixed word list in `findTopics`, and dropped: only counts leave this function's caller.
 */
export async function loadTopicMessages(context: ListerContext, data: ListerData, days = 30) {
  const customerOf = new Map(data.peopleInput.conversations.map((conversation) => [conversation.id, conversation.customerId]));
  const ids = [...customerOf.keys()];
  if (!ids.length) return { messages: [], failed: false };
  const since = new Date(data.now.getTime() - days * 86_400_000).toISOString();
  const { data: rows, error } = await context.supabase.from("messages").select("conversation_id,sender_id,content").in("conversation_id", ids).gte("created_at", since).limit(MAX_ROWS);
  if (error) {
    logger.warn("assistant.business.topics_failed", { error: error.message });
    return { messages: [], failed: true };
  }
  const messages = ((rows ?? []) as { conversation_id: string; sender_id: string; content: string }[])
    .filter((row) => customerOf.get(row.conversation_id) === row.sender_id)
    .map((row) => ({ listingId: data.conversationListing.get(row.conversation_id)!, conversationId: row.conversation_id, content: row.content }));
  return { messages, failed: false };
}

/** Whether the lister has weekly viewing hours. Unknown for a colleague's listing, so not flagged. */
export async function loadHasViewingHours(context: ListerContext) {
  const { count, error } = await context.supabase.from("landlord_viewing_hours").select("weekday", { count: "exact", head: true }).eq("landlord_id", context.userId);
  return error ? null : (count ?? 0) > 0;
}

/** Listing views in the last 30 days. Row security shows only the lister's own listings' views. */
export async function loadViewCounts(context: ListerContext, listingIds: readonly string[], now: Date) {
  const counts = new Map<string, number | null>();
  if (!listingIds.length) return counts;
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const { data, error } = await context.supabase.from("analytics_events").select("properties").eq("event_name", "listing_view").in("properties->>listingId", [...listingIds]).gte("created_at", since).limit(20_000);
  for (const id of listingIds) counts.set(id, error ? null : 0);
  if (error) {
    logger.warn("assistant.business.views_failed", { error: error.message });
    return counts;
  }
  for (const row of (data ?? []) as { properties: Json }[]) {
    const id = row.properties && typeof row.properties === "object" && !Array.isArray(row.properties) ? row.properties.listingId : null;
    if (typeof id === "string" && counts.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** Similar published listings nearby: same type and kind, within about 5 km. */
export async function loadNearby(context: ListerContext, listing: ListerListing) {
  if (listing.latitude === null || listing.longitude === null || !listing.property_type) return null;
  const box = 0.045;
  const { data, error } = await context.supabase
    .from("listings")
    .select("id,price,sale_price,listing_images(id)")
    .eq("status", "published")
    .eq("property_type", listing.property_type)
    .eq("listing_type", listing.listing_type ?? "rent")
    .neq("id", listing.id)
    .gte("latitude", listing.latitude - box)
    .lte("latitude", listing.latitude + box)
    .gte("longitude", listing.longitude - box)
    .lte("longitude", listing.longitude + box)
    .limit(60);
  if (error) return null;
  return ((data ?? []) as unknown as { price: number | null; sale_price: number | null; listing_images: { id: string }[] | null }[]).map((row) => ({
    price: listing.listing_type === "sale" ? row.sale_price ?? row.price : row.price,
    photos: row.listing_images?.length ?? 0,
  }));
}

/** Specials of the lister's ending in the next three days, from each offer's latest version. */
export async function loadExpiringSpecials(context: ListerContext, now: Date): Promise<{ has: boolean; count: number | null }> {
  const client = context.supabase as unknown as SupabaseClient;
  const [{ data: offers, error: offerError }, { data: revisions, error: revisionError }] = await Promise.all([
    client.from("shopping_offers").select("id,withdrawn_at").eq("poster_id", context.userId).limit(200),
    client.from("shopping_offer_revisions").select("offer_id,content,submitted_at").eq("poster_id", context.userId).order("submitted_at", { ascending: false }).limit(500),
  ]);
  if (offerError || revisionError) return { has: Boolean(offers?.length), count: null };
  const live = new Set(((offers ?? []) as { id: string; withdrawn_at: string | null }[]).filter((offer) => !offer.withdrawn_at).map((offer) => offer.id));
  const latest = new Map<string, unknown>();
  for (const revision of (revisions ?? []) as { offer_id: string; content: unknown }[]) if (!latest.has(revision.offer_id)) latest.set(revision.offer_id, revision.content);
  const soon = now.getTime() + 3 * 86_400_000;
  let count = 0;
  for (const [offerId, content] of latest) {
    const endsAt = content && typeof content === "object" ? Date.parse(String((content as { endsAt?: unknown }).endsAt)) : Number.NaN;
    if (live.has(offerId) && endsAt > now.getTime() && endsAt <= soon) count += 1;
  }
  return { has: live.size > 0, count };
}

/** Median minutes between a customer's message and the lister's next reply, last 90 days. */
export function medianReplySeconds(messages: readonly ConversationMessage[], customerOf: ReadonlyMap<string, string>): number | null {
  const waiting = new Map<string, number>();
  const gaps: number[] = [];
  for (const message of messages) {
    const customer = customerOf.get(message.conversationId);
    if (!customer) continue;
    const at = Date.parse(message.createdAt);
    if (message.senderId === customer) {
      if (!waiting.has(message.conversationId)) waiting.set(message.conversationId, at);
    } else if (waiting.has(message.conversationId)) {
      gaps.push((at - waiting.get(message.conversationId)!) / 1000);
      waiting.delete(message.conversationId);
    }
  }
  if (gaps.length < 3) return null;
  const sorted = gaps.sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}
