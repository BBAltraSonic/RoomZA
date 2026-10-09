// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), request: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
vi.mock("./workspace-request", () => ({ requestEntryWorkspace: mocks.request }));
vi.mock("@/features/map-discovery/location-selector", () => ({ LocationSelector: () => <button type="button">Choose location</button> }));
import { EntryDraftEditor } from "./entry-draft-editor";

const detail = {
  entry: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", category: "tourism" as const, draft: { title: "First title" }, version: 1,
    pendingRevisionId: null, withdrawnAt: null, updatedAt: "2035-10-03T06:30:00.000Z" },
  placeLabel: null, submission: null, history: [],
};

afterEach(() => vi.clearAllMocks());
describe("private entry editor", () => {
  it("keeps edited text visible after a stale save and requires an explicit reload", async () => {
    mocks.request.mockResolvedValue({ ok: false, status: 409, message: "This entry changed in another session. Your unsaved text is still here." });
    render(<EntryDraftEditor detail={detail} category="tourism" />);
    const title = screen.getByLabelText("Entry title");
    fireEvent.change(title, { target: { value: "Unsaved title to keep" } });
    fireEvent.click(screen.getByRole("button", { name: "Save private draft" }));
    await waitFor(() => expect(mocks.request).toHaveBeenCalledOnce());
    expect(mocks.request.mock.calls[0]?.[0]).toMatchObject({ command: "save", expectedVersion: 1, draft: { title: "Unsaved title to keep" } });
    expect((await screen.findByRole("alert")).textContent).toContain("unsaved text is still here");
    expect((title as HTMLInputElement).value).toBe("Unsaved title to keep");
    expect(screen.getByRole("button", { name: "Load latest version" })).toBeTruthy();
  });
});
