// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/features/discovery/media-fields", () => ({ MediaFields: () => null, DealPriceFields: () => null, MediaReviewPreview: () => null }));
vi.mock("@/features/map-discovery/location-selector", () => ({ LocationSelector: () => null }));
import { EntryDraftEditor } from "./entry-draft-editor";

afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
describe.each(["tourism", "event"] as const)("%s editor with the real HTTP helper", category => {
  const entryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const detail = { entry: { id: entryId, category, draft: { title: "Original title" }, version: 1,
    pendingRevisionId: null, withdrawnAt: null, updatedAt: "2035-10-03T06:30:00.000Z" }, placeLabel: null, submission: null, history: [] };

  it("retains dirty text and version after a lost response, then permits one explicit retry", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("<html>Lost committed response</html>", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ entryId, category, version: 2, pendingRevisionId: null }));
    vi.stubGlobal("fetch", fetcher);
    render(<EntryDraftEditor detail={detail} category={category} />);
    fireEvent.change(screen.getByLabelText("Entry title"), { target: { value: "Keep this edited title" } });
    fireEvent.click(screen.getByRole("button", { name: "Save private draft" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Could not confirm.*text is still here/);
    expect(screen.queryByText("Private draft saved.")).toBeNull();
    expect(screen.getByText(/Version 1.*Unsaved changes/)).toBeTruthy();
    expect((screen.getByLabelText("Entry title") as HTMLInputElement).value).toBe("Keep this edited title");
    expect(fetcher).toHaveBeenCalledOnce();
    expect(mocks.refresh).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save private draft" }));
    await screen.findByText("Private draft saved.");
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetcher.mock.calls[1]![1].body)).toMatchObject({ command: "save", category, entryId, expectedVersion: 1, draft: { title: "Keep this edited title" } });
  });

  it("does not mark a mismatched acknowledgement saved or replace the form version", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ entryId, category: category === "event" ? "tourism" : "event", version: 2, pendingRevisionId: null }));
    vi.stubGlobal("fetch", fetcher);
    render(<EntryDraftEditor detail={detail} category={category} />);
    fireEvent.change(screen.getByLabelText("Entry title"), { target: { value: "Unsaved category-specific text" } });
    fireEvent.click(screen.getByRole("button", { name: "Save private draft" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Load the latest version");
    expect(screen.queryByText("Private draft saved.")).toBeNull();
    expect(screen.getByText(/Version 1.*Unsaved changes/)).toBeTruthy();
    expect((screen.getByLabelText("Entry title") as HTMLInputElement).value).toBe("Unsaved category-specific text");
    expect(screen.getByRole("button", { name: "Load latest version" })).toBeTruthy();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
