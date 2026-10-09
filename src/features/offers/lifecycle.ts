import "server-only";

import { z } from "zod";
import { offerContentSchema, offerDraftSchema, parseOfferSubmission } from "./schema";
import type { OfferContent, OfferDraft } from "./schema";

// Internal domain context, never a request body. Future server actions must
// derive this from authenticated identity, active poster capability and the
// existing admin membership/MFA checks. These rules do not replace DB RLS.
export type OfferActor = Readonly<{
  userId: string;
  active: boolean;
  canPostOffers: boolean;
  canReviewOffers: boolean;
}>;

export type OfferRevision = Readonly<{
  id: string;
  content: OfferContent;
  submittedAt: string;
  status: "submitted" | "approved" | "rejected" | "cancelled";
  reviewedBy: string | null;
  reviewedAt: string | null;
  correctionReason: string | null;
}>;

export type OfferRecord = Readonly<{
  id: string;
  posterId: string;
  draft: OfferDraft;
  revisions: readonly OfferRevision[];
  approvedRevisionId: string | null;
  withdrawnAt: string | null;
}>;

function clock(now: number): string {
  if (!Number.isFinite(now)) throw new Error("Invalid offer clock");
  return new Date(now).toISOString();
}

function requirePoster(offer: OfferRecord, actor: OfferActor) {
  if (!actor.active || !actor.canPostOffers || actor.userId !== offer.posterId) {
    throw new Error("Offer owner access required");
  }
}

function requireReviewer(actor: OfferActor) {
  if (!actor.active || !actor.canReviewOffers || !actor.userId) {
    throw new Error("Offer review access required");
  }
}

function pendingRevision(offer: OfferRecord) {
  return offer.revisions.find((revision) => revision.status === "submitted");
}

export function createOffer(id: string, actor: OfferActor): OfferRecord {
  z.string().uuid().parse(id);
  z.string().uuid().parse(actor.userId);
  if (!actor.active || !actor.canPostOffers) throw new Error("Poster access required");
  return {
    id, posterId: actor.userId, draft: Object.freeze({}), revisions: [],
    approvedRevisionId: null, withdrawnAt: null,
  };
}

// Saving a private draft does not alter the last confirmed snapshot. Submission
// hides that snapshot, per the user's 30 September pending-edit decision.
export function saveOfferDraft(offer: OfferRecord, actor: OfferActor, draft: unknown): OfferRecord {
  requirePoster(offer, actor);
  return { ...offer, draft: Object.freeze(offerDraftSchema.parse(draft)) };
}

export function submitOffer(
  offer: OfferRecord, actor: OfferActor, revisionId: string, now: number,
): OfferRecord {
  requirePoster(offer, actor);
  z.string().uuid().parse(revisionId);
  const previous = offer.revisions.find((revision) => revision.id === revisionId);
  // Retry the same submission without creating a second snapshot. Reusing an
  // already decided/cancelled revision ID can never reopen it.
  if (previous?.status === "submitted") return offer;
  if (previous) throw new Error("Offer revision ID already used");
  if (pendingRevision(offer)) throw new Error("Offer already awaiting review");
  const revision: OfferRevision = Object.freeze({
    id: revisionId,
    content: parseOfferSubmission(offer.draft, now),
    submittedAt: clock(now), status: "submitted",
    reviewedBy: null, reviewedAt: null, correctionReason: null,
  });
  return {
    ...offer, revisions: [...offer.revisions, revision],
    approvedRevisionId: null, withdrawnAt: null,
  };
}

export function reviewOffer(
  offer: OfferRecord, actor: OfferActor, revisionId: string,
  decision: "approve" | "reject", now: number, correctionReason?: string,
): OfferRecord {
  requireReviewer(actor);
  const reviewedAt = clock(now);
  const revision = offer.revisions.find((item) => item.id === revisionId);
  const status = decision === "approve" ? "approved" : "rejected";
  // A lost response can be retried, but cannot undo withdrawal or a newer
  // submission. The adapter must also serialize writes/compare record versions.
  if (revision?.status === status && revision.reviewedBy === actor.userId) return offer;
  if (offer.withdrawnAt || !revision || revision.status !== "submitted") {
    throw new Error("Offer revision is not awaiting review");
  }
  if (now < Date.parse(revision.submittedAt)) throw new Error("Review predates submission");
  const reason = decision === "reject"
    ? z.string().trim().min(1).max(2000).parse(correctionReason)
    : null;
  if (decision === "approve") parseOfferSubmission(revision.content, now);
  const reviewed: OfferRevision = Object.freeze({
    ...revision, status, reviewedBy: actor.userId, reviewedAt, correctionReason: reason,
  });
  return {
    ...offer,
    revisions: offer.revisions.map((item) => item.id === revisionId ? reviewed : item),
    approvedRevisionId: decision === "approve" ? revisionId : null,
  };
}

export function withdrawOffer(offer: OfferRecord, actor: OfferActor, now: number): OfferRecord {
  requirePoster(offer, actor);
  const withdrawnAt = clock(now);
  if (offer.withdrawnAt) return offer;
  return {
    ...offer, approvedRevisionId: null, withdrawnAt,
    // Cancel review in flight so a delayed approval cannot resurrect an offer.
    revisions: offer.revisions.map((revision) => revision.status === "submitted"
      ? Object.freeze({ ...revision, status: "cancelled" as const }) : revision),
  };
}

export type PublicOffer = Readonly<{
  id: string;
  revisionId: string;
  confirmedAt: string;
  content: OfferContent;
}>;

export type OfferVisibility =
  | { state: "active"; offer: PublicOffer }
  | { state: "unavailable" | "awaiting_review" | "withdrawn" | "scheduled" | "expired" };

// One projection for future Feed/Map/count/detail/action adapters. Unavailable
// results carry no private draft, pending snapshot, reviewer ID or rejection
// reason. Re-evaluate from persisted state and a trusted clock on every read.
export function readPublicOffer(offer: OfferRecord, now: number): OfferVisibility {
  if (!Number.isFinite(now)) return { state: "unavailable" };
  if (offer.withdrawnAt) return { state: "withdrawn" };
  if (pendingRevision(offer)) return { state: "awaiting_review" };
  const revision = offer.revisions.find((item) => item.id === offer.approvedRevisionId);
  if (!revision || revision.status !== "approved" || !revision.reviewedBy || !revision.reviewedAt) {
    return { state: "unavailable" };
  }
  const parsed = offerContentSchema.safeParse(revision.content);
  const submittedAt = Date.parse(revision.submittedAt);
  const reviewedAt = Date.parse(revision.reviewedAt);
  if (!parsed.success || !Number.isFinite(submittedAt) || !Number.isFinite(reviewedAt)
    || reviewedAt < submittedAt || reviewedAt > now) return { state: "unavailable" };
  const start = Date.parse(parsed.data.startsAt);
  const end = Date.parse(parsed.data.endsAt);
  if (start >= end) return { state: "unavailable" };
  if (now >= end) return { state: "expired" };
  if (now < start) return { state: "scheduled" };
  return {
    state: "active",
    offer: Object.freeze({
      id: offer.id, revisionId: revision.id, confirmedAt: revision.reviewedAt,
      content: Object.freeze(parsed.data),
    }),
  };
}
