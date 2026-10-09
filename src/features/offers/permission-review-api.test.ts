import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRedirectError } from "next/dist/client/components/redirect";

const mocks = vi.hoisted(() => ({ user: vi.fn(), admin: vi.fn(), record: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.user }));
vi.mock("@/features/admin/auth", () => ({ requireAdmin: mocks.admin }));
vi.mock("./permission-review-data", () => ({ recordOfferPermissionEvidence: mocks.record }));
import { handleOfferPermissionEvidence } from "./permission-review-api";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const input = { offerId: id, revisionId: id, expectedVersion: 3, requestId: id, evidenceKind: "written_authorization", sourceReference: " Permission case 1 ", verificationNote: " Checked poster/shop/address scope ", authorizationChecked: true, statementVersion: "admin-permission-review-v1" };
function request(body: unknown, origin = "http://localhost:3113") {
  return new Request("http://localhost:3113/api/private/offers/permission-evidence", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
beforeEach(() => vi.resetAllMocks());
describe("private admin permission evidence HTTP boundary", () => {
  it("blocks cross-origin before Auth or RPC and blocks anonymous requests before revoked RPC", async () => {
    expect((await handleOfferPermissionEvidence(request(input, "https://elsewhere.invalid"))).status).toBe(403);
    expect(mocks.user).not.toHaveBeenCalled();
    mocks.user.mockRejectedValue(getRedirectError("/auth?redirect=%2Fadmin%2Foffers", "replace"));
    expect((await handleOfferPermissionEvidence(request(input))).status).toBe(401);
    expect(mocks.record).not.toHaveBeenCalled();
  });
  it("requires authorization evidence, confirmation and current statement without client actor flags", async () => {
    for (const change of [{ sourceReference: " " }, { verificationNote: " " }, { authorizationChecked: false }, { statementVersion: "old" }, { reviewerId: id }, { evidenceKind: "public_shop_page" }]) {
      expect((await handleOfferPermissionEvidence(request({ ...input, ...change }))).status).toBe(400);
    }
    expect(mocks.record).not.toHaveBeenCalled();
  });
  it("passes trimmed private evidence and keeps the result uncached", async () => {
    mocks.record.mockResolvedValue({ id, offerId: id, revisionId: id, version: 3, checkedAt: "2026-10-02T01:00:00Z" });
    const response = await handleOfferPermissionEvidence(request(input));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.record).toHaveBeenCalledWith({ ...input, sourceReference: "Permission case 1", verificationNote: "Checked poster/shop/address scope" });
  });
  it("maps stale and revoked access without retries, and hides database details", async () => {
    for (const [code, status] of [["PT409", 409], ["42501", 403], ["22023", 400], ["XX000", 500]] as const) {
      mocks.record.mockRejectedValue({ code, message: "private diagnostic" });
      const response = await handleOfferPermissionEvidence(request(input));
      expect(response.status).toBe(status);
      expect(JSON.stringify(await response.json())).not.toContain("private diagnostic");
    }
    expect(mocks.record).toHaveBeenCalledTimes(4);
  });
});
