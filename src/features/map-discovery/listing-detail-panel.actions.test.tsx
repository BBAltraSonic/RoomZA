// @vitest-environment jsdom

import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ListingDetail } from "./listing-detail-panel";

const contactSheet = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a> }));
vi.mock("motion/react-m", () => ({ div: "div", h1: "h1", p: "p", span: "span" }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/features/applications/application-modal", () => ({ ApplicationModal: ({ trigger }: { trigger: ReactNode }) => trigger }));
vi.mock("@/features/admin/components/report-panel", () => ({
  ReportPanel: ({ bare }: { bare?: boolean }) => bare ? <form aria-label="Report form" /> : null,
}));
vi.mock("@/components/premium/image-lightbox", () => ({ ImageLightbox: () => null }));
vi.mock("@/features/chat/actions", () => ({ getOrCreateInquiryConversation: vi.fn() }));
vi.mock("@/features/purchase/actions", () => ({ contactSellerForPurchase: vi.fn(), requestPurchaseViewing: vi.fn() }));
vi.mock("./hooks/use-favorites", () => ({ useFavorites: () => ({ isFavorite: () => false, toggleFavorite: vi.fn(), authenticated: true }) }));
vi.mock("./lib/listing-share", () => ({ buildListingShareUrl: vi.fn(), shareListing: vi.fn() }));
vi.mock("@/features/showings/contact-sheet", () => ({
  ContactSheet: (props: Record<string, unknown>) => {
    contactSheet.props.push(props);
    return <button type="button" data-emphasis="secondary">Contact</button>;
  },
}));

import { ListingDetailPanel } from "./listing-detail-panel";

const rental: ListingDetail = {
  id: "listing-rent-1", title: "Garden cottage", address: "4 Oak Avenue, Johannesburg", price: 6000, listing_type: "rent",
  latitude: -26.15, longitude: 28.03, bedrooms: 1, bathrooms: 1, property_type: "cottage", parking_type: "none", parking_count: 0,
  electricity_type: "prepaid", water_availability: "municipal", lease_duration: "12_months", availability_date: "2026-12-01",
  created_at: "2026-11-10T10:00:00.000Z", metadata: null, images: [],
  publicContact: { whatsapp: "+27215550100", phone: "+27215550100", email: "lister@example.com" },
};
const sale: ListingDetail = { ...rental, id: "listing-sale-1", listing_type: "sale", sale_price: 1_200_000, price: 1_200_000 };

afterEach(() => { cleanup(); contactSheet.props = []; });

const actionBar = async () => {
  await screen.findByRole("button", { name: "Contact" });
  return screen.getByRole("group", { name: "Property actions" });
};
const barButtons = (bar: HTMLElement) => within(bar).getAllByRole("button").map(button => button.textContent?.trim());

describe.each([true, false])("listing action bar (compact %s)", compact => {
  it("gives a rental two actions: Contact, then the primary Apply now", async () => {
    render(<ListingDetailPanel listing={rental} compact={compact} />);
    const bar = await actionBar();
    expect(barButtons(bar)).toEqual(["Contact", "Apply now"]);
    expect(bar.querySelectorAll('[data-emphasis="primary"]')).toHaveLength(1);
    expect(within(bar).getByRole("button", { name: "Apply now" })).toHaveAttribute("data-emphasis", "primary");
  });

  it("gives a sale listing Contact and the primary Request a viewing", async () => {
    render(<ListingDetailPanel listing={sale} compact={compact} />);
    const bar = await actionBar();
    expect(barButtons(bar)).toEqual(["Contact", "Request a viewing"]);
    expect(within(bar).getByRole("button", { name: "Request a viewing" })).toHaveAttribute("data-emphasis", "primary");
  });

  it("moves messaging, live calls, showings and direct contact into the Contact sheet", async () => {
    render(<ListingDetailPanel listing={rental} compact={compact} />);
    await actionBar();
    for (const name of [/^Message/, /Connect/, /^Report/, /Sign in to chat/]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    for (const name of ["WhatsApp", "Call", "Email"]) expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
    const props = contactSheet.props.at(-1)!;
    expect(props).toMatchObject({ listingId: rental.id, kind: "rent", contact: rental.publicContact, authenticated: true });
  });
});

describe("listing header actions", () => {
  it("keeps Save visible and puts Share and Report behind More actions", async () => {
    render(<ListingDetailPanel listing={rental} />);
    await actionBar();
    expect(screen.queryByRole("button", { name: "Share listing" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Save listing" }).length).toBeGreaterThan(0);
    const more = screen.getAllByRole("button", { name: "More actions" });
    expect(more.length).toBeGreaterThan(0);
    fireEvent.click(more.at(-1)!);
    const menu = await screen.findByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map(item => item.textContent?.trim())).toEqual(["Share listing", "Report this listing"]);
  });

  it("opens the report form in a dialog from the More menu", async () => {
    render(<ListingDetailPanel listing={rental} />);
    await actionBar();
    fireEvent.click(screen.getAllByRole("button", { name: "More actions" }).at(-1)!);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Report this listing" }));
    const dialog = await screen.findByRole("dialog", { name: "Report this listing" });
    expect(within(dialog).getByRole("form", { name: "Report form" })).toBeInTheDocument();
  });
});

describe("listing body and deep links", () => {
  it("shows a live tour once, in the body rather than the action bar", async () => {
    render(<ListingDetailPanel listing={{ ...rental, liveTourId: "tour-1" }} compact />);
    const bar = await actionBar();
    const tour = screen.getAllByRole("link", { name: "Join live video tour" });
    expect(tour).toHaveLength(1);
    expect(bar).not.toContainElement(tour[0]!);
  });

  it("opens the Contact sheet for a message deep link", async () => {
    render(<ListingDetailPanel listing={rental} initialIntent="message" />);
    await actionBar();
    expect(contactSheet.props.at(-1)).toMatchObject({ initialOpen: true });
  });
});
