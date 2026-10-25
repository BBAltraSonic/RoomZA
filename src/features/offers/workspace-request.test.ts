// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestOfferWorkspace } from "./workspace-request";
afterEach(() => vi.unstubAllGlobals());
describe("private workspace HTTP client", () => {
  const offerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const request = { command: "save", offerId, expectedVersion: 2, draft: { title: "Keep my text" } };
  it("keeps proxy HTML out of the editor error after an uncertain save", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>Proxy response lost after commit</html>", { status: 503 })));
    expect(await requestOfferWorkspace(request)).toMatchObject({ ok: false, status: 503, message: expect.stringMatching(/Could not confirm.*text is still here/) });
  });
  it("does not confirm a malformed successful response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ok: true })));
    expect(await requestOfferWorkspace(request)).toMatchObject({ ok: false, status: 503 });
  });
  it("does not acknowledge another offer or an unrelated version", async () => {
    for (const data of [
      { offerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", version: 3, pendingRevisionId: null },
      { offerId, version: 5, pendingRevisionId: null },
    ]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(data)));
      expect(await requestOfferWorkspace(request)).toMatchObject({ ok: false, status: 409 });
    }
  });
  it("returns readable recovery after a network interruption", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(await requestOfferWorkspace(request)).toMatchObject({ ok: false, status: 503, message: expect.stringContaining("Your text is still here") });
  });
  it("accepts matching create, save, submit and withdrawal receipts", async () => {
    const revisionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    for (const [body, data] of [
      [{ command: "create", offerId, expectedVersion: 0 }, { offerId, version: 1, pendingRevisionId: null }],
      [request, { offerId, version: 3, pendingRevisionId: null }],
      [request, { offerId, version: 3, pendingRevisionId: revisionId }],
      [{ command: "submit", offerId, expectedVersion: 2, revisionId }, { offerId, version: 3, pendingRevisionId: revisionId }],
      [{ command: "withdraw", offerId, expectedVersion: 2 }, { offerId, version: 3, pendingRevisionId: null }],
      [{ command: "withdraw", offerId, expectedVersion: 2 }, { offerId, version: 2, pendingRevisionId: null }],
    ]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(data)));
      expect(await requestOfferWorkspace(body)).toEqual({ ok: true, data });
    }
  });
  it("rejects a submission receipt for a different immutable revision", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ offerId, version: 3, pendingRevisionId: null })));
    expect(await requestOfferWorkspace({ command: "submit", offerId, expectedVersion: 2, revisionId: offerId })).toMatchObject({ ok: false, status: 409 });
  });
  it.each([null, [], { error: null }, { error: ["wrong shape"] }])("handles an unexpected error envelope: %j", async value => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(value, { status: 503 })));
    expect(await requestOfferWorkspace(request)).toMatchObject({ ok: false, status: 503, message: expect.stringContaining("Your text is still here") });
  });
  it("keeps enrollment on its own validated response contract", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ enrolled: true })).mockResolvedValueOnce(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetcher);
    expect(await requestOfferWorkspace({}, true)).toEqual({ ok: true, data: { enrolled: true } });
    expect(await requestOfferWorkspace({}, true)).toMatchObject({ ok: false, status: 503 });
    expect(fetcher).toHaveBeenCalledWith("/api/private/offers/enroll", expect.any(Object));
  });
  it("shows middleware suspension messages and a safe account link", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ok: false, error: { code: "account_suspended", message: "Account access is suspended." } }, { status: 403 })));
    expect(await requestOfferWorkspace({})).toEqual({ ok: false, status: 403, message: "Account access is suspended.", nextPath: "/account-suspended" });
  });
  it("retains HTTP409 and rejects an external recovery link", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Offer changed.", nextPath: "https://elsewhere.invalid" }, { status: 409 })));
    expect(await requestOfferWorkspace({})).toEqual({ ok: false, status: 409, message: "Offer changed.", nextPath: "/post/offers" });
  });
});
