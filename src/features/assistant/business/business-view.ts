import "server-only";

import { z } from "zod";

import type { ViewingSlot } from "@/features/showings/viewing-availability";
import { logger } from "@/lib/logger";

import type { AssistantAiConfig } from "../openrouter";
import { writeListing } from "./ai-listing-writer";
import { canManageListing, loadExpiringSpecials, loadHasViewingHours, loadListerData, loadNearby, loadTopicMessages, loadViewCounts, medianReplySeconds, previewInputFrom, type ListerContext, type ListerData, type LoadPart } from "./business-data";
import { buildChangePreview, NEEDS_OWNER_OR_ADMIN, type ChangePreview } from "./change-preview";
import { writingInputFromListing, type ListingWriting } from "./listing-writer";
import { filterPeople, groupPeople, type PeopleFilters, type Person, type Stage } from "./people";
import { funnelSteps, median, statTiles, suggestions, type FunnelCounts, type ListingFunnel, type Nearby, type StatTile, type Suggestion } from "./performance";
import { checkListingQuality, needsImportantInfo, type QualityIssue } from "./quality";
import { isDueBy, reminderDueAt } from "./reminder-times";
import type { BusinessRequest, ChangeRequest, NewListingDraft } from "./request-intent";
import { buildToday, type ListerHas, type TodayCounts, type TodayItem, type TodayNote } from "./today";
import { findTopics, type TopicInsight } from "./topics";

/**
 * Fills one business template from the lister's own data (proposal, "Templates"). The AI is
 * never involved here except in `new_listing`, where it may suggest the wording, and only when
 * the caller hands over an allowance. Nothing in this file changes anything: reminders are
 * returned as a draft and changes as a preview, both for the lister to approve.
 */

export type ReminderView = { id: string; note: string; dueAt: string; due: boolean; personKey: string | null; personName: string | null; subjectTitle: string | null };

export type PersonAction = { label: string; request: BusinessRequest } | { label: string; href: string };

export type BusinessView =
  | { template: "today"; items: TodayItem[]; notes: TodayNote[]; badge: number; reminders: ReminderView[] }
  | { template: "people_list"; filters: PeopleFilters; groups: { stage: Stage; label: string; people: Person[] }[]; total: number; notes: string[] }
  | { template: "person_detail"; person: Person | null; actions: PersonAction[]; canApprove: boolean; notes: string[] }
  | { template: "question_insights"; insights: TopicInsight[]; notes: string[] }
  | { template: "new_listing"; draft: NewListingDraft; writing: ListingWriting; source: "ai" | "rules"; missing: string[]; notes: string[] }
  | { template: "quality_check"; listings: { id: string; title: string; issues: QualityIssue[] }[]; notes: string[] }
  | { template: "improve_listing"; listingId: string; listingTitle: string | null; current: string; proposed: string | null; source: "ai" | "rules"; canApprove: boolean; approveNote: string | null; expectedUpdatedAt: string | null; editHref: string | null; notes: string[] }
  | { template: "performance"; tiles: StatTile[]; funnels: { listingId: string; title: string; steps: ReturnType<typeof funnelSteps> }[]; suggestions: Suggestion[]; nearby: Nearby[]; notes: string[] }
  | { template: "change_preview"; change: ChangeRequest; preview: ChangePreview }
  | { template: "viewing_slots"; listingId: string | null; listingTitle: string | null; personKey: string | null; slots: ViewingSlot[]; hasHours: boolean; notes: string[]; fixHref: string | null }
  | { template: "reminders"; reminders: ReminderView[]; draft: { note: string; dueAt: string; personKey: string | null } | null; notes: string[] };

export type ViewOptions = {
  /** Called only when the AI would help; returns null when no allowance is left. */
  ai?: () => Promise<AssistantAiConfig | null>;
  now?: Date;
};

const PART_WORDS: Partial<Record<LoadPart, string>> = {
  conversations: "Enquiries",
  messages: "Messages",
  showings: "Viewings",
  applications: "Applications",
  buyerInterests: "Buyer interest",
  actions: "Team activity",
  listings: "Listings",
  photos: "Photo counts",
};

function failureNotes(data: ListerData, parts: readonly LoadPart[]) {
  return parts.filter((part) => data.failed.has(part)).map((part) => `${PART_WORDS[part] ?? part} couldn't load, try again`);
}

const PEOPLE_PARTS: LoadPart[] = ["conversations", "messages", "showings", "applications", "buyerInterests"];

async function loadReminders(context: ListerContext, data: ListerData) {
  const { data: rows, error } = await context.supabase
    .from("assistant_reminders")
    .select("id,note,due_at,subject_key")
    .is("done_at", null)
    .order("due_at", { ascending: true })
    .limit(100);
  if (error) {
    logger.warn("assistant.business.reminders_failed", { error: error.message });
    return null;
  }
  const people = new Map(data.people.map((person) => [person.key, person]));
  return rows.map((row): ReminderView => {
    const person = row.subject_key ? people.get(row.subject_key) : undefined;
    return { id: row.id, note: row.note, dueAt: row.due_at, due: isDueBy(row.due_at, data.now), personKey: row.subject_key, personName: person?.name ?? null, subjectTitle: person?.subjectTitle ?? null };
  });
}

function qualityFor(data: ListerData, hasViewingHours: boolean | null, context: ListerContext) {
  const issues = new Map<string, QualityIssue[]>();
  for (const listing of data.listings) {
    // Viewing hours belong to the listing's owner; unknown for a colleague's listing, so not flagged.
    const ownHours = listing.landlord_id === context.userId ? hasViewingHours ?? true : true;
    issues.set(listing.id, checkListingQuality({ ...listing, deposit_amount: listing.deposit_amount ?? null }, { photoCount: listing.photoCount, hasViewingHours: ownHours }));
  }
  return issues;
}

const count = (data: ListerData, parts: LoadPart[], value: () => number) => (parts.some((part) => data.failed.has(part)) ? null : value());

async function todayView(context: ListerContext, data: ListerData): Promise<BusinessView> {
  const [hasViewingHours, specials, reminders] = await Promise.all([loadHasViewingHours(context), loadExpiringSpecials(context, data.now), loadReminders(context, data)]);
  const quality = qualityFor(data, hasViewingHours, context);
  const next = (kind: Person["next"][number]) => data.people.filter((person) => person.next.includes(kind)).length;
  const counts: TodayCounts = {
    enquiriesWaiting: count(data, ["conversations", "messages"], () => next("reply")),
    applicationsToReview: count(data, ["applications"], () => next("review-application")),
    viewingRequests: count(data, ["showings"], () => next("viewing-request")),
    followUps: count(data, PEOPLE_PARTS, () => next("follow-up")),
    listingsNeedingInfo: count(data, ["listings", "photos"], () => [...quality.values()].filter(needsImportantInfo).length),
    expiringSpecials: specials.count,
  };
  const has: ListerHas = {
    rentals: data.listings.some((listing) => listing.listing_type !== "sale"),
    sales: data.listings.some((listing) => listing.listing_type === "sale"),
    specials: specials.has,
  };
  const today = buildToday(counts, has);
  const open = reminders ?? [];
  const dueCount = open.filter((reminder) => reminder.due).length;
  const notes = reminders ? today.notes : [...today.notes, { key: "followUps" as const, message: "Reminders couldn't load, try again" }];
  return { template: "today", items: today.items, notes, badge: today.badge + dueCount, reminders: open.filter((reminder) => reminder.due) };
}

function personActions(person: Person): PersonAction[] {
  const actions: PersonAction[] = [];
  if (person.next.includes("viewing-request")) {
    actions.push({ label: "Accept viewing", request: { template: "change_preview", change: { kind: "accept_viewings", personKey: person.key } } });
    actions.push({ label: "Decline viewing", request: { template: "change_preview", change: { kind: "decline_viewing", personKey: person.key } } });
    actions.push({ label: "Suggest times", request: { template: "viewing_slots", personKey: person.key } });
  }
  if (person.next.includes("review-application") || person.stage === "applied") {
    actions.push({ label: "Move application along", request: { template: "change_preview", change: { kind: "review_applications", personKey: person.key } } });
  }
  if (person.refs.conversationId) actions.push({ label: person.next.includes("reply") ? "Reply" : "Open messages", href: `/messages/${person.refs.conversationId}` });
  if (person.next.includes("follow-up")) {
    actions.push({ label: "Remind me to follow up", request: { template: "reminders", create: { text: `Follow up with ${person.name} about ${person.subjectTitle}`.slice(0, 200), due: "tomorrow" } } });
  }
  if (person.stage === "ready-to-apply") actions.push({ label: "Suggest times", request: { template: "viewing_slots", personKey: person.key } });
  return actions;
}

function missingFields(draft: NewListingDraft) {
  const missing: string[] = [];
  if (!draft.propertyType) missing.push("Type of place");
  if (draft.bedrooms === undefined && draft.propertyType !== "room" && draft.propertyType !== "studio") missing.push("Bedrooms");
  if (!draft.price) missing.push("Price");
  if (!draft.area) missing.push("Area");
  return missing;
}

async function performanceView(context: ListerContext, data: ListerData, listingId?: string): Promise<BusinessView> {
  const now = data.now;
  const listings = data.listings.filter((listing) => !listingId || listing.id === listingId).slice(0, 20);
  const own = listings.filter((listing) => listing.landlord_id === context.userId);
  const [views, hasViewingHours, nearbyRows] = await Promise.all([
    loadViewCounts(context, own.map((listing) => listing.id), now),
    loadHasViewingHours(context),
    Promise.all(listings.slice(0, 10).map(async (listing) => [listing.id, await loadNearby(context, listing)] as const)),
  ]);
  const enquiries = new Map<string, number>();
  for (const conversation of data.peopleInput.conversations) enquiries.set(conversation.listingId, (enquiries.get(conversation.listingId) ?? 0) + 1);
  const viewings = new Map<string, number>();
  for (const showing of data.peopleInput.showings) viewings.set(showing.listingId, (viewings.get(showing.listingId) ?? 0) + 1);
  const applications = new Map<string, number>();
  for (const application of data.peopleInput.applications) applications.set(application.listingId, (applications.get(application.listingId) ?? 0) + 1);

  const funnels: ListingFunnel[] = listings.map((listing) => {
    // Enquiries, viewings and views on a colleague's listing are private to them, so not counted.
    const mine = listing.landlord_id === context.userId;
    const counts: FunnelCounts = {
      views: mine ? views.get(listing.id) ?? null : null,
      enquiries: mine && !data.failed.has("conversations") ? enquiries.get(listing.id) ?? 0 : null,
      viewings: mine && !data.failed.has("showings") ? viewings.get(listing.id) ?? 0 : null,
      applications: data.failed.has("applications") ? null : applications.get(listing.id) ?? 0,
    };
    return { listingId: listing.id, title: listing.title, price: listing.listing_type === "sale" ? listing.sale_price ?? listing.price : listing.price, photoCount: listing.photoCount, counts };
  });
  const nearby: Nearby[] = nearbyRows.flatMap(([id, rows]) => (rows ? [{ listingId: id, similarCount: rows.length, medianPrice: median(rows.flatMap((row) => (row.price ? [row.price] : []))), medianPhotos: rows.length >= 3 ? median(rows.map((row) => row.photos)) : null }] : []));
  const customerOf = new Map(data.peopleInput.conversations.map((conversation) => [conversation.id, conversation.customerId]));
  const ownFunnels = funnels.filter((funnel) => own.some((listing) => listing.id === funnel.listingId));
  const notes = failureNotes(data, ["conversations", "showings", "applications"]);
  if (ownFunnels.length < funnels.length) notes.push("Totals cover your own listings. Enquiries on a colleague's listing are private to them.");
  return {
    template: "performance",
    tiles: statTiles(ownFunnels, medianReplySeconds(data.messages, customerOf)),
    funnels: funnels.map((funnel) => ({ listingId: funnel.listingId, title: funnel.title, steps: funnelSteps(funnel.counts) })),
    suggestions: suggestions(funnels, qualityFor(data, hasViewingHours, context), new Map(nearby.map((entry) => [entry.listingId, entry]))),
    nearby,
    notes,
  };
}

const availabilitySchema = z.object({ hasHours: z.boolean(), slots: z.array(z.object({ start: z.string(), end: z.string() })) }).passthrough();

async function viewingSlotsView(context: ListerContext, data: ListerData, personKey?: string): Promise<BusinessView> {
  const person = personKey ? data.people.find((candidate) => candidate.key === personKey) : undefined;
  const listing = person
    ? data.listings.find((candidate) => candidate.id === person.subjectId)
    : data.listings.find((candidate) => candidate.status === "published" && candidate.listing_type !== "sale" && candidate.landlord_id === context.userId);
  const empty = { template: "viewing_slots" as const, listingId: listing?.id ?? null, listingTitle: listing?.title ?? null, personKey: person?.key ?? null, slots: [], hasHours: false };
  if (!listing) return { ...empty, notes: ["Choose a rental to suggest viewing times for."], fixHref: null };
  const { data: availability, error } = await context.supabase.rpc("listing_viewing_availability", { target_listing_id: listing.id });
  const parsed = availabilitySchema.safeParse(availability);
  if (error || (availability !== null && !parsed.success)) return { ...empty, notes: ["Viewing times couldn't load, try again"], fixHref: null };
  if (!parsed.success || !parsed.data.hasHours) return { ...empty, notes: ["No viewing hours set, so there are no times to suggest."], fixHref: `/dashboard/listings/${listing.id}/edit` };
  return { ...empty, hasHours: true, slots: parsed.data.slots.slice(0, 8), notes: parsed.data.slots.length ? [] : ["Every slot in your viewing hours is taken this week."], fixHref: null };
}

export async function buildBusinessView(request: BusinessRequest, context: ListerContext, options: ViewOptions = {}): Promise<BusinessView> {
  const data = await loadListerData(context, options.now);
  return buildViewFromData(request, context, data, options);
}

export async function buildViewFromData(request: BusinessRequest, context: ListerContext, data: ListerData, options: ViewOptions = {}): Promise<BusinessView> {
  switch (request.template) {
    case "today":
      return todayView(context, data);

    case "people_list": {
      const filtered = filterPeople(data.people, request.filters, data.now);
      return { template: "people_list", filters: request.filters, groups: groupPeople(filtered), total: filtered.length, notes: failureNotes(data, PEOPLE_PARTS) };
    }

    case "person_detail": {
      const person = data.people.find((candidate) => candidate.key === request.personKey) ?? null;
      const listing = person ? data.listings.find((candidate) => candidate.id === person.subjectId) : undefined;
      const canApprove = listing ? canManageListing(context, listing) : false;
      return { template: "person_detail", person, actions: person ? personActions(person) : [], canApprove, notes: person ? failureNotes(data, PEOPLE_PARTS) : ["That person isn't in your recent activity."] };
    }

    case "question_insights": {
      const topics = await loadTopicMessages(context, data);
      const listings = data.listings.filter((listing) => !request.listingId || listing.id === request.listingId);
      const notes = topics.failed ? ["Enquiries couldn't load, try again"] : [];
      return { template: "question_insights", insights: findTopics(topics.messages, listings), notes };
    }

    case "new_listing": {
      const config = options.ai ? await options.ai() : null;
      const outcome = await writeListing(request.draft, config);
      const notes = options.ai && !config ? ["The writing help is resting for today, so this is a plain version."] : [];
      return { template: "new_listing", draft: request.draft, writing: outcome.writing, source: outcome.source, missing: missingFields(request.draft), notes };
    }

    case "quality_check": {
      const quality = qualityFor(data, await loadHasViewingHours(context), context);
      const listings = data.listings
        .filter((listing) => !request.listingId || listing.id === request.listingId)
        .map((listing) => ({ id: listing.id, title: listing.title, issues: quality.get(listing.id) ?? [] }))
        .filter((entry) => entry.issues.length)
        .sort((a, b) => Number(needsImportantInfo(b.issues)) - Number(needsImportantInfo(a.issues)) || b.issues.length - a.issues.length);
      return { template: "quality_check", listings, notes: failureNotes(data, ["listings", "photos"]) };
    }

    case "improve_listing": {
      const listing = data.listings.find((candidate) => candidate.id === request.listingId);
      if (!listing) {
        return { template: "improve_listing", listingId: request.listingId, listingTitle: null, current: "", proposed: null, source: "rules", canApprove: false, approveNote: null, expectedUpdatedAt: null, editHref: null, notes: ["That listing isn't one you manage."] };
      }
      const canApprove = canManageListing(context, listing);
      const config = canApprove && options.ai ? await options.ai() : null;
      const outcome = await writeListing(writingInputFromListing(listing), config);
      const current = listing.description?.trim() ?? "";
      // Only offer it when it adds something; a shorter rewrite is no improvement.
      const proposed = outcome.writing.description.trim().length > current.length ? outcome.writing.description.trim() : null;
      const notes = [
        ...(options.ai && canApprove && !config ? ["The writing help is resting for today, so this is a plain version."] : []),
        ...(proposed ? [] : ["I couldn't write anything fuller than what's there. Add details in the listing form."]),
      ];
      return {
        template: "improve_listing",
        listingId: listing.id,
        listingTitle: listing.title,
        current,
        proposed,
        source: outcome.source,
        canApprove,
        approveNote: canApprove ? null : NEEDS_OWNER_OR_ADMIN,
        expectedUpdatedAt: listing.updated_at,
        editHref: `/dashboard/listings/${listing.id}/edit`,
        notes,
      };
    }

    case "performance":
      return performanceView(context, data, request.listingId);

    case "change_preview":
      return { template: "change_preview", change: request.change, preview: buildChangePreview(request.change, previewInputFrom(context, data)) };

    case "viewing_slots":
      return viewingSlotsView(context, data, request.personKey);

    case "reminders": {
      const reminders = await loadReminders(context, data);
      const draft = request.create ? { note: request.create.text, dueAt: reminderDueAt(request.create.due ?? "tomorrow", data.now).toISOString(), personKey: null } : null;
      return { template: "reminders", reminders: reminders ?? [], draft, notes: reminders ? [] : ["Reminders couldn't load, try again"] };
    }
  }
}
