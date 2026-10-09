import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRedirectError } from "next/dist/client/components/redirect";
import { RedirectStatusCode } from "next/dist/client/components/redirect-status-code";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), enroll: vi.fn(), write: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("./intake", () => ({ enrollEntryPoster: mocks.enroll, writeEntryIntake: mocks.write }));
import { handleEntryWorkspaceWrite } from "./workspace-api";

const entryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function request(body: unknown, origin = "http://localhost:3100") {
  return new Request("http://localhost:3100/api/private/entries", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
describe("private entry mutation HTTP boundary", () => {
  beforeEach(() => vi.resetAllMocks());
  it("rejects cross-origin or missing-origin writes before account or RPC work", async () => {
    expect((await handleEntryWorkspaceWrite(request({}, "https://elsewhere.invalid"))).status).toBe(403);
    expect((await handleEntryWorkspaceWrite(new Request("http://localhost:3100/api/private/entries", { method: "POST" }))).status).toBe(403);
    expect(mocks.requireUser).not.toHaveBeenCalled(); expect(mocks.write).not.toHaveBeenCalled();
  });
  it("rejects non-JSON requests and caller-supplied identity/capability fields", async () => {
    expect((await handleEntryWorkspaceWrite(new Request("http://localhost:3100/api/private/entries", { method: "POST", headers: { Origin: "http://localhost:3100", "Content-Type": "text/plain" }, body: "{}" }))).status).toBe(415);
    expect((await handleEntryWorkspaceWrite(request({ command: "create", entryId, category: "event", expectedVersion: 0, posterId: entryId }))).status).toBe(400);
    expect((await handleEntryWorkspaceWrite(request({ command: "approve", entryId, category: "event", expectedVersion: 1 }))).status).toBe(400);
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("returns safe sign-in and account-gate destinations", async () => {
    mocks.requireUser.mockRejectedValue(getRedirectError("/auth?redirect=%2Fpost%2Fentries", "replace", RedirectStatusCode.TemporaryRedirect));
    const signIn = await handleEntryWorkspaceWrite(request({}));
    expect(signIn.status).toBe(401); expect((await signIn.json()).nextPath).toBe("/auth?redirect=%2Fpost%2Fentries");
    mocks.requireUser.mockRejectedValue(getRedirectError("/account-suspended", "replace"));
    const suspended = await handleEntryWorkspaceWrite(request({}));
    expect(suspended.status).toBe(403); expect((await suspended.json()).nextPath).toBe("/account-suspended");
  });
  it("passes only validated commands, sets no-store and maps stale versions without retry", async () => {
    const command = { command: "save", entryId, category: "tourism", expectedVersion: 1, draft: { title: " Venue " } };
    mocks.write.mockResolvedValue({ entryId, category: "tourism", version: 2, pendingRevisionId: null });
    const saved = await handleEntryWorkspaceWrite(request(command));
    expect(saved.status).toBe(200); expect(saved.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.write).toHaveBeenCalledWith({ ...command, draft: { title: "Venue" } });
    mocks.write.mockRejectedValue({ code: "PT409" });
    const conflict = await handleEntryWorkspaceWrite(request({ command: "withdraw", entryId, category: "tourism", expectedVersion: 2 }));
    expect(conflict.status).toBe(409); expect((await conflict.json()).code).toBe("conflict"); expect(mocks.write).toHaveBeenCalledTimes(2);
  });
  it("enrolls one named category without accepting poster capability claims", async () => {
    expect((await handleEntryWorkspaceWrite(request({ category: "tourism", canPost: true }), true)).status).toBe(400);
    expect((await handleEntryWorkspaceWrite(request({ category: "tourism" }), true)).status).toBe(200);
    expect(mocks.enroll).toHaveBeenCalledWith("tourism");
  });
  it("bounds request bodies and hides database failures", async () => {
    expect((await handleEntryWorkspaceWrite(request({ value: "x".repeat(21000) }))).status).toBe(413);
    mocks.write.mockRejectedValue({ code: "XX000", message: "private detail" });
    const response = await handleEntryWorkspaceWrite(request({ command: "create", entryId, category: "event", expectedVersion: 0 }));
    expect(response.status).toBe(500); expect(JSON.stringify(await response.json())).not.toContain("private detail");
  });
});
