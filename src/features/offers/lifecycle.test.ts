import { describe, expect, it } from "vitest";

import {
  createOffer, readPublicOffer, reviewOffer, saveOfferDraft, submitOffer, withdrawOffer,
} from "./lifecycle";
import type { OfferActor, OfferRecord } from "./lifecycle";
import { parseOfferSubmission } from "./schema";

const id = "00000000-0000-4000-8000-000000000001";
const revisionId = "00000000-0000-4000-8000-000000000002";
const revision2 = "00000000-0000-4000-8000-000000000003";
const poster: OfferActor = {
  userId: "00000000-0000-4000-8000-000000000004",
  active: true, canPostOffers: true, canReviewOffers: false,
};
const admin: OfferActor = {
  userId: "00000000-0000-4000-8000-000000000005",
  active: true, canPostOffers: false, canReviewOffers: true,
};
const otherPoster = { ...poster, userId: "00000000-0000-4000-8000-000000000006" };
const before = Date.parse("2026-09-30T08:00:00Z");
const starts = Date.parse("2026-09-30T10:00:00Z");
const ends = Date.parse("2026-10-01T10:00:00Z");
const content = {
  title: "A synthetic shop offer", benefit: "A stated discount", terms: "In store only",
  shopName: "Fixture shop", address: "Fixture address, Cape Town",
  areaId: "00000000-0000-4000-8000-000000000007",
  latitude: -33.9249, longitude: 18.4241,
  startsAt: "2026-09-30T12:00:00+02:00", endsAt: "2026-10-01T12:00:00+02:00",
};

function drafted() {
  return saveOfferDraft(createOffer(id, poster), poster, content);
}
function submitted() {
  return submitOffer(drafted(), poster, revisionId, before);
}
function approved() {
  return reviewOffer(submitted(), admin, revisionId, "approve", before + 1);
}

describe("Shopping Offer publication foundation", () => {
  it("keeps incomplete drafts private and rejects incomplete submission", () => {
    const draft = saveOfferDraft(createOffer(id, poster), poster, { title: "Private draft" });
    expect(readPublicOffer(draft, starts)).toEqual({ state: "unavailable" });
    expect(() => submitOffer(draft, poster, revisionId, before)).toThrow();
  });

  it("normalizes offset timestamps to UTC and trims public fields", () => {
    expect(parseOfferSubmission({ ...content, title: "  Offer  " }, before)).toMatchObject({
      title: "Offer", startsAt: "2026-09-30T10:00:00.000Z", endsAt: "2026-10-01T10:00:00.000Z",
    });
  });

  it.each([
    { terms: " " }, { benefit: "" }, { shopName: "" }, { address: "" },
    { areaId: "neighbourhood.rondebosch" }, { latitude: Infinity }, { longitude: 181 },
    { startsAt: "2026-09-30T12:00:00" }, { endsAt: "not a date" },
    { startsAt: content.endsAt }, { startsAt: "2026-10-02T12:00:00+02:00" },
    { endsAt: "2026-09-30T10:00:00+02:00" }, { adminApproved: true },
  ])("rejects invalid publication fields: %j", (invalid) => {
    expect(() => parseOfferSubmission({ ...content, ...invalid }, before)).toThrow();
  });

  it("copies and freezes the submitted snapshot independently of draft/input edits", () => {
    const input = { ...content };
    const draft = saveOfferDraft(createOffer(id, poster), poster, input);
    input.title = "Changed after saving";
    const pending = submitOffer(draft, poster, revisionId, before);
    const edited = saveOfferDraft(pending, poster, { ...content, title: "Private later edit" });
    const published = reviewOffer(edited, admin, revisionId, "approve", before + 1);
    const visible = readPublicOffer(published, starts);
    expect(Object.isFrozen(pending.revisions[0])).toBe(true);
    expect(Object.isFrozen(pending.revisions[0]?.content)).toBe(true);
    expect(visible.state).toBe("active");
    if (visible.state === "active") expect(visible.offer.content.title).toBe(content.title);
    expect(pending.draft.title).toBe(content.title);
  });

  it("includes the exact start and excludes the exact end with no job/state update", () => {
    const offer = approved();
    expect(readPublicOffer(offer, starts - 1)).toEqual({ state: "scheduled" });
    expect(readPublicOffer(offer, starts).state).toBe("active");
    expect(readPublicOffer(offer, ends - 1).state).toBe("active");
    expect(readPublicOffer(offer, ends)).toEqual({ state: "expired" });
    expect(readPublicOffer(offer, ends + 1)).toEqual({ state: "expired" });
    expect(offer.approvedRevisionId).toBe(revisionId);
  });

  it("publishes only the public snapshot and confirmation date", () => {
    const result = readPublicOffer(approved(), starts);
    expect(result.state).toBe("active");
    if (result.state === "active") {
      expect(Object.keys(result.offer).sort()).toEqual(["confirmedAt", "content", "id", "revisionId"]);
      expect(result.offer.confirmedAt).toBe(new Date(before + 1).toISOString());
      expect(result.offer.content.areaId).toBe(content.areaId);
    }
  });

  it("hides submitted material edits and does not revive the old approval after rejection", () => {
    const live = approved();
    const draft = saveOfferDraft(live, poster, { ...content, terms: "New terms" });
    expect(readPublicOffer(draft, starts).state).toBe("active");
    const pending = submitOffer(draft, poster, revision2, starts);
    expect(readPublicOffer(pending, starts)).toEqual({ state: "awaiting_review" });
    // Late retry of the old decision cannot bypass the newer review.
    expect(readPublicOffer(reviewOffer(pending, admin, revisionId, "approve", starts), starts))
      .toEqual({ state: "awaiting_review" });
    const rejected = reviewOffer(pending, admin, revision2, "reject", starts + 1, "Correct the terms");
    expect(readPublicOffer(rejected, starts + 1)).toEqual({ state: "unavailable" });
    expect(rejected.revisions[0]?.status).toBe("approved");
    expect(rejected.revisions[1]).toMatchObject({
      reviewedBy: admin.userId, correctionReason: "Correct the terms", status: "rejected",
    });
  });

  it("publishes the reviewed material edit and keeps earlier snapshots for history", () => {
    const pending = submitOffer(
      saveOfferDraft(approved(), poster, { ...content, terms: "New confirmed terms" }),
      poster, revision2, starts,
    );
    const changed = reviewOffer(pending, admin, revision2, "approve", starts + 1);
    const visible = readPublicOffer(changed, starts + 1);
    expect(visible.state).toBe("active");
    if (visible.state === "active") {
      expect(visible.offer.revisionId).toBe(revision2);
      expect(visible.offer.content.terms).toBe("New confirmed terms");
    }
    expect(changed.revisions[0]?.content.terms).toBe(content.terms);
  });

  it("withdraws immediately and approval retries do not restore publication", () => {
    const withdrawn = withdrawOffer(approved(), poster, starts);
    expect(readPublicOffer(withdrawn, starts)).toEqual({ state: "withdrawn" });
    const retried = reviewOffer(withdrawn, admin, revisionId, "approve", starts + 1);
    expect(readPublicOffer(retried, starts + 1)).toEqual({ state: "withdrawn" });
    expect(withdrawOffer(withdrawn, poster, starts + 2)).toBe(withdrawn);
    expect(withdrawn.revisions).toHaveLength(1);
  });

  it("cancels a withdrawn pending revision so a delayed admin decision fails", () => {
    const withdrawn = withdrawOffer(submitted(), poster, starts);
    expect(withdrawn.revisions[0]?.status).toBe("cancelled");
    expect(() => reviewOffer(withdrawn, admin, revisionId, "approve", starts + 1)).toThrow();
    expect(() => submitOffer(withdrawn, poster, revisionId, starts + 1)).toThrow();
  });

  it("requires a fresh submitted revision and admin decision for renewal", () => {
    const withdrawn = withdrawOffer(approved(), poster, starts);
    const renewal = submitOffer(saveOfferDraft(withdrawn, poster, {
      ...content, endsAt: "2026-10-02T12:00:00+02:00",
    }), poster, revision2, starts + 1);
    expect(readPublicOffer(renewal, starts + 1)).toEqual({ state: "awaiting_review" });
    expect(readPublicOffer(reviewOffer(renewal, admin, revision2, "approve", starts + 2), starts + 2).state)
      .toBe("active");
  });

  it("deduplicates submission and review retries without taking newer draft content", () => {
    const pending = submitted();
    const changed = saveOfferDraft(pending, poster, { ...content, benefit: "Later private benefit" });
    expect(submitOffer(changed, poster, revisionId, before + 1)).toBe(changed);
    expect(changed.revisions).toHaveLength(1);
    expect(() => submitOffer(changed, poster, revision2, before + 1)).toThrow("already awaiting review");
    const live = reviewOffer(changed, admin, revisionId, "approve", before + 1);
    expect(reviewOffer(live, admin, revisionId, "approve", before + 2)).toBe(live);
    expect(() => submitOffer(live, poster, revisionId, before + 2)).toThrow("ID already used");
    expect(() => reviewOffer(live, admin, revisionId, "reject", before + 2, "Reason")).toThrow();
  });

  it("requires a correction reason and preserves the unreviewed snapshot on failure", () => {
    const pending = submitted();
    expect(() => reviewOffer(pending, admin, revisionId, "reject", before + 1, " ")).toThrow();
    expect(pending.revisions[0]?.status).toBe("submitted");
    expect(() => reviewOffer(pending, admin, revision2, "approve", before + 1)).toThrow();
  });

  it("rejects approval after expiry or before submission", () => {
    expect(() => reviewOffer(submitted(), admin, revisionId, "approve", ends)).toThrow("future");
    expect(() => reviewOffer(submitted(), admin, revisionId, "approve", before - 1)).toThrow("predates");
  });

  it.each([
    ["another poster", otherPoster],
    ["customer without poster capability", { ...poster, canPostOffers: false }],
    ["suspended owner", { ...poster, active: false }],
    ["admin without ownership", admin],
  ] as const)("denies draft changes, submission and withdrawal by %s", (_label, actor) => {
    const offer = drafted();
    expect(() => saveOfferDraft(offer, actor, content)).toThrow("owner access");
    expect(() => submitOffer(offer, actor, revisionId, before)).toThrow("owner access");
    expect(() => withdrawOffer(offer, actor, before)).toThrow("owner access");
  });

  it.each([poster, { ...admin, active: false }, { ...admin, userId: "" }])
    ("denies approval and rejection without an active reviewer", (actor) => {
      expect(() => reviewOffer(submitted(), actor, revisionId, "approve", before + 1)).toThrow("review access");
      expect(() => reviewOffer(submitted(), actor, revisionId, "reject", before + 1, "Reason")).toThrow("review access");
    });

  it("denies new drafts without explicit poster capability", () => {
    expect(() => createOffer(id, { ...poster, canPostOffers: false })).toThrow();
    expect(() => createOffer(id, { ...poster, active: false })).toThrow();
  });

  it("fails closed for a broken approval pointer or missing confirmation provenance", () => {
    const live = approved();
    expect(readPublicOffer({ ...live, approvedRevisionId: revision2 }, starts)).toEqual({ state: "unavailable" });
    for (const change of [{ reviewedBy: null }, { reviewedAt: null }, { reviewedAt: "bad date" }]) {
      const corrupt: OfferRecord = { ...live, revisions: live.revisions.map((item) => ({ ...item, ...change })) };
      expect(readPublicOffer(corrupt, starts)).toEqual({ state: "unavailable" });
    }
    expect(readPublicOffer({ ...submitted(), approvedRevisionId: revisionId }, starts))
      .toEqual({ state: "awaiting_review" });
  });

  it("fails closed for invalid persisted content and clock values", () => {
    const live = approved();
    for (const change of [{ startsAt: content.endsAt }, { latitude: NaN }, { endsAt: "invalid" }]) {
      expect(readPublicOffer({
        ...live, revisions: live.revisions.map((item) => ({ ...item, content: { ...item.content, ...change } })),
      }, starts)).toEqual({ state: "unavailable" });
    }
    expect(readPublicOffer(live, NaN)).toEqual({ state: "unavailable" });
    expect(() => parseOfferSubmission(content, NaN)).toThrow("clock");
    expect(() => submitOffer(drafted(), poster, revisionId, NaN)).toThrow("clock");
  });
});
