// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestOfferWorkspace } from "./workspace-request";
afterEach(() => vi.unstubAllGlobals());
describe("private workspace HTTP client", () => {
  it("shows middleware suspension messages and a safe account link", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ok: false, error: { code: "account_suspended", message: "Account access is suspended." } }, { status: 403 })));
    expect(await requestOfferWorkspace({})).toEqual({ ok: false, status: 403, message: "Account access is suspended.", nextPath: "/account-suspended" });
  });
  it("retains HTTP409 and rejects an external recovery link", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Offer changed.", nextPath: "https://elsewhere.invalid" }, { status: 409 })));
    expect(await requestOfferWorkspace({})).toEqual({ ok: false, status: 409, message: "Offer changed.", nextPath: "/post/offers" });
  });
});
