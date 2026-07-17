// @vitest-environment jsdom

import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ListingDetail } from "./listing-detail-panel";

const mocks = vi.hoisted(() => ({
  shareListing: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("motion/react-m", () => ({ div: "div", h1: "h1", p: "p", span: "span" }));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));
vi.mock("@/features/applications/application-modal", () => ({ ApplicationModal: () => null }));
vi.mock("@/features/admin/components/report-panel", () => ({ ReportPanel: () => null }));
vi.mock("@/components/premium/image-lightbox", () => ({ ImageLightbox: () => null }));
vi.mock("@/features/chat/actions", () => ({ getOrCreateInquiryConversation: vi.fn() }));
vi.mock("@/features/purchase/actions", () => ({
  contactSellerForPurchase: vi.fn(),
  requestPurchaseViewing: vi.fn(),
}));
vi.mock("./hooks/use-favorites", () => ({
  useFavorites: () => ({ isFavorite: () => false, toggleFavorite: vi.fn() }),
}));
vi.mock("./hooks/use-essential-radius", () => ({
  useEssentialRadius: () => ({ score: null, isLoading: false }),
}));
vi.mock("./essential-radius-score", () => ({ EssentialRadiusScore: () => null }));
vi.mock("./lib/listing-share", () => ({
  buildListingShareUrl: (origin: string, listingId: string) => `${origin}/listing/${listingId}`,
  shareListing: mocks.shareListing,
}));

import { ListingDetailPanel } from "./listing-detail-panel";

const listing: ListingDetail = {
  id: "listing-123",
  title: "Sunny studio",
  address: "10 Main Road, Cape Town",
  price: 1_250_000,
  sale_price: 1_250_000,
  listing_type: "sale",
  latitude: -33.92,
  longitude: 18.42,
  bedrooms: 1,
  bathrooms: 1,
  property_type: "apartment",
  parking_type: "none",
  parking_count: 0,
  electricity_type: "prepaid",
  water_availability: "municipal",
  lease_duration: "12_months",
  availability_date: "2026-08-01",
  created_at: "2026-07-16T10:00:00.000Z",
  metadata: null,
  images: [],
};

afterEach(() => {
  mocks.shareListing.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.toastError.mockReset();
});

describe("ListingDetailPanel sharing", () => {
  it("routes both Share buttons through one guarded operation", async () => {
    let resolveShare: (outcome: "shared") => void = () => undefined;
    mocks.shareListing.mockReturnValue(
      new Promise<"shared">((resolve) => {
        resolveShare = resolve;
      }),
    );
    render(<ListingDetailPanel listing={listing} />);

    const shareButtons = screen.getAllByRole("button", { name: "Share listing" }) as HTMLButtonElement[];
    expect(shareButtons).toHaveLength(2);
    const mobileShareButton = shareButtons[0]!;
    const desktopShareButton = shareButtons[1]!;

    fireEvent.click(mobileShareButton);
    fireEvent.click(desktopShareButton);

    expect(mocks.shareListing).toHaveBeenCalledOnce();
    expect(shareButtons.every((button) => button.disabled)).toBe(true);

    resolveShare("shared");
    await waitFor(() => expect(shareButtons.every((button) => !button.disabled)).toBe(true));
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Property shared");
  });

  it("shows manual copy and restores focus to the invoking button after Escape", async () => {
    mocks.shareListing.mockResolvedValue("manual-copy-required");
    render(<ListingDetailPanel listing={listing} />);

    const shareButton = screen.getAllByRole("button", { name: "Share listing" })[1] as HTMLButtonElement;
    fireEvent.click(shareButton);

    const input = await screen.findByRole("textbox", { name: "Listing link" });
    expect((input as HTMLInputElement).value).toBe("http://localhost:3000/listing/listing-123");
    expect(document.activeElement).toBe(input);

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Listing link" })).toBeNull());
    expect(document.activeElement).toBe(shareButton);
  });
});
