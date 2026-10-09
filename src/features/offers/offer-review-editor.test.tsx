// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfferReviewEditor } from "./offer-review-editor";
import type { OfferReviewSnapshot } from "./review-contract";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const submission: OfferReviewSnapshot = { offerId: id, revisionId: id, version: 3, submittedAt: "2026-10-01T12:00:00Z", content: { title: "Submitted title", benefit: "Submitted benefit", terms: "Exact terms", shopName: "Shop", address: "Public address", areaId: id, latitude: -33.96, longitude: 18.47, startsAt: "2026-10-01T12:00:00Z", endsAt: "2026-10-02T12:00:00Z" } };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("immutable offer review", () => {
  it("retains correction text and prevents duplicate rejection after conflict", async () => {
    const fetcher = vi.fn<(url: string, init: RequestInit) => Promise<Response>>().mockResolvedValue(Response.json({ error: "This offer changed" }, { status: 409 })); vi.stubGlobal("fetch", fetcher);
    render(<OfferReviewEditor submission={submission} />);
    fireEvent.change(screen.getByLabelText("Correction reason"), { target: { value: "Check shop" } });
    fireEvent.click(screen.getByRole("button", { name: "Return for correction" }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Correction reason")).toHaveValue("Check shop");
    expect(screen.getByRole("button", { name: "Return for correction" })).toBeDisabled();
    expect(fetcher).toHaveBeenCalledOnce();
    expect(JSON.parse(fetcher.mock.calls[0]![1].body as string)).toEqual({ offerId: id, revisionId: id, expectedVersion: 3, reason: "Check shop" });
  });
  it("records correction once and leaves a truthful private status", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ offerId: id, version: 4, pendingRevisionId: null })); vi.stubGlobal("fetch", fetcher);
    render(<OfferReviewEditor submission={submission} />);
    fireEvent.change(screen.getByLabelText("Correction reason"), { target: { value: "Clarify terms" } });
    fireEvent.click(screen.getByRole("button", { name: "Return for correction" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Correction recorded"));
    expect(screen.getByRole("status")).toHaveTextContent("not public");
    expect(screen.queryByRole("button", { name: "Return for correction" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Submitted title" })).toBeInTheDocument();
  });
  it("retains text and exposes a recovery link for structured middleware suspension", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: { code: "account_suspended", message: "Account suspended" } }, { status: 403 })));
    render(<OfferReviewEditor submission={submission} />);
    fireEvent.change(screen.getByLabelText("Correction reason"), { target: { value: "Unsaved correction" } });
    fireEvent.click(screen.getByRole("button", { name: "Return for correction" }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Correction reason")).toHaveValue("Unsaved correction");
    expect(screen.getByRole("link", { name: "Resolve account access" })).toHaveAttribute("href", "/account-suspended");
  });
});
