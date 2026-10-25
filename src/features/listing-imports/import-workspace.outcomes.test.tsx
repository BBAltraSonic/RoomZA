// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ImportJobSummary } from "./types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), notFound: vi.fn() }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/lib/supabase/browser", () => ({ createClient: () => ({
  channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel: vi.fn(),
}) }));

import { ImportWorkspace } from "./import-workspace";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const owner = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const base: ImportJobSummary = {
  id, organizationId: id, sourceKind: "json", sourceName: "outcome.json", stage: "complete",
  version: 9, totalRows: 3, processedRows: 3, validRows: 0, warningRows: 1, blockedRows: 1,
  committedRows: 2, failedRows: 0, heartbeatAt: null, updatedAt: "2026-10-24T18:00:00Z",
  messageCode: "import_complete", messageDetail: null,
};
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

async function setup(overrides: Partial<ImportJobSummary>, loseAcknowledgement = false) {
  vi.useFakeTimers();
  let job = { ...base, ...overrides };
  const writes: Record<string, unknown>[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "PATCH") {
      writes.push(JSON.parse(String(init.body)));
      if (loseAcknowledgement) throw new TypeError("Failed to fetch");
      job = { ...job, messageCode: "rollback_complete", messageDetail: "All eligible import changes were rolled back." };
      return Response.json({ ok: true, data: { job } });
    }
    const address = new URL(String(url), "http://localhost:3112");
    if (address.pathname.endsWith("/assets")) return Response.json({ ok: true, data: { assets: [] } });
    if (address.pathname.endsWith("/rows")) return Response.json({ ok: true, data: { rows: [], nextCursor: null, duplicateCandidates: {} } });
    return Response.json({ ok: true, data: { job } });
  }));
  render(<ImportWorkspace initialJob={job} initialConfiguration={{ mapping: {}, defaults: { responsibleAgentId: owner },
    selection: { mode: "explicit", included: [] }, sourceMetadata: { headers: [] }, sheetName: null, recordPath: null,
  }} initialRows={[]} initialNextCursor={null} agents={[{ id: owner, label: "Contained owner", role: "owner" }]} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  return writes;
}

it("shows completed rollback and keeps reports without offering another destructive action", async () => {
  await setup({ messageCode: "rollback_complete", messageDetail: "All eligible import changes were rolled back." });
  expect(screen.getByRole("heading", { name: "Rollback complete" })).not.toBeNull();
  expect(screen.getByText("All eligible import changes were rolled back.", { exact: true })).not.toBeNull();
  expect(screen.getByText("Download JSON report", { exact: true })).not.toBeNull();
  expect(screen.queryByRole("button", { name: "Roll back eligible changes" })).toBeNull();
  expect(screen.queryByPlaceholderText("Type ROLL BACK IMPORT")).toBeNull();
});

it("makes interrupted cleanup retryable once without asking for the same confirmation again", async () => {
  const writes = await setup({ messageCode: "rollback_incomplete", messageDetail: "One change still needs cleanup. Retry to continue." });
  expect(screen.getByRole("heading", { name: "Rollback needs attention" })).not.toBeNull();
  expect(screen.getByText("One change still needs cleanup. Retry to continue.", { exact: true })).not.toBeNull();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Retry rollback" })); await vi.advanceTimersByTimeAsync(1); });
  expect(writes).toEqual([{ action: "rollback", confirmation: "ROLL BACK IMPORT", expectedVersion: 9 }]);
  expect(screen.getByRole("heading", { name: "Rollback complete" })).not.toBeNull();
});

it("explains preserved rollback conflicts instead of claiming that imported changes remain applied", async () => {
  await setup({ messageCode: "rollback_conflicts", messageDetail: "One changed listing needs manual review." });
  expect(screen.getByRole("heading", { name: "Rollback needs review" })).not.toBeNull();
  expect(screen.getByText("One changed listing needs manual review.", { exact: true })).not.toBeNull();
  expect(screen.queryByText("Selected drafts and reviewed duplicate changes were applied. Audit snapshots remain available for rollback checks.")).toBeNull();
});

it("shows the legacy review message before another publication attempt", async () => {
  await setup({ stage: "confirming", messageCode: "selection_review_required", messageDetail: "Older results need a new review. Existing drafts are saved." });
  expect(screen.getByRole("heading", { name: "Review required" })).not.toBeNull();
  expect(screen.getByText("Older results need a new review. Existing drafts are saved.", { exact: true })).not.toBeNull();
  expect(screen.queryByRole("button", { name: "Publish and apply selected" })).toBeNull();
  expect(screen.getByRole("button", { name: "Start a new import" })).not.toBeNull();
});

it("distinguishes partially completed imports and directs users to preserved results and reports", async () => {
  await setup({ failedRows: 1, committedRows: 1 });
  expect(screen.getByRole("heading", { name: "Import complete with issues" })).not.toBeNull();
  expect(screen.getByText(/1 row needs review/)).not.toBeNull();
  expect(screen.getByText("Download CSV report", { exact: true })).not.toBeNull();
});

it("uses final result and failure counts rather than earlier validation totals", async () => {
  await setup({ failedRows: 1, committedRows: 1 });
  const saved = screen.getByText("Saved results", { exact: true });
  const failed = screen.getByText("Import failures", { exact: true });
  expect(saved.nextElementSibling?.textContent).toBe("1");
  expect(failed.nextElementSibling?.textContent).toBe("1");
});

it("explains an uncertain rollback response without showing a raw fetch error or claiming success", async () => {
  await setup({}, true);
  await act(async () => {
    fireEvent.change(screen.getByPlaceholderText("Type ROLL BACK IMPORT"), { target: { value: "ROLL BACK IMPORT" } });
    fireEvent.click(screen.getByRole("button", { name: "Roll back eligible changes" }));
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(screen.getByRole("alert").textContent).toContain("Could not confirm this update");
  expect(screen.getByRole("alert").textContent).toContain("Reload the current state");
  expect(screen.queryByRole("heading", { name: "Rollback complete" })).toBeNull();
});
