import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRedirectError } from "next/dist/client/components/redirect";

const mocks = vi.hoisted(() => ({ user: vi.fn(), admin: vi.fn(), record: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.user }));
vi.mock("@/features/admin/auth", () => ({ requireAdmin: mocks.admin }));
vi.mock("./decision-data", () => ({ recordOfferDecision: mocks.record }));
import { handleOfferDecision } from "./decision-api";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const input = { command: "approve", offerId: id, revisionId: id, expectedVersion: 3, requestId: id, permissionReviewId: id, locationReviewId: id, approvalConfirmed: true, statementVersion: "admin-offer-approval-v1" };
function request(body: unknown, origin = "http://localhost:3116") {
  return new Request("http://localhost:3116/api/private/offers/decisions", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
beforeEach(() => vi.resetAllMocks());
describe("private approval/unpublication HTTP boundary", () => {
  it("denies cross-origin before Auth and anonymous before revoked RPC", async () => {
    expect((await handleOfferDecision(request(input, "https://elsewhere.invalid"))).status).toBe(403);
    expect(mocks.user).not.toHaveBeenCalled();
    mocks.user.mockRejectedValue(getRedirectError("/auth?redirect=%2Fadmin%2Foffers", "replace"));
    expect((await handleOfferDecision(request(input))).status).toBe(401);
    expect(mocks.record).not.toHaveBeenCalled();
  });
  it("requires captured evidence and final confirmation without actor/time/eligibility flags", async () => {
    for (const change of [{ approvalConfirmed: false }, { permissionReviewId: null }, { locationReviewId: null }, { statementVersion: "old" }, { actorId: id }, { confirmedAt: "2026-10-02T01:00:00Z" }, { eligible: true }, { expectedVersion: 2_147_483_647 }]) {
      expect((await handleOfferDecision(request({ ...input, ...change }))).status).toBe(400);
    }
    expect(mocks.record).not.toHaveBeenCalled();
  });
  it("requires an unpublication reason, trims it and keeps the decision uncached", async () => {
    const unpublish = { command: "unpublish", offerId: id, revisionId: id, expectedVersion: 4, requestId: id, reason: " " };
    expect((await handleOfferDecision(request(unpublish))).status).toBe(400);
    mocks.record.mockResolvedValue({ decisionId: id });
    const response = await handleOfferDecision(request({ ...unpublish, reason: " Supplied correction needed " }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.record).toHaveBeenCalledWith({ ...unpublish, reason: "Supplied correction needed" });
  });
  it("maps stale offer/evidence/catalogue, inactive actors and invalid decisions without leaking diagnostics", async () => {
    for (const [code, status] of [["PT409", 409], ["42501", 403], ["22023", 400], ["XX000", 500]] as const) {
      mocks.record.mockRejectedValue({ code, message: "private diagnostic" });
      const response = await handleOfferDecision(request(input));
      expect(response.status).toBe(status);
      expect(JSON.stringify(await response.json())).not.toContain("private diagnostic");
    }
    expect(mocks.record).toHaveBeenCalledTimes(4);
  });
});
