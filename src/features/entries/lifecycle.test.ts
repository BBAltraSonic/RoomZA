import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ poster: vi.fn(), reviewer: vi.fn(), proof: vi.fn() }));
vi.mock("./access", async (importOriginal) => ({ ...await importOriginal<typeof import("./access")>(),
  requireEntryPoster: mocks.poster, requireEntryReviewer: mocks.reviewer, requireEntryPublicationEvidence: mocks.proof }));
import { createEntry, saveEntryDraft, submitEntry, reviewEntry, withdrawEntry, readConfirmedEntry, EntryConflictError } from "./lifecycle";
import type { EntryRecord } from "./lifecycle";

const entryId = "11111111-1111-4111-8111-111111111111", posterId = "22222222-2222-4222-8222-222222222222";
const reviewerId = "33333333-3333-4333-8333-333333333333", revisionId = "44444444-4444-4444-8444-444444444444";
const secondRevisionId = "55555555-5555-4555-8555-555555555555", areaId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const before = Date.parse("2026-10-04T06:00:00Z"), starts = Date.parse("2026-10-04T08:00:00Z"), ends = Date.parse("2026-10-04T10:00:00Z");
const content = { mediaIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab"], mediaRightsConfirmed: true, title: "Synthetic venue experience", description: "Synthetic content", venueName: "Synthetic venue", areaId,
  address: "Synthetic address", latitude: -33.9, longitude: 18.4, startsAt: "2026-10-04T10:00:00+02:00", endsAt: "2026-10-04T12:00:00+02:00" };
async function pending(category: "tourism" | "event" = "tourism") {
  const created = await createEntry(entryId, category), draft = await saveEntryDraft(created, 1, content);
  return await submitEntry(draft, draft.version, revisionId);
}
async function approved(category: "tourism" | "event" = "tourism") {
  const entry = await pending(category); return await reviewEntry(entry, entry.version, revisionId, "approve");
}
describe("server-only Tourism/Event revision lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(before); mocks.poster.mockReset().mockResolvedValue(posterId);
    mocks.reviewer.mockReset().mockResolvedValue(reviewerId);
    mocks.proof.mockReset().mockImplementation(async (category, target, revision) => Object.freeze({ category, entryId: target, revisionId: revision,
      areaId, placeReviewId: posterId, authorityReviewId: reviewerId, mediaState: "none" }));
  });
  afterEach(() => { vi.useRealTimers(); });
  it.each(["tourism", "event"] as const)("creates an owned %s draft and requires a category capability", async category => {
    const entry = await createEntry(entryId, category);
    expect(entry).toMatchObject({ category, posterId, version: 1, draft: {} });
    expect(mocks.poster).toHaveBeenCalledWith(category); expect(readConfirmedEntry(entry)).toEqual({ state: "unavailable" });
  });
  it("rejects inactive/unauthorized enrollment, including a shopping-only account", async () => {
    mocks.poster.mockRejectedValue(new Error("Category poster access required"));
    await expect(createEntry(entryId, "event")).rejects.toThrow("Category poster");
  });
  it("rejects incomplete submissions and caller capability flags in draft content", async () => {
    const entry = await createEntry(entryId, "tourism");
    await expect(submitEntry(entry, 1, revisionId)).rejects.toThrow();
    await expect(saveEntryDraft(entry, 1, { ...content, canReview: true })).rejects.toThrow();
  });
  it("isolates another poster's save, submit and withdrawal", async () => {
    const entry = await pending(); mocks.poster.mockResolvedValue(reviewerId);
    await expect(saveEntryDraft(entry, entry.version, content)).rejects.toThrow("owner");
    await expect(submitEntry(entry, entry.version, secondRevisionId)).rejects.toThrow("owner");
    await expect(withdrawEntry(entry, entry.version)).rejects.toThrow("owner");
  });
  it("rechecks an existing owner's capability after revocation", async () => {
    const entry = await pending(); mocks.poster.mockRejectedValue(new Error("Category enrollment revoked"));
    await expect(saveEntryDraft(entry, entry.version, content)).rejects.toThrow("revoked");
  });
  it("returns a PT409 domain conflict for stale save/submit/withdraw and never mutates the input", async () => {
    const entry = await pending(), original = JSON.stringify(entry);
    for (const call of [saveEntryDraft(entry, 1, content), submitEntry(entry, 1, secondRevisionId), withdrawEntry(entry, 1)]) {
      await expect(call).rejects.toBeInstanceOf(EntryConflictError);
    }
    expect(JSON.stringify(entry)).toBe(original); expect(new EntryConflictError().code).toBe("PT409");
  });
  it("requires actual admin authorization and rejects a stale reviewer version", async () => {
    const entry = await pending(); mocks.reviewer.mockRejectedValueOnce(new Error("Admin MFA required"));
    await expect(reviewEntry(entry, entry.version, revisionId, "approve")).rejects.toThrow("MFA");
    expect(mocks.proof).not.toHaveBeenCalled();
    await expect(reviewEntry(entry, 1, revisionId, "reject", "Correction")).rejects.toBeInstanceOf(EntryConflictError);
  });
  it("requires separate persisted venue/authority evidence before approval", async () => {
    const entry = await pending(); mocks.proof.mockRejectedValueOnce(new Error("Authority evidence required"));
    await expect(reviewEntry(entry, entry.version, revisionId, "approve")).rejects.toThrow("Authority");
    expect(entry.pendingRevisionId).toBe(revisionId); expect(entry.reviews).toHaveLength(0);
    mocks.proof.mockResolvedValueOnce({ areaId: reviewerId });
    await expect(reviewEntry(entry, entry.version, revisionId, "approve")).rejects.toThrow("place evidence mismatch");
  });
  it("freezes snapshots/reviews and private later edits cannot change confirmed content", async () => {
    const input = { ...content }, base = await createEntry(entryId, "tourism"), draft = await saveEntryDraft(base, 1, input);
    input.title = "Mutated source";
    const submitted = await submitEntry(draft, 2, revisionId), confirmed = await reviewEntry(submitted, 3, revisionId, "approve");
    const edited = await saveEntryDraft(confirmed, 4, { ...content, title: "Private edit" });
    const visible = readConfirmedEntry(edited, starts);
    expect(visible).toMatchObject({ state: "available", entry: { content: { title: content.title } } });
    expect(Object.isFrozen(submitted)).toBe(true); expect(Object.isFrozen(submitted.revisions)).toBe(true);
    const revision = submitted.revisions[0]; if (!revision) throw new Error("Missing fixture revision");
    expect(Object.isFrozen(revision)).toBe(true); expect(Object.isFrozen(revision.content)).toBe(true);
    expect(Object.isFrozen(confirmed.reviews[0])).toBe(true); expect(submitted.reviews).toHaveLength(0);
  });
  it("hides submitted material edits and rejection never restores the previous approval", async () => {
    const confirmed = await approved(), draft = await saveEntryDraft(confirmed, confirmed.version, { ...content, title: "New material edit" });
    const submitted = await submitEntry(draft, draft.version, secondRevisionId);
    expect(readConfirmedEntry(submitted, starts)).toEqual({ state: "awaiting_review" });
    const rejected = await reviewEntry(submitted, submitted.version, secondRevisionId, "reject", "Check venue permission");
    expect(readConfirmedEntry(rejected, starts)).toEqual({ state: "unavailable" });
    expect(rejected.revisions).toHaveLength(2); expect(rejected.reviews).toHaveLength(2);
    expect(confirmed.approvedRevisionId).toBe(revisionId); expect(confirmed.reviews).toHaveLength(1);
  });
  it("requires correction reasons and prevents duplicate/premature reviews", async () => {
    const entry = await pending(); await expect(reviewEntry(entry, entry.version, revisionId, "reject", " ")).rejects.toThrow();
    vi.setSystemTime(before - 1); await expect(reviewEntry(entry, entry.version, revisionId, "approve")).rejects.toThrow("predates");
    vi.setSystemTime(before); const rejected = await reviewEntry(entry, entry.version, revisionId, "reject", "Correct the venue");
    await expect(reviewEntry(rejected, rejected.version, revisionId, "approve")).rejects.toThrow("not awaiting review");
  });
  it("withdraws without mutating history and a delayed approval cannot resurrect the entry", async () => {
    const entry = await pending(), withdrawn = await withdrawEntry(entry, entry.version);
    expect(withdrawn.pendingRevisionId).toBeNull(); expect(withdrawn.revisions).toEqual(entry.revisions);
    expect(readConfirmedEntry(withdrawn, starts)).toEqual({ state: "withdrawn" });
    await expect(reviewEntry(withdrawn, withdrawn.version, revisionId, "approve")).rejects.toThrow("not awaiting review");
    await expect(reviewEntry(withdrawn, entry.version, revisionId, "approve")).rejects.toBeInstanceOf(EntryConflictError);
  });
  it("a renewal/new submission after withdrawal needs a fresh revision and review", async () => {
    const confirmed = await approved(), withdrawn = await withdrawEntry(confirmed, confirmed.version);
    const draft = await saveEntryDraft(withdrawn, withdrawn.version, content);
    await expect(submitEntry(draft, draft.version, revisionId)).rejects.toThrow("already used");
    const submitted = await submitEntry(draft, draft.version, secondRevisionId);
    expect(submitted.withdrawnAt).toBeNull(); expect(readConfirmedEntry(submitted, starts)).toEqual({ state: "awaiting_review" });
    expect(readConfirmedEntry(await reviewEntry(submitted, submitted.version, secondRevisionId, "approve"), starts).state).toBe("available");
  });
  it.each(["tourism", "event"] as const)("retains scheduled %s content and uses exact temporal boundaries", async category => {
    const entry = await approved(category);
    expect(readConfirmedEntry(entry, starts - 1)).toMatchObject({ state: "scheduled", entry: { category } });
    expect(readConfirmedEntry(entry, starts).state).toBe("available");
    expect(readConfirmedEntry(entry, ends - 1).state).toBe("available");
    expect(readConfirmedEntry(entry, ends)).toEqual({ state: "ended" });
    expect(readConfirmedEntry(entry, NaN)).toEqual({ state: "unavailable" });
  });
  it("rejects expired approval and fails closed on missing proof or future confirmation", async () => {
    const entry = await pending(); vi.setSystemTime(ends);
    await expect(reviewEntry(entry, entry.version, revisionId, "approve")).rejects.toThrow("future");
    vi.setSystemTime(before); const confirmed = await approved();
    const review = confirmed.reviews[0]; if (!review) throw new Error("Missing fixture review");
    const noProof = { ...confirmed, reviews: [{ ...review, evidence: null }] } satisfies EntryRecord;
    expect(readConfirmedEntry(noProof, starts)).toEqual({ state: "unavailable" });
    const future = { ...confirmed, reviews: [{ ...review, reviewedAt: "2026-10-04T09:00:00Z" }] };
    expect(readConfirmedEntry(future, starts)).toEqual({ state: "unavailable" });
    const visible = readConfirmedEntry(confirmed, starts);
    expect(JSON.stringify(visible)).not.toContain("reviewerId"); expect(JSON.stringify(visible)).not.toContain("authorityReviewId");
  });
});
