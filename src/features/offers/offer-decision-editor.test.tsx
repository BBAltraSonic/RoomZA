// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { LocationReviewSnapshot } from "./location-review-contract";
import type { OfferDecisionSnapshot } from "./decision-contract";
import { OfferApprovalEditor, OfferDecisionEditor } from "./offer-decision-editor";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const place = { id, provider_id: "provider-ref", level: "locality" as const, name: "Test", region: "Test", full_address: "Test, South Africa", center_lat: -33.96, center_lng: 18.47, west: 18.4, south: -34, east: 18.6, north: -33.9, created_at: "2026-10-02T01:00:00Z" };
const content = { title: "Reviewed offer", benefit: "Benefit", terms: "Terms", shopName: "Shop", areaId: id, address: "Public address", latitude: -33.96, longitude: 18.47, startsAt: "2026-10-01T01:00:00Z", endsAt: "2026-10-04T01:00:00Z" };
const review: LocationReviewSnapshot = { offerId: id, revisionId: id, version: 3, content, place, permissionReviewId: id,
  evidence: { id, reviewerId: id, offerVersion: 3, permissionReviewId: id, placeSnapshot: place, provenanceReference: "Provider source", shopReference: "Shop source", verificationNote: "Verified", statementVersion: "admin-location-review-v1", checkedAt: "2026-10-02T01:00:00Z" } };
const snapshot: OfferDecisionSnapshot = { offerId: id, version: 4, pendingRevisionId: null, withdrawnAt: null, content,
  decision: { id, revisionId: id, action: "approve", actorId: id, capturedVersion: 3, version: 4, reason: null, occurredAt: "2026-10-02T01:00:00Z" } };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("private offer decision forms", () => {
  it("requires current matching catalogue/evidence before showing approval", () => {
    render(<OfferApprovalEditor review={{ ...review, place: { ...place, name: "Changed" } }} />);
    expect(screen.queryByRole("button", { name: "Approve offer snapshot" })).not.toBeInTheDocument();
    expect(screen.getByText(/Record current permission and place/)).toBeVisible();
  });
  it("requires final explicit confirmation and captures exact evidence IDs/version", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ decisionId: id })); vi.stubGlobal("fetch", fetcher);
    render(<OfferApprovalEditor review={review} />);
    expect(screen.getByRole("button", { name: "Approve offer snapshot" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button", { name: "Approve offer snapshot" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Approved snapshot recorded");
    expect(JSON.parse(fetcher.mock.calls.at(0)?.[1].body)).toMatchObject({ command: "approve", expectedVersion: 3, permissionReviewId: id, locationReviewId: id, approvalConfirmed: true, statementVersion: "admin-offer-approval-v1" });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("retains unpublication reason and locks the captured decision after HTTP409", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ error: "The offer changed." }, { status: 409 })); vi.stubGlobal("fetch", fetcher);
    render(<OfferDecisionEditor snapshot={snapshot} />);
    fireEvent.change(screen.getByLabelText("Unpublication reason"), { target: { value: "Keep this supplied correction reason" } });
    fireEvent.click(screen.getByRole("button", { name: "Unpublish offer" })); await screen.findByRole("alert");
    expect(screen.getByLabelText("Unpublication reason")).toHaveValue("Keep this supplied correction reason");
    expect(screen.getByRole("button", { name: "Unpublish offer" })).toBeDisabled(); expect(fetcher).toHaveBeenCalledOnce();
  });
  it("shows removed approval after success and never provides restoration for an unpublished snapshot", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ decisionId: id })));
    render(<OfferDecisionEditor snapshot={snapshot} />);
    fireEvent.change(screen.getByLabelText("Unpublication reason"), { target: { value: "Supplied correction" } }); fireEvent.click(screen.getByRole("button", { name: "Unpublish offer" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Unpublication recorded");
    expect(screen.getByText(/This snapshot’s approval has been removed/)).toBeVisible(); cleanup();
    render(<OfferDecisionEditor snapshot={{ ...snapshot, version: 5, decision: { ...snapshot.decision, action: "unpublish", version: 5, capturedVersion: 4, reason: "Supplied correction" } }} />);
    expect(screen.queryByRole("button", { name: "Unpublish offer" })).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Approve offer snapshot" })).not.toBeInTheDocument();
  });
});
