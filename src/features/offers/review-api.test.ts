import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRedirectError } from "next/dist/client/components/redirect";

const mocks = vi.hoisted(() => ({ user: vi.fn(), admin: vi.fn(), reject: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.user }));
vi.mock("@/features/admin/auth", () => ({ requireAdmin: mocks.admin }));
vi.mock("./intake", () => ({ rejectOfferSubmission: mocks.reject }));
import { handleOfferReviewRejection } from "./review-api";

const offerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const body = { offerId, revisionId: offerId, expectedVersion: 3, reason: " Check the shop address " };
const request = (input: unknown, origin = "http://localhost:3110") => new Request("http://localhost:3110/api/private/offers/reject", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(input) });
describe("submitted-offer correction boundary", () => {
  beforeEach(() => vi.resetAllMocks());
  it("denies foreign origins before credentials or RPC", async () => {
    expect((await handleOfferReviewRejection(request(body, "https://other.invalid"))).status).toBe(403);
    expect(mocks.user).not.toHaveBeenCalled(); expect(mocks.reject).not.toHaveBeenCalled();
  });
  it("denies anonymous accounts before admin or RPC checks", async () => {
    mocks.user.mockRejectedValue(getRedirectError("/auth?redirect=%2Fadmin%2Foffers", "replace"));
    expect((await handleOfferReviewRejection(request(body))).status).toBe(401);
    expect(mocks.admin).not.toHaveBeenCalled(); expect(mocks.reject).not.toHaveBeenCalled();
  });
  it("provides the MFA gate without executing rejection", async () => {
    mocks.admin.mockRejectedValue(getRedirectError("/admin/security/mfa/challenge", "replace"));
    const response = await handleOfferReviewRejection(request(body));
    expect(response.status).toBe(403); expect((await response.json()).nextPath).toBe("/admin/security/mfa/challenge");
    expect(mocks.reject).not.toHaveBeenCalled();
  });
  it("accepts only a reason and the captured revision/version, without actor or publication flags", async () => {
    expect((await handleOfferReviewRejection(request({ ...body, approved: true }))).status).toBe(400);
    expect((await handleOfferReviewRejection(request({ ...body, reason: "  " }))).status).toBe(400);
    expect(mocks.reject).not.toHaveBeenCalled();
    mocks.reject.mockResolvedValue({ offerId, version: 4, pendingRevisionId: null });
    const response = await handleOfferReviewRejection(request(body));
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.reject).toHaveBeenCalledWith({ ...body, reason: "Check the shop address" });
  });
  it("never retries version conflicts or exposes internal database messages", async () => {
    for (const [code, status] of [["PT409", 409], ["42501", 403], ["22023", 400], ["XX000", 500]]) {
      mocks.reject.mockRejectedValue({ code, message: "private diagnostic" });
      const response = await handleOfferReviewRejection(request(body));
      expect(response.status).toBe(status); expect(JSON.stringify(await response.json())).not.toContain("private diagnostic");
    }
    expect(mocks.reject).toHaveBeenCalledTimes(4);
  });
});
