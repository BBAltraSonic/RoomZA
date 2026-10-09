import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EntryIntakeCommand, EntryCorrectionInput } from "./intake-contract";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(), requireAdmin: vi.fn(), rpc: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/features/admin/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: mocks.rpc, from: mocks.from }) }));
import { enrollEntryPoster, writeEntryIntake, readOwnedEntryDraft, readEntrySubmissionForReview, rejectEntrySubmission } from "./intake";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const entryId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const revisionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const stamp = "2035-10-03T06:30:00.000Z";
const enrollment = { userId, category: "tourism", enrolledAt: stamp, revokedAt: null };
const result = { entryId, category: "tourism", version: 2, pendingRevisionId: null };
const target = { category: "tourism" as const, entryId, expectedVersion: 1 };
const save = { ...target, command: "save" as const, draft: { title: " Private experience " } };
const row = { id: entryId, category: "tourism", poster_id: userId, draft: { title: "Private" }, version: 2,
  pending_revision_id: null, withdrawn_at: null, updated_at: stamp };

describe("cookie-scoped private entry adapters", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireUser.mockResolvedValue({ user: { id: userId, email_confirmed_at: stamp, is_anonymous: false } });
    mocks.rpc.mockResolvedValue({ data: result, error: null });
    const query = { select: mocks.select, eq: mocks.eq, maybeSingle: mocks.maybeSingle };
    mocks.from.mockReturnValue(query); mocks.select.mockReturnValue(query); mocks.eq.mockReturnValue(query);
    mocks.maybeSingle.mockResolvedValue({ data: row, error: null });
  });

  it("enrolls the real session in one category without caller identity or capabilities", async () => {
    mocks.rpc.mockResolvedValue({ data: enrollment, error: null });
    expect(await enrollEntryPoster("tourism")).toEqual(enrollment);
    expect(mocks.rpc).toHaveBeenCalledWith("pinpoint_entry_enroll", { category: "tourism" });
  });
  it.each([
    { ...enrollment, userId: entryId }, { ...enrollment, category: "event" }, { ...enrollment, revokedAt: stamp },
  ])("fails closed for another identity/category or revoked enrollment %j", async data => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(enrollEntryPoster("tourism")).rejects.toThrow();
  });
  it.each([
    { id: userId, email_confirmed_at: null, is_anonymous: false },
    { id: userId, email_confirmed_at: stamp, is_anonymous: true },
  ])("stops enrollment and writes for unconfirmed/non-permanent session %j", async user => {
    mocks.requireUser.mockResolvedValue({ user });
    await expect(enrollEntryPoster("tourism")).rejects.toThrow("Confirmed poster");
    await expect(writeEntryIntake(save)).rejects.toThrow("Confirmed poster");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("stops reads and writes when the current account guard rejects suspension/policy/session", async () => {
    mocks.requireUser.mockRejectedValue(new Error("Current account denied"));
    await expect(writeEntryIntake(save)).rejects.toThrow("Current account denied");
    await expect(readOwnedEntryDraft("tourism", entryId)).rejects.toThrow("Current account denied");
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled();
  });
  it("sends only the normalized private draft, category and expected version", async () => {
    expect(await writeEntryIntake(save)).toEqual(result);
    expect(mocks.rpc).toHaveBeenCalledWith("pinpoint_entry_write", {
      command: "save", category: "tourism", target: entryId, expected_version: 1, payload: { title: "Private experience" },
    });
  });
  it.each([
    { ...save, actorId: userId }, { ...save, canPost: true }, { ...save, draft: { canReview: true } },
    { ...target, command: "approve" }, { ...target, command: "submit", revisionId, draft: { title: "Injected snapshot" } },
    { ...target, command: "withdraw", revisionId }, { ...save, expectedVersion: 0 }, { ...save, expectedVersion: 2_147_483_647 },
  ])("rejects forged/unused arguments and unsupported commands before RPC %j", async input => {
    await expect(writeEntryIntake(input as unknown as EntryIntakeCommand)).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("creates a fresh draft with version zero and requires a version-one acknowledgment", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...result, version: 1 }, error: null });
    await writeEntryIntake({ category: "tourism", entryId, command: "create", expectedVersion: 0 });
    expect(mocks.rpc).toHaveBeenCalledWith("pinpoint_entry_write", {
      command: "create", category: "tourism", target: entryId, expected_version: 0, payload: {},
    });
  });
  it("submits only the stored draft command and binds the acknowledgment to its revision", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...result, pendingRevisionId: revisionId }, error: null });
    await writeEntryIntake({ ...target, command: "submit", revisionId });
    expect(mocks.rpc).toHaveBeenCalledWith("pinpoint_entry_write", {
      command: "submit", category: "tourism", target: entryId, expected_version: 1, payload: {}, revision: revisionId,
    });
    mocks.rpc.mockResolvedValue({ data: result, error: null });
    await expect(writeEntryIntake({ ...target, command: "submit", revisionId })).rejects.toThrow("response mismatch");
  });
  it.each([1, 2])("accepts version-checked withdrawal or its current-version idempotent result %i", async version => {
    mocks.rpc.mockResolvedValue({ data: { ...result, version }, error: null });
    expect((await writeEntryIntake({ ...target, command: "withdraw" })).version).toBe(version);
  });
  it("retains the actual PT409 error and performs no retry or draft reload", async () => {
    const conflict = { code: "PT409", message: "Entry version conflict" };
    mocks.rpc.mockResolvedValue({ data: null, error: conflict });
    await expect(writeEntryIntake(save)).rejects.toBe(conflict);
    expect(mocks.rpc).toHaveBeenCalledOnce(); expect(mocks.from).not.toHaveBeenCalled();
  });
  it.each([
    { ...result, entryId: userId }, { ...result, category: "event" }, { ...result, version: 1 },
    { ...result, version: 4 }, { ...result, actorId: userId }, { ...result, version: -1 },
  ])("rejects malformed or unrelated mutation acknowledgments %j", async data => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(writeEntryIntake(save)).rejects.toThrow();
  });
  it("reads with exact owner/category/id filters and returns a minimal private DTO", async () => {
    const draft = await readOwnedEntryDraft("tourism", entryId);
    expect(mocks.from).toHaveBeenCalledWith("pinpoint_entries");
    expect(mocks.eq.mock.calls).toEqual([["poster_id", userId], ["category", "tourism"], ["id", entryId]]);
    expect(draft).toEqual({ id: entryId, category: "tourism", draft: { title: "Private" }, version: 2,
      pendingRevisionId: null, withdrawnAt: null, updatedAt: stamp });
    expect(draft).not.toHaveProperty("poster_id"); expect(Object.isFrozen(draft?.draft)).toBe(true);
  });
  it("treats RLS-hidden or missing owner rows as null", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await readOwnedEntryDraft("tourism", entryId)).toBeNull();
  });
  it.each([
    { ...row, id: userId }, { ...row, category: "event" }, { ...row, poster_id: entryId },
    { ...row, draft: { title: "Private", approved: true } }, { ...row, updated_at: "invalid" },
  ])("fails closed on mismatched/malformed owner rows %j", async data => {
    mocks.maybeSingle.mockResolvedValue({ data, error: null });
    await expect(readOwnedEntryDraft("tourism", entryId)).rejects.toThrow();
  });
  it("propagates read errors without treating denied data as an empty draft", async () => {
    const error = { code: "42501", message: "Denied" };
    mocks.maybeSingle.mockResolvedValue({ data: null, error });
    await expect(readOwnedEntryDraft("tourism", entryId)).rejects.toBe(error);
  });
  it("requires real admin/MFA guard before any review read or correction RPC", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("Actual MFA required"));
    await expect(readEntrySubmissionForReview("tourism", entryId)).rejects.toThrow("Actual MFA required");
    await expect(rejectEntrySubmission({ ...target, revisionId, reason: "Correct" })).rejects.toThrow("Actual MFA required");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("returns null when no revision remains pending", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    expect(await readEntrySubmissionForReview("event", entryId)).toBeNull();
    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("pinpoint_entry_review_read", { category: "event", target: entryId });
  });
  const snapshot = { entryId, category: "tourism", version: 3, posterId: userId, revisionId, submittedAt: stamp,
    content: { title: "Submitted", description: "Private snapshot", venueName: "Venue", areaId: userId,
      address: "Address", latitude: -33.96, longitude: 18.47, startsAt: stamp, endsAt: "2035-10-03T08:30:00Z" } };
  it("returns a frozen submitted review snapshot", async () => {
    mocks.rpc.mockResolvedValue({ data: snapshot, error: null });
    const value = await readEntrySubmissionForReview("tourism", entryId);
    expect(value).toEqual(snapshot); expect(Object.isFrozen(value?.content)).toBe(true);
  });
  it.each([{ ...snapshot, entryId: userId }, { ...snapshot, category: "event" }, { ...snapshot, content: { title: "Incomplete" } }])(
    "fails closed on mismatched or malformed reviewer data %j", async data => {
      mocks.rpc.mockResolvedValue({ data, error: null });
      await expect(readEntrySubmissionForReview("tourism", entryId)).rejects.toThrow();
    });
  it("derives reviewer identity from the session and sends only scoped, trimmed correction fields", async () => {
    await rejectEntrySubmission({ ...target, revisionId, reason: " Correct venue " });
    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("pinpoint_entry_reject", {
      category: "tourism", target: entryId, revision: revisionId, expected_version: 1, reason: "Correct venue",
    });
  });
  it.each([{ ...target, revisionId, reason: " " }, { ...target, revisionId, reason: "Correct", reviewerId: userId },
    { ...target, revisionId, reason: "Correct", canReview: true }])("rejects empty correction or forged reviewer arguments %j", async input => {
    await expect(rejectEntrySubmission(input as unknown as EntryCorrectionInput)).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([{ ...result, version: 1 }, { ...result, pendingRevisionId: revisionId }, { ...result, category: "event" },
    { ...result, entryId: userId }])("rejects unrelated/stale correction acknowledgments %j", async data => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(rejectEntrySubmission({ ...target, revisionId, reason: "Correct" })).rejects.toThrow();
  });
  it("retains a genuine correction conflict without retry or history rewrite", async () => {
    const conflict = { code: "PT409", message: "Entry version conflict" };
    mocks.rpc.mockResolvedValue({ data: null, error: conflict });
    await expect(rejectEntrySubmission({ ...target, revisionId, reason: "Correct" })).rejects.toBe(conflict);
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });
});
