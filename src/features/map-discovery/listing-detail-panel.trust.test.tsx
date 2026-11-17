// @vitest-environment jsdom

import * as React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
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

const rental: ListingDetail = {
  id: "listing-rent-1",
  title: "Garden cottage",
  address: "4 Oak Avenue, Johannesburg",
  price: 6000,
  listing_type: "rent",
  latitude: -26.15,
  longitude: 28.03,
  bedrooms: 1,
  bathrooms: 1,
  property_type: "cottage",
  parking_type: "none",
  parking_count: 0,
  electricity_type: "prepaid",
  water_availability: "municipal",
  lease_duration: "12_months",
  availability_date: "2026-12-01",
  created_at: "2026-11-10T10:00:00.000Z",
  metadata: null,
  images: [],
};

afterEach(() => cleanup());

function moveInCard() {
  return screen.getByRole("region", { name: "Due before move-in" });
}

describe("ListingDetailPanel trust signals", () => {
  it("should_show_the_lister_disclosed_move_in_total", () => {
    render(<ListingDetailPanel listing={{ ...rental, deposit_amount: 9000, admin_fee: 750 }} />);

    const card = within(moveInCard());
    expect(card.getByText(/^R\s*15\s*750$/)).toBeTruthy();
    expect(card.getByText("Set by lister")).toBeTruthy();
    expect(card.queryByText("Ask the lister to confirm any estimated amount before you pay anything.")).toBeNull();
  });

  it("should_label_estimated_move_in_amounts_when_the_lister_has_not_disclosed_them", () => {
    render(<ListingDetailPanel listing={rental} />);

    const card = within(moveInCard());
    expect(card.getByText("Partly estimated")).toBeTruthy();
    expect(card.getByText("Estimate: one month's rent")).toBeTruthy();
    expect(card.getByText("Not stated by lister")).toBeTruthy();
  });

  it("should_say_the_deposit_is_paid_through_and_held_by_roomza_when_the_listing_takes_it_online", () => {
    render(<ListingDetailPanel listing={{ ...rental, deposit_amount: 9000, admin_fee: 0, deposit_online: true }} />);

    expect(within(moveInCard()).getByText(/pay this deposit through RoomZA/)).toBeTruthy();
    expect(within(moveInCard()).getByText(/hold it until you move in/)).toBeTruthy();
  });

  it("should_not_promise_a_held_deposit_when_the_listing_does_not_take_it_online", () => {
    render(<ListingDetailPanel listing={{ ...rental, deposit_amount: 9000, admin_fee: 0 }} />);

    expect(within(moveInCard()).queryByText(/through RoomZA/)).toBeNull();
  });

  it("should_not_show_rental_move_in_costs_on_a_sale_listing", () => {
    render(<ListingDetailPanel listing={{ ...rental, listing_type: "sale", sale_price: 1_000_000, price: 1_000_000 }} />);

    expect(screen.queryByRole("region", { name: "Due before move-in" })).toBeNull();
  });

  it("should_link_the_lister_name_to_their_public_profile", () => {
    render(<ListingDetailPanel listing={{ ...rental, landlordPresence: { badge: "available", name: "Thandi M", username: "thandi", avatarUrl: null } }} />);

    expect(screen.getByRole("link", { name: "View Thandi M's profile" }).getAttribute("href")).toBe("/u/thandi");
  });

  it("should_show_a_private_lister_name_without_a_profile_link", () => {
    render(<ListingDetailPanel listing={{ ...rental, landlordPresence: { badge: "offline", name: "Lister", username: null, avatarUrl: null } }} />);

    expect(screen.getByText("Lister")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /profile/ })).toBeNull();
  });
});
