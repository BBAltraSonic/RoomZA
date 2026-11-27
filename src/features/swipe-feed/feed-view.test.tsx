// @vitest-environment jsdom

import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ListingCardModel } from "@/features/map-discovery/lib/types";

const favorites = vi.hoisted(() => ({
  authenticated: false,
  saved: new Set<string>(),
  toggleFavorite: vi.fn(),
}));
const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }));
const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a> }));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt, fill, ...props }: { src: string; alt: string; fill?: boolean }) => <img src={src} alt={alt} data-fill={fill ? "" : undefined} {...props} />,
  getImageProps: ({ src, sizes }: { src: string; sizes?: string }) => ({ props: { src, sizes } }),
}));
vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("@/features/map-discovery/hooks/use-favorites", () => ({
  useFavorites: () => ({
    authenticated: favorites.authenticated,
    isFavorite: (id: string) => favorites.saved.has(id),
    toggleFavorite: favorites.toggleFavorite,
  }),
}));
vi.mock("@/features/showings/contact-sheet", () => ({ ContactSheet: () => <button type="button">Contact</button> }));
vi.mock("@/features/applications/application-modal", () => ({ ApplicationModal: ({ trigger }: { trigger: ReactNode }) => trigger }));
vi.mock("@/features/admin/components/report-panel", () => ({ ReportPanel: () => null }));
vi.mock("@/features/chat/actions", () => ({ getOrCreateInquiryConversation: vi.fn() }));
vi.mock("@/features/purchase/actions", () => ({ contactSellerForPurchase: vi.fn(), requestPurchaseViewing: vi.fn() }));
vi.mock("@/features/purchase/use-purchase-progress", () => ({ usePurchaseProgress: () => [] }));

import { FeedView, type FeedViewProps } from "./feed-view";
import { SESSION_PASSES_KEY } from "./session-passes";
import { GUEST_SAVES_KEY } from "./guest-saves";

const listing = (id: string, title: string): ListingCardModel => ({
  id, title, area: "Parkhurst", imageUrls: [`https://cdn.test/${id}.jpg`], price: 6000, listingType: "rent",
  bedrooms: 1, bathrooms: 1, propertyType: "cottage", rating: null, reviewCount: null, distanceKm: null,
});
const listings = [listing("a", "Garden cottage"), listing("b", "City loft"), listing("c", "Beach flat")];

function detailResponse(id: string) {
  return new Response(JSON.stringify({
    ok: true,
    data: {
      id, title: `Home ${id}`, address: "4 Oak Avenue", price: 6000, listing_type: "rent", latitude: -26.15, longitude: 28.03,
      bedrooms: 1, bathrooms: 1, property_type: "cottage", parking_type: "none", parking_count: 0, electricity_type: "prepaid",
      water_availability: "municipal", lease_duration: "12_months", availability_date: "2026-12-01", created_at: "2026-11-10T10:00:00.000Z",
      metadata: null, images: [], deposit_amount: 6000, admin_fee: 0,
    },
  }), { status: 200 });
}

function renderFeed(props: Partial<FeedViewProps> = {}) {
  const onCursorChange = vi.fn();
  const onClose = vi.fn();
  render(
    <FeedView listings={listings} listingMode="rent" surface="mobile" onCursorChange={onCursorChange} onClose={onClose} onOpenOnMap={vi.fn()} {...props} />,
  );
  return { onCursorChange, onClose };
}

const currentCard = () => screen.getByRole("article");
const pressInCard = (name: string) => fireEvent.click(within(currentCard()).getByRole("button", { name }));

beforeEach(() => {
  favorites.authenticated = false;
  favorites.saved = new Set();
  favorites.toggleFavorite.mockReset().mockResolvedValue(true);
  vi.stubGlobal("fetch", vi.fn(async (url: string) => detailResponse(String(url).split("/").pop()!.split("?")[0]!)));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
  window.localStorage.clear();
  toastMock.mockClear();
  push.mockClear();
});

describe("FeedView", () => {
  it("should_show_one_listing_at_a_time_with_its_position", () => {
    renderFeed();
    expect(currentCard()).toHaveAccessibleName("Garden cottage");
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("should_keep_the_card_behind_out_of_reach_of_assistive_tech", () => {
    renderFeed();
    const behind = document.querySelector('[data-listing-id="b"]')!;
    expect(behind).toHaveAttribute("aria-hidden", "true");
    expect(behind).toHaveAttribute("inert");
  });

  it("should_move_on_after_a_pass_and_remember_it_for_the_session", async () => {
    const { onCursorChange } = renderFeed();
    pressInCard("Pass");
    await waitFor(() => expect(currentCard()).toHaveAccessibleName("City loft"));
    expect(onCursorChange).toHaveBeenLastCalledWith("b");
    expect(JSON.parse(window.sessionStorage.getItem(SESSION_PASSES_KEY)!)).toEqual(["a"]);
  });

  it("should_bring_back_the_last_listing_on_undo", async () => {
    renderFeed();
    pressInCard("Pass");
    await waitFor(() => expect(currentCard()).toHaveAccessibleName("City loft"));
    pressInCard("Undo");
    await waitFor(() => expect(currentCard()).toHaveAccessibleName("Garden cottage"));
  });

  it("should_save_for_a_guest_on_this_device_without_sending_them_to_sign_in", async () => {
    renderFeed();
    pressInCard("Save");
    await waitFor(() => expect(currentCard()).toHaveAccessibleName("City loft"));
    expect(JSON.parse(window.localStorage.getItem(GUEST_SAVES_KEY)!)).toEqual([{ id: "a", listingType: "rent" }]);
    expect(push).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledTimes(1);

    pressInCard("Save");
    await waitFor(() => expect(currentCard()).toHaveAccessibleName("Beach flat"));
    expect(toastMock).toHaveBeenCalledTimes(1);
  });

  it("should_remove_a_guest_save_on_undo", async () => {
    renderFeed();
    pressInCard("Save");
    await waitFor(() => expect(currentCard()).toHaveAccessibleName("City loft"));
    pressInCard("Undo");
    await waitFor(() => expect(currentCard()).toHaveAccessibleName("Garden cottage"));
    expect(within(currentCard()).getByRole("button", { name: "Save" })).toHaveAttribute("aria-pressed", "false");
    expect(JSON.parse(window.localStorage.getItem(GUEST_SAVES_KEY)!)).toEqual([]);
  });

  it("should_save_to_favourites_when_signed_in", async () => {
    favorites.authenticated = true;
    renderFeed();
    pressInCard("Save");
    await waitFor(() => expect(favorites.toggleFavorite).toHaveBeenCalledWith("a", { listingType: "rent" }));
    expect(window.localStorage.getItem(GUEST_SAVES_KEY)).toBeNull();
  });

  it("should_pass_and_save_from_the_keyboard", async () => {
    renderFeed();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    await waitFor(() => expect(currentCard()).toHaveAccessibleName("City loft"));
    fireEvent.keyDown(window, { key: "z" });
    await waitFor(() => expect(currentCard()).toHaveAccessibleName("Garden cottage"));
  });

  it("should_go_back_to_the_map_from_the_header_and_the_m_key", () => {
    const { onClose } = renderFeed();
    fireEvent.click(screen.getByRole("button", { name: "Map" }));
    fireEvent.keyDown(window, { key: "m" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("should_offer_passed_listings_again_at_the_end", async () => {
    renderFeed({ listings: [listings[0]!] });
    pressInCard("Pass");
    await screen.findByRole("heading", { name: "You've seen every listing here" });
    fireEvent.click(screen.getByRole("button", { name: "Show passed listings" }));
    await waitFor(() => expect(currentCard()).toHaveAccessibleName("Garden cottage"));
  });

  it("should_open_at_a_listing_from_the_map_and_follow_later_pin_taps", async () => {
    const { onCursorChange } = renderFeed({ openListingId: "b" });
    expect(currentCard()).toHaveAccessibleName("City loft");
    cleanup();
    const view = <FeedView listings={listings} listingMode="rent" surface="mobile" onCursorChange={onCursorChange} onClose={vi.fn()} onOpenOnMap={vi.fn()} openListingId="b" />;
    const { rerender } = render(view);
    rerender(<FeedView listings={listings} listingMode="rent" surface="mobile" onCursorChange={onCursorChange} onClose={vi.fn()} onOpenOnMap={vi.fn()} openListingId="c" />);
    await waitFor(() => expect(currentCard()).toHaveAccessibleName("Beach flat"));
  });

  it("should_keep_a_linked_listing_that_is_not_in_the_results", async () => {
    renderFeed({ openListingId: "zz" });
    await waitFor(() => expect(currentCard()).toHaveAccessibleName("Home zz"));
  });

  it("should_load_structured_details_and_the_actions_below_the_photo", async () => {
    renderFeed();
    const card = currentCard();
    expect(await within(card).findByRole("heading", { name: "Due before move-in" })).toBeInTheDocument();
    expect(within(card).getByRole("group", { name: "Property actions" })).toBeInTheDocument();
    expect(within(card).getByRole("heading", { name: "Lease and utilities" })).toBeInTheDocument();
  });

  it("should_say_so_when_nothing_matches", () => {
    renderFeed({ listings: [] });
    expect(screen.getByRole("heading", { name: "No listings match here" })).toBeInTheDocument();
  });
});
