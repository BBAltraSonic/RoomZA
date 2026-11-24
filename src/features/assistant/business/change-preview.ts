import { isPermittedTransition, type ApplicationStatus } from "@/features/applications/transitions";
import { formatSlotRequest } from "@/features/showings/viewing-availability";

import type { PeopleInput, Person } from "./people";
import type { ChangeKind, ChangeRequest } from "./request-intent";

/**
 * The change preview (proposal, capability 5): what will change and for whom, before
 * anything happens. Pure rules over records the lister's own login loaded. The server builds
 * the preview again at Approve time and runs only items it finds there, so a stale or forged
 * item list from the browser can never act.
 *
 * Who may approve mirrors the database: the listing's owner, or an owner or admin of its
 * organisation; a service's own poster. Decisions about a person (declining a viewing,
 * shortlisting or approving an application) are approved one at a time.
 */

export type PreviewListing = {
  id: string;
  title: string;
  kind: "rent" | "sale";
  status: string;
  price: number | null;
  salePrice: number | null;
  updatedAt: string;
  canManage: boolean;
};

export type PreviewService = { id: string; title: string; canManage: boolean };

export type PreviewInput = {
  now: Date;
  people: readonly Person[];
  showings: PeopleInput["showings"];
  applications: PeopleInput["applications"];
  bookings: PeopleInput["bookings"];
  listings: readonly PreviewListing[];
  services: readonly PreviewService[];
};

export type ChangeStep =
  | { type: "accept_showing"; showingId: string }
  | { type: "decline_showing"; showingId: string }
  | { type: "application_status"; applicationId: string; to: Extract<ApplicationStatus, "under_review" | "shortlisted" | "approved"> }
  | { type: "accept_booking"; bookingId: string }
  | { type: "archive_person"; customerId: string; listingId?: string; serviceId?: string }
  | { type: "mark_let"; listingId: string; expectedUpdatedAt: string }
  | { type: "change_price"; listingId: string; expectedUpdatedAt: string; from: number; to: number; sale: boolean };

export type ChangeItem = {
  /** Stable for the same record, so Approve can find it again. */
  id: string;
  label: string;
  detail: string;
  personKey?: string;
  subjectId: string;
  /** A decision about one person: never approved alongside anything else. */
  oneAtATime: boolean;
  /** Ticked when the preview opens. Off when the lister still has to choose. */
  preselected: boolean;
  canApprove: boolean;
  step: ChangeStep;
};

export type ChangePreview = {
  kind: ChangeKind;
  title: string;
  items: ChangeItem[];
  /** Shown instead of a list when there is nothing to change. */
  empty: string | null;
  /** Shown when the login can see the change but may not approve it. */
  approveNote: string | null;
};

export const NEEDS_OWNER_OR_ADMIN = "Needs an owner or admin";

const APPLICATION_NEXT: Partial<Record<ApplicationStatus, Extract<ApplicationStatus, "under_review" | "shortlisted" | "approved">>> = {
  submitted: "under_review",
  under_review: "shortlisted",
  shortlisted: "approved",
};

const APPLICATION_WORDS = { under_review: "Move to review", shortlisted: "Shortlist", approved: "Approve" } as const;

function rand(value: number) {
  return `R${Math.round(value).toLocaleString("en-US")}`;
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/** Rentals to the nearest R50, sales to the nearest R1,000. */
export function roundPrice(value: number, sale: boolean) {
  const step = sale ? 1000 : 50;
  return Math.max(step, Math.round(value / step) * step);
}

export function buildChangePreview(change: ChangeRequest, input: PreviewInput): ChangePreview {
  const now = input.now.getTime();
  const listings = new Map(input.listings.map((listing) => [listing.id, listing]));
  const services = new Map(input.services.map((service) => [service.id, service]));
  const names = new Map(input.people.map((person) => [person.key, person.name]));
  const nameFor = (customerId: string, subjectId: string) => names.get(`${customerId}:${subjectId}`) ?? "Someone";
  const onListing = (listingId: string) => !("listingId" in change) || !change.listingId || change.listingId === listingId;
  /** A preview opened from one person's card covers only that person. */
  const forPerson = (key: string) => change.kind !== "accept_viewings" && change.kind !== "review_applications" && change.kind !== "confirm_bookings" ? true : !change.personKey || change.personKey === key;
  const items: ChangeItem[] = [];

  switch (change.kind) {
    case "accept_viewings":
    case "decline_viewing": {
      const decline = change.kind === "decline_viewing";
      for (const showing of input.showings) {
        const listing = listings.get(showing.listingId);
        if (!listing || showing.status !== "requested" || Date.parse(showing.expiresAt) <= now) continue;
        const personKey = `${showing.customerId}:${showing.listingId}`;
        if (decline ? personKey !== change.personKey : !onListing(showing.listingId) || !forPerson(personKey)) continue;
        const name = nameFor(showing.customerId, showing.listingId);
        items.push({
          id: `showing:${showing.id}`,
          label: `${decline ? "Decline" : "Accept"} ${name}'s viewing`,
          detail: `${listing.title} · ${showing.scheduledFor ? formatSlotRequest(showing.scheduledFor) : "as soon as possible"}`,
          personKey,
          subjectId: listing.id,
          oneAtATime: decline,
          preselected: true,
          canApprove: listing.canManage,
          step: decline ? { type: "decline_showing", showingId: showing.id } : { type: "accept_showing", showingId: showing.id },
        });
      }
      return finish(change.kind, decline ? "Decline a viewing" : `Accept ${plural(items.length, "viewing request", "viewing requests")}`, items, "No viewing requests are waiting for an answer.");
    }

    case "review_applications": {
      for (const application of input.applications) {
        const listing = listings.get(application.listingId);
        const to = APPLICATION_NEXT[application.status as ApplicationStatus];
        const personKey = `${application.customerId}:${application.listingId}`;
        if (!listing || !to || !onListing(application.listingId) || !forPerson(personKey) || !isPermittedTransition(application.status as ApplicationStatus, to)) continue;
        items.push({
          id: `application:${application.id}:${to}`,
          label: `${APPLICATION_WORDS[to]}: ${nameFor(application.customerId, application.listingId)}`,
          detail: listing.title,
          personKey,
          subjectId: listing.id,
          // Moving to review decides nothing; shortlisting and approving are decisions about a person.
          oneAtATime: to !== "under_review",
          preselected: to === "under_review",
          canApprove: listing.canManage,
          step: { type: "application_status", applicationId: application.id, to },
        });
      }
      return finish(change.kind, "Move applications along", items, "No applications are waiting for a next step.");
    }

    case "confirm_bookings": {
      for (const booking of input.bookings) {
        const service = services.get(booking.serviceId);
        if (!service || booking.status !== "requested" || Date.parse(booking.slotStart) <= now || !forPerson(`${booking.customerId}:${booking.serviceId}`)) continue;
        items.push({
          id: `booking:${booking.id}`,
          label: `Confirm ${nameFor(booking.customerId, booking.serviceId)}'s booking`,
          detail: `${service.title} · ${formatSlotRequest(booking.slotStart)}`,
          personKey: `${booking.customerId}:${booking.serviceId}`,
          subjectId: service.id,
          oneAtATime: false,
          preselected: true,
          canApprove: service.canManage,
          step: { type: "accept_booking", bookingId: booking.id },
        });
      }
      return finish(change.kind, `Confirm ${plural(items.length, "booking", "bookings")}`, items, "No bookings are waiting for an answer.");
    }

    case "archive_quiet": {
      for (const person of input.people) {
        if (person.stage !== "gone-quiet") continue;
        const listing = listings.get(person.subjectId);
        const service = services.get(person.subjectId);
        const subject = listing ?? service;
        if (!subject || (listing && !onListing(listing.id))) continue;
        items.push({
          id: `archive:${person.key}`,
          label: `Archive ${person.name}`,
          detail: `${subject.title} · ${person.reasons.find((reason) => reason.startsWith("Quiet for")) ?? "Gone quiet"}`,
          personKey: person.key,
          subjectId: subject.id,
          oneAtATime: false,
          preselected: true,
          canApprove: subject.canManage,
          step: { type: "archive_person", customerId: person.customerId, ...(listing ? { listingId: listing.id } : { serviceId: subject.id }) },
        });
      }
      return finish(change.kind, `Archive ${plural(items.length, "person who has gone quiet", "people who have gone quiet")}`, items, "Nobody has gone quiet.");
    }

    case "mark_let": {
      const candidates = input.listings.filter((listing) => listing.kind === "rent" && listing.status === "published" && onListing(listing.id));
      for (const listing of candidates) {
        items.push({
          id: `let:${listing.id}`,
          label: `Mark ${listing.title} as let`,
          detail: "It stops showing in search. You can publish it again later.",
          subjectId: listing.id,
          oneAtATime: false,
          preselected: candidates.length === 1,
          canApprove: listing.canManage,
          step: { type: "mark_let", listingId: listing.id, expectedUpdatedAt: listing.updatedAt },
        });
      }
      return finish(change.kind, candidates.length > 1 ? "Which listing has been let?" : "Mark as let", items, "You have no published rentals to mark as let.");
    }

    case "change_price": {
      const candidates = input.listings.filter((listing) => listing.status !== "archived" && onListing(listing.id));
      for (const listing of candidates) {
        const sale = listing.kind === "sale";
        const from = sale ? listing.salePrice ?? listing.price : listing.price;
        if (!from || from <= 0) continue;
        const to = change.percent !== undefined ? roundPrice(from * (1 + change.percent / 100), sale) : change.amount!;
        if (to === from) continue;
        items.push({
          id: `price:${listing.id}:${to}`,
          label: listing.title,
          detail: `${rand(from)} → ${rand(to)}${sale ? "" : " a month"}`,
          subjectId: listing.id,
          oneAtATime: false,
          // A fixed amount only makes sense for one listing, so the lister picks which.
          preselected: change.percent !== undefined || candidates.length === 1,
          canApprove: listing.canManage,
          step: { type: "change_price", listingId: listing.id, expectedUpdatedAt: listing.updatedAt, from, to, sale },
        });
      }
      const title = change.percent !== undefined ? `${change.percent > 0 ? "Raise" : "Lower"} prices by ${Math.abs(change.percent)}%` : `Change the price to ${rand(change.amount!)}`;
      return finish(change.kind, title, items, "No listing has a price to change.");
    }
  }
}

function finish(kind: ChangeKind, title: string, items: ChangeItem[], empty: string): ChangePreview {
  return {
    kind,
    title,
    items,
    empty: items.length ? null : empty,
    approveNote: items.length && !items.some((item) => item.canApprove) ? NEEDS_OWNER_OR_ADMIN : null,
  };
}

export type Selection = { ok: true; items: ChangeItem[] } | { ok: false; reason: string };

/** The items Approve may run: found again in a fresh preview, approvable, and one person at a time. */
export function selectForApproval(preview: ChangePreview, itemIds: readonly string[]): Selection {
  const unique = [...new Set(itemIds)];
  if (!unique.length) return { ok: false, reason: "Choose what to approve." };
  const byId = new Map(preview.items.map((item) => [item.id, item]));
  const items = unique.map((id) => byId.get(id));
  if (items.some((item) => !item)) return { ok: false, reason: "Something changed since the preview. Check it again." };
  const found = items as ChangeItem[];
  if (found.some((item) => !item.canApprove)) return { ok: false, reason: NEEDS_OWNER_OR_ADMIN };
  if (found.length > 1 && found.some((item) => item.oneAtATime)) return { ok: false, reason: "Decisions about a person are approved one at a time." };
  return { ok: true, items: found };
}

/** What the approvals log records for a step. Listing-wide changes are not about a person. */
export function loggedAction(step: ChangeStep): string | null {
  switch (step.type) {
    case "accept_showing":
      return "viewing_accepted";
    case "decline_showing":
      return "viewing_declined";
    case "application_status":
      return `application_${step.to}`;
    case "accept_booking":
      return "booking_accepted";
    case "archive_person":
      return "archived";
    default:
      return null;
  }
}
