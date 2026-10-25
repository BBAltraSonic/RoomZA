// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EntryIntakeCommand } from "./intake-contract";
import { requestEntryWorkspace } from "./workspace-request";

const entryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const revisionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const foreignId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
afterEach(() => vi.unstubAllGlobals());

describe.each(["tourism", "event"] as const)("%s workspace acknowledgements", category => {
  const save: EntryIntakeCommand = { command: "save", entryId, category, expectedVersion: 2, draft: { title: "Retain my text" } };
  const receipt = { entryId, category, version: 3, pendingRevisionId: null as string | null };

  it.each([200, 503])("returns readable uncertain recovery for HTML with HTTP%i", async status => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>Proxy response after commit</html>", { status })));
    expect(await requestEntryWorkspace(save)).toMatchObject({ ok: false, status: 503, message: expect.stringMatching(/Could not confirm.*text is still here/) });
  });

  it("rejects foreign, wrong-category, stale and unrelated-version receipts", async () => {
    for (const data of [
      { ...receipt, entryId: foreignId }, { ...receipt, category: category === "event" ? "tourism" : "event" },
      { ...receipt, version: 2 }, { ...receipt, version: 7 },
    ]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(data)));
      expect(await requestEntryWorkspace(save)).toMatchObject({ ok: false, status: 409, message: expect.stringContaining("Load the latest version") });
    }
  });

  it("does not acknowledge a missing, malformed or expanded receipt", async () => {
    for (const data of [null, [], {}, { ...receipt, version: "3" }, { ...receipt, version: 0 }, { ...receipt, actorId: foreignId }]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(data)));
      expect(await requestEntryWorkspace(save)).toMatchObject({ ok: false, status: 503 });
    }
  });

  it("accepts real command receipts, pending saves and current-version withdrawal replays", async () => {
    const cases: { body: EntryIntakeCommand; data: typeof receipt }[] = [
      { body: { command: "create", entryId, category, expectedVersion: 0 }, data: { ...receipt, version: 1 } },
      { body: save, data: receipt }, { body: save, data: { ...receipt, pendingRevisionId: revisionId } },
      { body: { command: "submit", entryId, category, expectedVersion: 2, revisionId }, data: { ...receipt, pendingRevisionId: revisionId } },
      { body: { command: "withdraw", entryId, category, expectedVersion: 2 }, data: receipt },
      { body: { command: "withdraw", entryId, category, expectedVersion: 2 }, data: { ...receipt, version: 2 } },
    ];
    for (const { body, data } of cases) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(data)));
      expect(await requestEntryWorkspace(body)).toEqual({ ok: true, data });
    }
  });

  it("binds submission to its immutable revision and requires withdrawal to clear it", async () => {
    for (const pendingRevisionId of [null, foreignId]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ...receipt, pendingRevisionId })));
      expect(await requestEntryWorkspace({ command: "submit", entryId, category, expectedVersion: 2, revisionId })).toMatchObject({ ok: false, status: 409 });
    }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ...receipt, pendingRevisionId: revisionId })));
    expect(await requestEntryWorkspace({ command: "withdraw", entryId, category, expectedVersion: 2 })).toMatchObject({ ok: false, status: 409 });
  });

  it("validates enrollment independently and retains its requested category", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ enrolled: true, category }))
      .mockResolvedValueOnce(Response.json({ enrolled: true, category: category === "event" ? "tourism" : "event" }))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetcher);
    expect(await requestEntryWorkspace({ category }, true)).toEqual({ ok: true, data: { enrolled: true, category } });
    expect(await requestEntryWorkspace({ category }, true)).toMatchObject({ ok: false, status: 503 });
    expect(await requestEntryWorkspace({ category }, true)).toMatchObject({ ok: false, status: 503 });
    expect(fetcher).toHaveBeenCalledWith("/api/private/entries/enroll", expect.objectContaining({ method: "POST", body: JSON.stringify({ category }) }));
  });
});

describe("entry workspace recovery", () => {
  const command: EntryIntakeCommand = { command: "withdraw", entryId, category: "event", expectedVersion: 2 };
  it("keeps network failures readable and never retries automatically", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetcher);
    expect(await requestEntryWorkspace(command)).toMatchObject({ ok: false, status: 503, message: expect.stringContaining("Your text is still here") });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it.each([null, [], { error: null }])("handles unexpected HTTP409 envelopes without losing the conflict: %j", async data => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(data, { status: 409 })));
    expect(await requestEntryWorkspace(command)).toMatchObject({ ok: false, status: 409, message: expect.stringContaining("Your text is still here") });
  });
  it("retains suspension details and filters external recovery destinations", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ error: { code: "account_suspended", message: "Account access is suspended." } }, { status: 403 }))
      .mockResolvedValueOnce(Response.json({ error: "Entry changed.", nextPath: "https://elsewhere.invalid" }, { status: 409 }));
    vi.stubGlobal("fetch", fetcher);
    expect(await requestEntryWorkspace(command)).toMatchObject({ ok: false, status: 403, message: "Account access is suspended.", nextPath: "/account-suspended" });
    expect(await requestEntryWorkspace(command)).toMatchObject({ ok: false, status: 409, nextPath: "/post/entries" });
  });
});
