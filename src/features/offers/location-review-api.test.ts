import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRedirectError } from "next/dist/client/components/redirect";

const mocks = vi.hoisted(() => ({ user: vi.fn(), admin: vi.fn(), record: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.user }));
vi.mock("@/features/admin/auth", () => ({ requireAdmin: mocks.admin }));
vi.mock("./location-review-data", () => ({ recordOfferLocationEvidence: mocks.record }));
import { handleOfferLocationEvidence } from "./location-review-api";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const place = { id, provider_id: "provider-ref", level: "locality", name: "Test", region: "Test", full_address: "Test, South Africa", center_lat: -33.96, center_lng: 18.47, west: 18.4, south: -34, east: 18.6, north: -33.9, created_at: "2026-10-02T01:00:00Z" };
const input = { offerId: id, revisionId: id, expectedVersion: 3, requestId: id, permissionReviewId: id, placeSnapshot: place,
  provenanceReference: " Provider case ", shopReference: " Shop source ", verificationNote: " Checked supplied facts ",
  provenanceChecked: true, shopChecked: true, contentChecked: true, datesChecked: true, statementVersion: "admin-location-review-v1" };
function request(body: unknown, origin = "http://localhost:3115") {
  return new Request("http://localhost:3115/api/private/offers/location-evidence", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
beforeEach(() => vi.resetAllMocks());
describe("private place/shop/date evidence HTTP boundary", () => {
  it("denies cross-origin before Auth and anonymous before revoked RPC", async () => {
    expect((await handleOfferLocationEvidence(request(input, "https://elsewhere.invalid"))).status).toBe(403);
    expect(mocks.user).not.toHaveBeenCalled();
    mocks.user.mockRejectedValue(getRedirectError("/auth?redirect=%2Fadmin%2Foffers", "replace"));
    expect((await handleOfferLocationEvidence(request(input))).status).toBe(401);
    expect(mocks.record).not.toHaveBeenCalled();
  });
  it("requires four separate checks, source references and the exact bounded snapshot without actor flags", async () => {
    for (const change of [{ provenanceChecked: false }, { shopChecked: false }, { contentChecked: false }, { datesChecked: false },
      { provenanceReference: " " }, { shopReference: " " }, { verificationNote: " " }, { permissionReviewId: null },
      { placeSnapshot: { ...place, countryChecked: true } }, { reviewerId: id }, { statementVersion: "old" }, { expectedVersion: 2_147_483_647 }]) {
      expect((await handleOfferLocationEvidence(request({ ...input, ...change }))).status).toBe(400);
    }
    expect(mocks.record).not.toHaveBeenCalled();
  });
  it("trims private references and returns uncached success", async () => {
    mocks.record.mockResolvedValue({ id, offerId: id, revisionId: id, version: 3, checkedAt: "2026-10-02T01:00:00Z" });
    const response = await handleOfferLocationEvidence(request(input));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.record).toHaveBeenCalledWith({ ...input, provenanceReference: "Provider case", shopReference: "Shop source", verificationNote: "Checked supplied facts" });
  });
  it("maps offer/catalogue conflicts, eligibility loss and invalid evidence without leaking diagnostics", async () => {
    for (const [code, status] of [["PT409", 409], ["42501", 403], ["22023", 400], ["XX000", 500]] as const) {
      mocks.record.mockRejectedValue({ code, message: "private diagnostic" });
      const response = await handleOfferLocationEvidence(request(input));
      expect(response.status).toBe(status);
      expect(JSON.stringify(await response.json())).not.toContain("private diagnostic");
    }
    expect(mocks.record).toHaveBeenCalledTimes(4);
  });
});
