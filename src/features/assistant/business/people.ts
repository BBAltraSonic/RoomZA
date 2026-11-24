/**
 * Everyone who showed interest, in one list (proposal, "What needs building first" and
 * capabilities 1 and 2). Built only from what people did (enquired, who sent the last message,
 * asked for or had a viewing, applied, booked), never from what they wrote. Ranking uses
 * visible reasons, not a hidden score. Plain rules, no AI.
 */

export const STAGES = ["applied", "viewing-booked", "ready-to-apply", "just-enquired", "gone-quiet", "closed"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  applied: "Applied",
  "viewing-booked": "Viewing booked",
  "ready-to-apply": "Ready to apply",
  "just-enquired": "Just enquired",
  "gone-quiet": "Gone quiet",
  closed: "Closed",
};

export type NextAction = "reply" | "viewing-request" | "review-application" | "booking-request" | "follow-up";

export type PersonRefs = {
  conversationId?: string;
  showingRequestId?: string;
  applicationId?: string;
  bookingId?: string;
  buyerInterestId?: string;
};

export type Person = {
  /** `customerId:listingOrServiceId`. One card per person per listing. */
  key: string;
  customerId: string;
  name: string;
  subjectId: string;
  subjectTitle: string;
  subjectKind: "rent" | "sale" | "service";
  stage: Stage;
  waitingOnYou: boolean;
  reasons: string[];
  next: NextAction[];
  lastActivityAt: string;
  firstSeenAt: string;
  price: number | null;
  refs: PersonRefs;
  lastAction: { label: string; actorName: string; at: string } | null;
  timeline: { at: string; label: string }[];
};

export type PeopleInput = {
  now: Date;
  listings: { id: string; title: string; price: number | null; availabilityDate: string | null; kind: "rent" | "sale" }[];
  services: { id: string; title: string }[];
  conversations: { id: string; listingId: string; customerId: string; createdAt: string; lastMessageAt: string | null; lastSenderIsCustomer: boolean | null }[];
  showings: { id: string; listingId: string; customerId: string; status: string; requestedAt: string; scheduledFor: string | null; expiresAt: string; respondedAt: string | null; completedAt: string | null }[];
  applications: { id: string; listingId: string; customerId: string; status: string; moveInDate: string | null; createdAt: string; updatedAt: string }[];
  bookings: { id: string; serviceId: string; customerId: string; customerName: string | null; status: string; slotStart: string; createdAt: string }[];
  buyerInterests: { id: string; listingId: string; customerId: string; status: string; viewingDate: string | null; createdAt: string; updatedAt: string }[];
  profiles: { id: string; name: string | null; verified: boolean }[];
  /** Assistant approvals log, newest first or in any order. */
  actions: { subjectKey: string; action: string; actorName: string; createdAt: string }[];
};

const QUIET_AFTER_MS = 7 * 86_400_000;
const MOVE_IN_SLACK_MS = 14 * 86_400_000;

export const ACTION_LABELS: Record<string, string> = {
  viewing_accepted: "Viewing accepted",
  viewing_declined: "Viewing declined",
  application_under_review: "Application moved to review",
  application_shortlisted: "Application shortlisted",
  application_approved: "Application approved",
  application_rejected: "Application rejected",
  booking_accepted: "Booking confirmed",
  booking_declined: "Booking declined",
  archived: "Archived",
  unarchived: "Brought back",
};

type Draft = Omit<Person, "stage" | "waitingOnYou" | "reasons" | "next" | "lastAction"> & {
  signals: {
    applicationStatus?: string;
    moveInDate?: string | null;
    showingStatus?: string;
    showingUpcoming?: boolean;
    showingAwaitingAnswer?: boolean;
    viewed?: boolean;
    bookingStatus?: string;
    interestStatus?: string;
    lastSenderIsCustomer?: boolean | null;
  };
};

function later(a: string, b: string) {
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

function earlier(a: string, b: string) {
  return Date.parse(a) <= Date.parse(b) ? a : b;
}

const OPEN_APPLICATION = new Set(["submitted", "under_review", "shortlisted", "approved"]);
const CLOSED_APPLICATION = new Set(["rejected", "withdrawn"]);

export function buildPeople(input: PeopleInput): Person[] {
  const listings = new Map(input.listings.map((listing) => [listing.id, listing]));
  const services = new Map(input.services.map((service) => [service.id, service]));
  const profiles = new Map(input.profiles.map((profile) => [profile.id, profile]));
  const drafts = new Map<string, Draft>();
  const now = input.now.getTime();

  function draft(customerId: string, subjectId: string, at: string, fallbackName?: string | null): Draft | null {
    const key = `${customerId}:${subjectId}`;
    const existing = drafts.get(key);
    if (existing) {
      existing.lastActivityAt = later(existing.lastActivityAt, at);
      existing.firstSeenAt = earlier(existing.firstSeenAt, at);
      return existing;
    }
    const listing = listings.get(subjectId);
    const service = services.get(subjectId);
    if (!listing && !service) return null;
    const created: Draft = {
      key,
      customerId,
      name: profiles.get(customerId)?.name?.trim() || fallbackName?.trim() || "Someone",
      subjectId,
      subjectTitle: listing?.title ?? service!.title,
      subjectKind: listing ? listing.kind : "service",
      lastActivityAt: at,
      firstSeenAt: at,
      price: listing?.price ?? null,
      refs: {},
      timeline: [],
      signals: {},
    };
    drafts.set(key, created);
    return created;
  }

  for (const conversation of input.conversations) {
    const at = conversation.lastMessageAt ?? conversation.createdAt;
    const person = draft(conversation.customerId, conversation.listingId, at);
    if (!person) continue;
    person.firstSeenAt = earlier(person.firstSeenAt, conversation.createdAt);
    person.refs.conversationId = conversation.id;
    person.signals.lastSenderIsCustomer = conversation.lastSenderIsCustomer;
    person.timeline.push({ at: conversation.createdAt, label: "Enquired" });
    if (conversation.lastMessageAt) {
      person.timeline.push({ at: conversation.lastMessageAt, label: conversation.lastSenderIsCustomer ? "Sent the last message" : "You sent the last message" });
    }
  }

  for (const showing of input.showings) {
    const at = showing.completedAt ?? showing.respondedAt ?? showing.requestedAt;
    const person = draft(showing.customerId, showing.listingId, at);
    if (!person) continue;
    const when = showing.scheduledFor ?? showing.expiresAt;
    const upcoming = Date.parse(when) > now;
    const awaiting = showing.status === "requested" && Date.parse(showing.expiresAt) > now;
    // Keep the most telling viewing: one waiting for an answer, then an upcoming one, then a completed one.
    if (awaiting || (upcoming && !person.signals.showingAwaitingAnswer) || !person.refs.showingRequestId) {
      person.refs.showingRequestId = showing.id;
      person.signals.showingStatus = showing.status;
      person.signals.showingUpcoming = upcoming && ["requested", "accepted", "checked_in"].includes(showing.status);
      person.signals.showingAwaitingAnswer = awaiting;
    }
    if (showing.status === "completed") person.signals.viewed = true;
    person.timeline.push({ at: showing.requestedAt, label: "Asked for a viewing" });
    if (showing.completedAt) person.timeline.push({ at: showing.completedAt, label: "Viewed" });
  }

  for (const application of input.applications) {
    const person = draft(application.customerId, application.listingId, application.updatedAt);
    if (!person) continue;
    person.firstSeenAt = earlier(person.firstSeenAt, application.createdAt);
    person.refs.applicationId = application.id;
    person.signals.applicationStatus = application.status;
    person.signals.moveInDate = application.moveInDate;
    person.timeline.push({ at: application.createdAt, label: "Applied" });
  }

  for (const booking of input.bookings) {
    const person = draft(booking.customerId, booking.serviceId, booking.createdAt, booking.customerName);
    if (!person) continue;
    person.refs.bookingId = booking.id;
    person.signals.bookingStatus = booking.status;
    person.signals.showingUpcoming = ["requested", "accepted"].includes(booking.status) && Date.parse(booking.slotStart) > now;
    person.timeline.push({ at: booking.createdAt, label: "Asked to book" });
  }

  for (const interest of input.buyerInterests) {
    const person = draft(interest.customerId, interest.listingId, interest.updatedAt);
    if (!person) continue;
    person.firstSeenAt = earlier(person.firstSeenAt, interest.createdAt);
    person.refs.buyerInterestId = interest.id;
    person.signals.interestStatus = interest.status;
    if (interest.viewingDate && Date.parse(interest.viewingDate) > now) person.signals.showingUpcoming = true;
    person.timeline.push({ at: interest.createdAt, label: "Showed interest in buying" });
  }

  const latestAction = new Map<string, PeopleInput["actions"][number]>();
  for (const action of input.actions) {
    const existing = latestAction.get(action.subjectKey);
    if (!existing || Date.parse(action.createdAt) > Date.parse(existing.createdAt)) latestAction.set(action.subjectKey, action);
  }

  const people: Person[] = [];
  for (const person of drafts.values()) {
    const action = latestAction.get(person.key);
    if (action?.action === "archived") continue;
    const { signals } = person;
    const next: NextAction[] = [];
    if (signals.lastSenderIsCustomer) next.push("reply");
    if (signals.showingAwaitingAnswer) next.push("viewing-request");
    if (signals.applicationStatus === "submitted" || signals.applicationStatus === "under_review") next.push("review-application");
    if (signals.bookingStatus === "requested") next.push("booking-request");

    const quietFor = now - Date.parse(person.lastActivityAt);
    let stage: Stage;
    if (CLOSED_APPLICATION.has(signals.applicationStatus ?? "") || signals.interestStatus === "declined" || signals.bookingStatus === "declined" || signals.bookingStatus === "cancelled") stage = "closed";
    else if (OPEN_APPLICATION.has(signals.applicationStatus ?? "") || signals.interestStatus === "accepted" || signals.interestStatus === "negotiating") stage = "applied";
    else if (signals.showingUpcoming || signals.showingAwaitingAnswer) stage = "viewing-booked";
    else if (signals.viewed && person.subjectKind !== "service") stage = "ready-to-apply";
    else if (quietFor > QUIET_AFTER_MS) stage = "gone-quiet";
    else stage = "just-enquired";
    if ((stage === "ready-to-apply" || stage === "gone-quiet") && !next.length) next.push("follow-up");

    const reasons: string[] = [];
    if (stage === "applied") reasons.push(person.subjectKind === "sale" ? "Offer in progress" : "Applied");
    if (signals.showingUpcoming || signals.showingAwaitingAnswer) reasons.push(person.subjectKind === "service" ? "Booking requested" : "Viewing booked");
    if (signals.viewed) reasons.push("Viewed");
    const listing = listings.get(person.subjectId);
    if (signals.moveInDate && listing?.availabilityDate) {
      const gap = Date.parse(signals.moveInDate) - Date.parse(listing.availabilityDate);
      if (Number.isFinite(gap) && gap >= -MOVE_IN_SLACK_MS / 2 && gap <= MOVE_IN_SLACK_MS) reasons.push("Move-in date fits");
    }
    if (profiles.get(person.customerId)?.verified) reasons.push("Verified");
    if (stage === "gone-quiet") reasons.push(`Quiet for ${Math.floor(quietFor / 86_400_000)} days`);

    people.push({
      key: person.key,
      customerId: person.customerId,
      name: person.name,
      subjectId: person.subjectId,
      subjectTitle: person.subjectTitle,
      subjectKind: person.subjectKind,
      lastActivityAt: person.lastActivityAt,
      firstSeenAt: person.firstSeenAt,
      price: person.price,
      refs: person.refs,
      timeline: [...person.timeline].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)),
      stage,
      waitingOnYou: next.some((item) => item !== "follow-up"),
      reasons,
      next,
      lastAction: action ? { label: ACTION_LABELS[action.action] ?? action.action, actorName: action.actorName, at: action.createdAt } : null,
    });
  }

  return people.sort((a, b) =>
    STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage)
    || Number(b.waitingOnYou) - Number(a.waitingOnYou)
    || b.reasons.length - a.reasons.length
    || Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt),
  );
}

export type PeopleFilters = {
  stage?: Stage;
  waitingOnYou?: boolean;
  maxPrice?: number;
  minPrice?: number;
  subjectId?: string;
  since?: "today" | "week" | "month";
  includeClosed?: boolean;
};

const SINCE_MS = { today: 86_400_000, week: 7 * 86_400_000, month: 30 * 86_400_000 } as const;

export function filterPeople(people: readonly Person[], filters: PeopleFilters, now: Date): Person[] {
  return people.filter((person) => {
    if (!filters.includeClosed && filters.stage !== "closed" && person.stage === "closed") return false;
    if (filters.stage && person.stage !== filters.stage) return false;
    if (filters.waitingOnYou && !person.waitingOnYou) return false;
    if (filters.subjectId && person.subjectId !== filters.subjectId) return false;
    if (filters.maxPrice !== undefined && (person.price === null || person.price > filters.maxPrice)) return false;
    if (filters.minPrice !== undefined && (person.price === null || person.price < filters.minPrice)) return false;
    if (filters.since && now.getTime() - Date.parse(person.lastActivityAt) > SINCE_MS[filters.since]) return false;
    return true;
  });
}

export function groupPeople(people: readonly Person[]): { stage: Stage; label: string; people: Person[] }[] {
  return STAGES.flatMap((stage) => {
    const inStage = people.filter((person) => person.stage === stage);
    return inStage.length ? [{ stage, label: STAGE_LABELS[stage], people: inStage }] : [];
  });
}
