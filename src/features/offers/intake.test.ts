import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), requireAdmin: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/features/admin/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: mocks.rpc }) }));
import { enrollOfferPoster, readOfferSubmissionForReview, rejectOfferSubmission, writeOfferIntake } from "./intake";

const offerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const revisionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const result = { offerId, version: 2, pendingRevisionId: null };

describe("authenticated offer intake adapters", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.rpc.mockResolvedValue({ data: result, error: null }); });
  it("enrolls with the session RPC without supplying identity or capabilities", async () => {
    mocks.rpc.mockResolvedValue({ data: offerId, error: null });
    expect(await enrollOfferPoster()).toBe(offerId);
    expect(mocks.requireUser).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("pinpoint_offer_enroll", {});
  });
  it("enrolls implicitly before the first draft, using the same target identity", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: offerId, error: null }).mockResolvedValueOnce({ data: { ...result, version: 1 }, error: null });
    await writeOfferIntake({ command: "create", offerId, expectedVersion: 0 });
    expect(mocks.rpc.mock.calls.map(call => call[0])).toEqual(["pinpoint_offer_enroll", "pinpoint_offer_write"]);
  });
  it("does not create a draft after revoked or failed enrollment", async () => {
    const error = { code: "42501", message: "Poster revoked" }; mocks.rpc.mockResolvedValueOnce({ error });
    await expect(writeOfferIntake({ command: "create", offerId, expectedVersion: 0 })).rejects.toBe(error);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("pinpoint_offer_enroll", {});
  });
  it("stops a mutation when the account guard fails", async () => {
    mocks.requireUser.mockRejectedValue(new Error("Suspended"));
    await expect(writeOfferIntake({ command: "create", offerId, expectedVersion: 0 })).rejects.toThrow("Suspended");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("sends only validated draft and concurrency fields", async () => {
    expect(await writeOfferIntake({ command: "save", offerId, expectedVersion: 1, draft: { title: " Shop offer " } })).toEqual(result);
    expect(mocks.rpc).toHaveBeenCalledWith("pinpoint_offer_write", {
      command: "save", target: offerId, expected_version: 1, payload: { title: "Shop offer" },
    });
  });
  it("rejects actor flags in a draft", async () => {
    await expect(writeOfferIntake({ command: "save", offerId, expectedVersion: 1, draft: { canReviewOffers: true } })).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("requires a fresh revision ID for submit", async () => {
    await expect(writeOfferIntake({ command: "submit", offerId, expectedVersion: 2 })).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("passes the stored draft submission command without caller content", async () => {
    await writeOfferIntake({ command: "submit", offerId, expectedVersion: 2, revisionId, draft: { title: "Injected" } });
    expect(mocks.rpc).toHaveBeenCalledWith("pinpoint_offer_write", {
      command: "submit", target: offerId, expected_version: 2, payload: {}, revision: revisionId,
    });
  });
  it("propagates a database version conflict", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("Offer version conflict") });
    await expect(writeOfferIntake({ command: "withdraw", offerId, expectedVersion: 2 })).rejects.toThrow("Offer version conflict");
  });
  it("requires the existing admin MFA guard before review reads", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("MFA required"));
    await expect(readOfferSubmissionForReview(offerId)).rejects.toThrow("MFA required");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("treats a missing pending submission as null", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    expect(await readOfferSubmissionForReview(offerId)).toBeNull();
    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
  });
  it("derives review identity from the session and trims the correction reason", async () => {
    await rejectOfferSubmission({ offerId, revisionId, expectedVersion: 2, reason: " Correct the terms " });
    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("pinpoint_offer_reject", {
      target: offerId, revision: revisionId, expected_version: 2, reason: "Correct the terms",
    });
  });
  it("rejects an empty correction before an RPC", async () => {
    await expect(rejectOfferSubmission({ offerId, revisionId, expectedVersion: 2, reason: " " })).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("fails closed on a malformed mutation response", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...result, version: -1 }, error: null });
    await expect(writeOfferIntake({ command: "create", offerId, expectedVersion: 0 })).rejects.toThrow();
  });
});
