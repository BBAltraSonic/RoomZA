import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRedirectError } from "next/dist/client/components/redirect";
import { RedirectStatusCode } from "next/dist/client/components/redirect-status-code";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), enroll: vi.fn(), write: vi.fn(), permissionSubmit: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("./intake", () => ({ enrollOfferPoster: mocks.enroll, writeOfferIntake: mocks.write }));
vi.mock("./permission-data", () => ({ submitPermissionedOffer: mocks.permissionSubmit }));
import { handleOfferWorkspaceWrite } from "./workspace-api";

const offerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function request(body: unknown, origin = "http://localhost:3100") {
  return new Request("http://localhost:3100/api/private/offers", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
describe("private offer mutation HTTP boundary", () => {
  beforeEach(() => vi.resetAllMocks());
  it("rejects cross-origin and missing-origin writes before account or RPC work", async () => {
    expect((await handleOfferWorkspaceWrite(request({}, "https://elsewhere.invalid"))).status).toBe(403);
    expect((await handleOfferWorkspaceWrite(new Request("http://localhost:3100/api/private/offers", { method: "POST" }))).status).toBe(403);
    expect(mocks.requireUser).not.toHaveBeenCalled();
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("returns a sign-in link and 401 without invoking the revoked anon RPC", async () => {
    mocks.requireUser.mockRejectedValue(getRedirectError("/auth?redirect=%2Fpost%2Foffers", "replace", RedirectStatusCode.TemporaryRedirect));
    const response = await handleOfferWorkspaceWrite(request({}));
    expect(response.status).toBe(401);
    expect((await response.json()).nextPath).toBe("/auth?redirect=%2Fpost%2Foffers");
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("returns the account gate as 403", async () => {
    mocks.requireUser.mockRejectedValue(getRedirectError("/account-suspended", "replace"));
    const response = await handleOfferWorkspaceWrite(request({}));
    expect(response.status).toBe(403);
    expect((await response.json()).nextPath).toBe("/account-suspended");
  });
  it("rejects owner flags and invalid commands before mutations", async () => {
    expect((await handleOfferWorkspaceWrite(request({ command: "create", offerId, expectedVersion: 0, posterId: offerId }))).status).toBe(400);
    expect((await handleOfferWorkspaceWrite(request({ command: "approve", offerId, expectedVersion: 1 }))).status).toBe(400);
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("passes only the validated private command and keeps responses uncached", async () => {
    mocks.write.mockResolvedValue({ offerId, version: 2, pendingRevisionId: null });
    const response = await handleOfferWorkspaceWrite(request({ command: "save", offerId, expectedVersion: 1, draft: { title: " Draft " } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.write).toHaveBeenCalledWith({ command: "save", offerId, expectedVersion: 1, draft: { title: "Draft" } });
  });
  it("maps a stored version conflict to HTTP 409 without retrying", async () => {
    mocks.write.mockRejectedValue({ code: "PT409" });
    const response = await handleOfferWorkspaceWrite(request({ command: "withdraw", offerId, expectedVersion: 1 }));
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("conflict");
    expect(mocks.write).toHaveBeenCalledOnce();
  });
  it("enrollment accepts no actor identity or capabilities", async () => {
    expect((await handleOfferWorkspaceWrite(request({ canPostOffers: true }), true)).status).toBe(400);
    expect(mocks.enroll).not.toHaveBeenCalled();
    expect((await handleOfferWorkspaceWrite(request({}), true)).status).toBe(200);
    expect(mocks.enroll).toHaveBeenCalledOnce();
  });
  it("bounds input and hides database details", async () => {
    expect((await handleOfferWorkspaceWrite(request({ value: "x".repeat(21000) }))).status).toBe(413);
    mocks.write.mockRejectedValue({ message: "internal secret", code: "XX000" });
    const response = await handleOfferWorkspaceWrite(request({ command: "create", offerId, expectedVersion: 0 }));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("internal secret");
  });
  it("requires explicit current authorization for submission", async () => {
    const input = { command: "submit", offerId, revisionId: offerId, expectedVersion: 2 };
    for (const permission of [{}, { permissionConfirmed: false, permissionVersion: "shop-authorization-v1" }, { permissionConfirmed: true, permissionVersion: "old" }]) {
      expect((await handleOfferWorkspaceWrite(request({ ...input, ...permission }))).status).toBe(400);
    }
    expect(mocks.write).not.toHaveBeenCalled();
    expect(mocks.permissionSubmit).not.toHaveBeenCalled();
  });
  it("uses the atomic permission adapter instead of the original unpermissioned submission", async () => {
    const input = { command: "submit", offerId, revisionId: offerId, expectedVersion: 2, permissionConfirmed: true, permissionVersion: "shop-authorization-v1" };
    mocks.permissionSubmit.mockResolvedValue({ offerId, version: 3, pendingRevisionId: offerId });
    expect((await handleOfferWorkspaceWrite(request(input))).status).toBe(200);
    expect(mocks.permissionSubmit).toHaveBeenCalledWith(input);
    expect(mocks.write).not.toHaveBeenCalled();
    mocks.permissionSubmit.mockRejectedValue({ code: "PT409" });
    expect((await handleOfferWorkspaceWrite(request(input))).status).toBe(409);
  });
});
