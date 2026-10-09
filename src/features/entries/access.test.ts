import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), admin: vi.fn(), rpc: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.user }));
vi.mock("@/features/admin/auth", () => ({ requireAdmin: mocks.admin }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
import { requireEntryPoster, requireEntryReviewer, requireEntryPublicationEvidence } from "./access";

const userId = "11111111-1111-4111-8111-111111111111", other = "22222222-2222-4222-8222-222222222222";
const entryId = "33333333-3333-4333-8333-333333333333", revisionId = "44444444-4444-4444-8444-444444444444";
const poster = { userId, category: "tourism", enrolledAt: "2026-10-03T08:00:00Z", revokedAt: null };
const proof = { entryId, revisionId, category: "tourism", areaId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  placeReviewId: userId, authorityReviewId: other, mediaState: "none" };
describe("server-derived category access and publication evidence", () => {
  beforeEach(() => {
    vi.resetAllMocks(); mocks.user.mockResolvedValue({ user: { id: userId, is_anonymous: false, email_confirmed_at: "2026-10-03T08:00:00Z" } });
    mocks.admin.mockResolvedValue({ user: { id: userId } });
    mocks.client.mockResolvedValue({ rpc: mocks.rpc }); mocks.rpc.mockResolvedValue({ data: poster, error: null });
  });
  it("uses the real session and category RPC without caller identity or role flags", async () => {
    expect(await requireEntryPoster("tourism")).toBe(userId);
    expect(mocks.user).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("pinpoint_entry_poster", { category: "tourism" });
  });
  it.each([{ is_anonymous: true, email_confirmed_at: "confirmed" }, { is_anonymous: false, email_confirmed_at: null }])(
    "rejects non-permanent/unconfirmed accounts before the capability read: %j", async (account) => {
      mocks.user.mockResolvedValue({ user: { id: userId, ...account } });
      await expect(requireEntryPoster("tourism")).rejects.toThrow("Confirmed poster"); expect(mocks.rpc).not.toHaveBeenCalled();
    });
  it("retains existing suspension/policy guard denial", async () => {
    mocks.user.mockRejectedValue(new Error("Suspended or policy required"));
    await expect(requireEntryPoster("tourism")).rejects.toThrow("Suspended"); expect(mocks.client).not.toHaveBeenCalled();
  });
  it.each([{ userId: other }, { category: "event" }, { revokedAt: "2026-10-03T09:00:00Z" }, { canReview: true }])(
    "rejects foreign, wrong-category, revoked or malformed capabilities: %j", async (change) => {
      mocks.rpc.mockResolvedValue({ data: { ...poster, ...change }, error: null });
      await expect(requireEntryPoster("tourism")).rejects.toThrow();
    });
  it("fails closed when the planned RPC is absent or returns no enrollment", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    await expect(requireEntryPoster("tourism")).rejects.toEqual({ code: "PGRST202" });
    mocks.rpc.mockResolvedValue({ data: null, error: null }); await expect(requireEntryPoster("tourism")).rejects.toThrow();
  });
  it("requires the existing current admin/MFA guard", async () => {
    expect(await requireEntryReviewer()).toBe(userId);
    mocks.admin.mockRejectedValue(new Error("Admin MFA required"));
    await expect(requireEntryReviewer()).rejects.toThrow("MFA");
    await expect(requireEntryPublicationEvidence("tourism", entryId, revisionId)).rejects.toThrow("MFA");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("reads revision-bound evidence with cookie credentials after the admin guard", async () => {
    mocks.rpc.mockResolvedValue({ data: proof, error: null });
    const result = await requireEntryPublicationEvidence("tourism", entryId, revisionId);
    expect(result).toEqual(proof); expect(Object.isFrozen(result)).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("pinpoint_entry_publication_evidence", { category: "tourism", target: entryId, revision: revisionId });
  });
  it.each([{ entryId: other }, { revisionId: other }, { category: "event" }, { authorityReviewId: null }, { mediaState: "unchecked" }])(
    "rejects missing or unrelated publication evidence: %j", async (change) => {
      mocks.rpc.mockResolvedValue({ data: { ...proof, ...change }, error: null });
      await expect(requireEntryPublicationEvidence("tourism", entryId, revisionId)).rejects.toThrow();
    });
});
