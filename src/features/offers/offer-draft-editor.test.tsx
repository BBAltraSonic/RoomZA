// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { OfferWorkspaceDetail } from "./workspace-contract";

vi.mock("@/features/discovery/media-fields", () => ({ MediaFields: () => null, DealPriceFields: () => null, MediaReviewPreview: () => null }));

const mocks = vi.hoisted(() => ({ request: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("./workspace-request", () => ({ requestOfferWorkspace: mocks.request }));
vi.mock("@/features/map-discovery/location-selector", () => ({ LocationSelector: () => <button type="button">Choose location</button> }));
import { OfferDraftEditor } from "./offer-draft-editor";
import { OFFER_PERMISSION_STATEMENT, OFFER_PERMISSION_VERSION } from "./permission-contract";

const offerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const detail: OfferWorkspaceDetail = { offer: { id: offerId, version: 2, pendingRevisionId: null, withdrawnAt: null, updatedAt: "2026-10-01T12:00:00Z", draft: { title: "Original" } }, placeLabel: null, submission: null, history: [] };
afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());
describe("private editor conflict and submission behavior", () => {
  it("saves the post's Visit and booking links and previews their exact destinations", async () => {
    mocks.request.mockResolvedValue({ ok: true, data: { offerId, version: 3, pendingRevisionId: null } });
    render(<OfferDraftEditor detail={detail} />);
    fireEvent.change(screen.getByLabelText("Visit link"), { target: { value: "https://example.com/specific-offer" } });
    fireEvent.change(screen.getByLabelText("Booking link"), { target: { value: "https://example.com/book-offer" } });
    fireEvent.click(screen.getByRole("button", { name: "Save private draft" }));
    await screen.findByText("Private draft saved.");
    expect(mocks.request.mock.calls[0]?.[0]).toMatchObject({ command: "save", draft: { visitUrl: "https://example.com/specific-offer", bookingUrl: "https://example.com/book-offer" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview draft" }));
    expect(screen.getByRole("link", { name: "https://example.com/specific-offer" })).toHaveAttribute("href", "https://example.com/specific-offer");
  });
  it("updates server publication status after approval while retaining unsaved form text", () => {
    const { rerender } = render(<OfferDraftEditor detail={detail} />);
    fireEvent.change(screen.getByLabelText("Offer title"), { target: { value: "Unsent text" } });
    rerender(<OfferDraftEditor detail={{ ...detail, offer: { ...detail.offer, version: 3, publication: { status: "live", checkedAt: detail.offer.updatedAt, revisionId: offerId, confirmedAt: detail.offer.updatedAt, startsAt: detail.offer.updatedAt, endsAt: "2099-01-01T00:00:00Z" } } }} />);
    expect(screen.getByText("Live")).toBeVisible();
    expect(screen.getByLabelText("Offer title")).toHaveValue("Unsent text");
    expect(screen.getByRole("button", { name: "Save private draft" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("This offer changed");
  });
  it("keeps unsaved text and blocks another save after HTTP 409", async () => {
    mocks.request.mockResolvedValue({ ok: false, status: 409, message: "Offer changed elsewhere." });
    render(<OfferDraftEditor detail={detail} />);
    fireEvent.change(screen.getByLabelText("Offer title"), { target: { value: "Keep my text" } });
    fireEvent.click(screen.getByRole("button", { name: "Save private draft" }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Offer title")).toHaveValue("Keep my text");
    expect(screen.getByRole("button", { name: "Save private draft" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Load latest version" })).toBeEnabled();
    expect(mocks.request).toHaveBeenCalledOnce();
  });
  it("saves a partial draft with its captured version, then validates submission", async () => {
    mocks.request.mockResolvedValue({ ok: true, data: { offerId, version: 3, pendingRevisionId: null } });
    render(<OfferDraftEditor detail={detail} />);
    fireEvent.change(screen.getByLabelText("Offer title"), { target: { value: "Revised" } });
    expect(screen.getByRole("button", { name: "Submit for confirmation" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Save private draft" }));
    await screen.findByText("Private draft saved.");
    expect(mocks.request).toHaveBeenCalledWith({ command: "save", offerId, expectedVersion: 2, draft: { title: "Revised", publicContact: {}, contactConsent: false } });
    fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(OFFER_PERMISSION_STATEMENT) }));
    fireEvent.click(screen.getByRole("button", { name: "Submit for confirmation" }));
    await screen.findByRole("alert");
    expect(mocks.request).toHaveBeenCalledOnce();
  });
  it("shows submitted content separately from a changed private draft", () => {
    render(<OfferDraftEditor detail={{ ...detail, offer: { ...detail.offer, pendingRevisionId: offerId }, submission: { id: offerId, content: { title: "Immutable submission" }, submittedAt: detail.offer.updatedAt } }} />);
    fireEvent.change(screen.getByLabelText("Offer title"), { target: { value: "Later private text" } });
    expect(screen.getByText("Immutable submission")).toBeVisible();
    expect(screen.getByRole("button", { name: "Submit for confirmation" })).toBeDisabled();
  });
  it("requires an explicit withdrawal confirmation", async () => {
    mocks.request.mockResolvedValue({ ok: true, data: { offerId, version: 3, pendingRevisionId: null } });
    render(<OfferDraftEditor detail={detail} />);
    fireEvent.click(screen.getByRole("button", { name: "Withdraw offer" }));
    expect(mocks.request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm withdrawal" }));
    await waitFor(() => expect(mocks.request).toHaveBeenCalledWith({ command: "withdraw", offerId, expectedVersion: 2 }));
    await screen.findByText("Withdrawn");
  });
  it("requires fresh confirmation and retains a stable revision ID after an uncertain outcome", async () => {
    mocks.request.mockResolvedValue({ ok: false, status: 500, message: "Try again" });
    render(<OfferDraftEditor detail={{ ...detail, offer: { ...detail.offer, draft: {
      publicContact: { phone: "+27215550100" }, contactConsent: true,
      title: "Offer", benefit: "Benefit", terms: "Terms", shopName: "Shop", address: "Public address",
      areaId: offerId, latitude: -33.96, longitude: 18.47,
      startsAt: "2099-10-01T00:00:00Z", endsAt: "2100-10-01T00:00:00Z",
      mediaIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab"], mediaRightsConfirmed: true,
    } } }} />);
    const submit = screen.getByRole("button", { name: "Submit for confirmation" });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(OFFER_PERMISSION_STATEMENT) }));
    fireEvent.click(submit);
    await screen.findByRole("alert");
    expect(mocks.request.mock.calls.at(0)?.[0]).toMatchObject({ command: "submit", expectedVersion: 2, permissionConfirmed: true, permissionVersion: OFFER_PERMISSION_VERSION });
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(2));
    expect(mocks.request.mock.calls.at(1)?.[0]).toEqual(mocks.request.mock.calls.at(0)?.[0]);
  });
});
