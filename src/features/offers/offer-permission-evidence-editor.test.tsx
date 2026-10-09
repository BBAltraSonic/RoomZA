// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { OFFER_PERMISSION_STATEMENT, OFFER_PERMISSION_VERSION } from "./permission-contract";
import type { PermissionReviewSnapshot } from "./permission-review-contract";
import { OfferPermissionEvidenceEditor } from "./offer-permission-evidence-editor";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const snapshot: PermissionReviewSnapshot = { offerId: id, revisionId: id, version: 3, permission: { posterId: id, statement: OFFER_PERMISSION_STATEMENT, statementVersion: OFFER_PERMISSION_VERSION, confirmedAt: "2026-10-02T01:00:00Z" }, evidence: null };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("private permission evidence form", () => {
  it("has no evidence-write control when poster consent is missing", () => {
    render(<OfferPermissionEvidenceEditor snapshot={{ ...snapshot, permission: null }} />);
    expect(screen.getByText(/no poster authorization confirmation/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Record permission evidence" })).not.toBeInTheDocument();
  });
  it("retains reference/note after 409 and locks the captured version", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ error: "This offer changed." }, { status: 409 }));
    vi.stubGlobal("fetch", fetcher);
    render(<OfferPermissionEvidenceEditor snapshot={snapshot} />);
    fireEvent.change(screen.getByLabelText("Authorization reference"), { target: { value: "Private case reference" } });
    fireEvent.change(screen.getByLabelText("Verification note"), { target: { value: "Keep this verification note" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Record permission evidence" }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Authorization reference")).toHaveValue("Private case reference");
    expect(screen.getByLabelText("Verification note")).toHaveValue("Keep this verification note");
    expect(screen.getByRole("button", { name: "Record permission evidence" })).toBeDisabled();
    expect(fetcher).toHaveBeenCalledOnce();
    expect(JSON.parse(fetcher.mock.calls.at(0)?.[1].body)).toMatchObject({ expectedVersion: 3, revisionId: id, authorizationChecked: true });
  });
  it("clears confirmation when evidence changes and reports private status after recording", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ id })));
    render(<OfferPermissionEvidenceEditor snapshot={snapshot} />);
    fireEvent.change(screen.getByLabelText("Authorization reference"), { target: { value: "Private case" } });
    fireEvent.change(screen.getByLabelText("Verification note"), { target: { value: "Verified scope" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByLabelText("Verification note"), { target: { value: "Verified exact scope" } });
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Record permission evidence" }));
    expect(await screen.findByRole("status")).toHaveTextContent("offer remains private");
  });
});
