// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { locationReviewChecks, type LocationReviewSnapshot } from "./location-review-contract";
import { OfferLocationEvidenceEditor } from "./offer-location-evidence-editor";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const snapshot: LocationReviewSnapshot = { offerId: id, revisionId: id, version: 3, permissionReviewId: id, evidence: null,
  content: { title: "Offer", benefit: "Benefit", terms: "Terms", shopName: "Shop", areaId: id, address: "Public address", latitude: -33.96, longitude: 18.47, startsAt: "2026-10-01T01:00:00Z", endsAt: "2026-10-04T01:00:00Z" },
  place: { id, provider_id: "provider-ref", level: "locality", name: "Test", region: "Test", full_address: "Test, South Africa", center_lat: -33.96, center_lng: 18.47, west: 18.4, south: -34, east: 18.6, north: -33.9, created_at: "2026-10-02T01:00:00Z" },
};
function fill() {
  fireEvent.change(screen.getByLabelText("Place provenance reference"), { target: { value: "Place source case" } });
  fireEvent.change(screen.getByLabelText("Shop and offer source reference"), { target: { value: "Shop source case" } });
  fireEvent.change(screen.getByLabelText("Place, shop and date verification note"), { target: { value: "Keep this exact verification note" } });
  for (const { text } of locationReviewChecks) fireEvent.click(screen.getByRole("checkbox", { name: text }));
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("private place/shop/date evidence screen", () => {
  it("requires current permission evidence before showing write controls", () => {
    render(<OfferLocationEvidenceEditor snapshot={{ ...snapshot, permissionReviewId: null }} />);
    expect(screen.getByText(/Record permission evidence for this current revision first/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Record place, shop and date evidence" })).not.toBeInTheDocument();
  });
  it("retains all text and locks the captured version after offer/catalogue HTTP409", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ error: "The stored place changed." }, { status: 409 }));
    vi.stubGlobal("fetch", fetcher);
    render(<OfferLocationEvidenceEditor snapshot={snapshot} />);
    fill(); fireEvent.click(screen.getByRole("button", { name: "Record place, shop and date evidence" }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Place provenance reference")).toHaveValue("Place source case");
    expect(screen.getByLabelText("Shop and offer source reference")).toHaveValue("Shop source case");
    expect(screen.getByLabelText("Place, shop and date verification note")).toHaveValue("Keep this exact verification note");
    expect(screen.getByRole("button", { name: "Record place, shop and date evidence" })).toBeDisabled();
    expect(fetcher).toHaveBeenCalledOnce();
    expect(JSON.parse(fetcher.mock.calls.at(0)?.[1].body)).toMatchObject({ expectedVersion: 3, permissionReviewId: id, placeSnapshot: snapshot.place, provenanceChecked: true, shopChecked: true, contentChecked: true, datesChecked: true });
  });
  it("clears all confirmations on a changed source and records only private evidence", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ id })));
    render(<OfferLocationEvidenceEditor snapshot={snapshot} />);
    fill(); fireEvent.change(screen.getByLabelText("Shop and offer source reference"), { target: { value: "Updated shop source" } });
    for (const checkbox of screen.getAllByRole("checkbox")) expect(checkbox).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Record place, shop and date evidence" })).toBeDisabled();
    for (const checkbox of screen.getAllByRole("checkbox")) fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: "Record place, shop and date evidence" }));
    expect(await screen.findByRole("status")).toHaveTextContent("offer remains private");
  });
});
