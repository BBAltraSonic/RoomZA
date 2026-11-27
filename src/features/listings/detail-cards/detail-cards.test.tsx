// @vitest-environment jsdom

import type { ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PURCHASE_STAGES } from "@/features/purchase/progress";

import { AmenitiesSection } from "./amenities-section";
import { BondCalculatorCard } from "./bond-calculator-card";
import { formatListingDate } from "./format";
import { LeaseUtilitiesCard } from "./lease-utilities-card";
import { ListerIdentity } from "./lister-identity";
import { ListingFactsGrid } from "./listing-facts-grid";
import { MoveInCostCard } from "./move-in-cost-card";
import { PurchaseProgressTimeline } from "./purchase-progress-timeline";
import type { ListingDetail } from "./types";

vi.mock("next/link", () => ({ default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a> }));

afterEach(cleanup);

const rental: ListingDetail = {
  id: "listing-rent-1", title: "Garden cottage", address: "4 Oak Avenue, Johannesburg", price: 6000, listing_type: "rent",
  latitude: -26.15, longitude: 28.03, bedrooms: 1, bathrooms: 1, property_type: "cottage", parking_type: "none", parking_count: 0,
  electricity_type: "prepaid", water_availability: "municipal", lease_duration: "12_months", availability_date: "2026-12-01",
  created_at: "2026-11-10T10:00:00.000Z", metadata: null, images: [],
};
const sale: ListingDetail = { ...rental, id: "listing-sale-1", listing_type: "sale", sale_price: 1_200_000, price: 1_200_000 };

describe("formatListingDate", () => {
  it("should_return_not_specified_when_date_is_invalid", () => {
    expect(formatListingDate("not a date")).toBe("Not specified");
    expect(formatListingDate("")).toBe("Not specified");
  });

  it("should_format_a_valid_date_in_south_african_english", () => {
    expect(formatListingDate("2026-12-01")).toMatch(/1 December 2026/);
  });
});

describe("ListingFactsGrid", () => {
  it("should_show_type_bedrooms_bathrooms_parking_and_furnishing", () => {
    render(<ListingFactsGrid listing={rental} />);
    expect(screen.getByText("Cottage")).toBeInTheDocument();
    expect(screen.getByText("1 Bedroom")).toBeInTheDocument();
    expect(screen.getByText("Bathroom")).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();
    expect(screen.getByText("Unfurnished")).toBeInTheDocument();
  });

  it("should_say_open_plan_when_there_are_no_bedrooms", () => {
    render(<ListingFactsGrid listing={{ ...rental, bedrooms: 0, bathrooms: 2 }} />);
    expect(screen.getByText("Open plan")).toBeInTheDocument();
    expect(screen.getByText("Bathrooms")).toBeInTheDocument();
  });

  it("should_mark_furnished_from_the_essentials_amenities", () => {
    const amenities = { essentials: ["furnished" as const], security: [], lifestyle: [], appliances: [] };
    render(<ListingFactsGrid listing={{ ...rental, metadata: { amenities } }} />);
    expect(screen.getByText("Furnished")).toBeInTheDocument();
    expect(screen.getByText("Move-in ready")).toBeInTheDocument();
  });
});

describe("LeaseUtilitiesCard", () => {
  it("should_show_lease_water_and_availability_for_a_rental", () => {
    render(<LeaseUtilitiesCard listing={rental} />);
    const card = screen.getByRole("heading", { name: "Lease and utilities" }).closest("section")!;
    expect(within(card).getByText("12 months")).toBeInTheDocument();
    expect(within(card).getByText("Municipal")).toBeInTheDocument();
    expect(within(card).getByText("Available")).toBeInTheDocument();
  });

  it("should_show_type_and_listed_date_for_a_sale", () => {
    render(<LeaseUtilitiesCard listing={sale} />);
    const card = screen.getByRole("heading", { name: "Property details" }).closest("section")!;
    expect(within(card).getByText("Cottage")).toBeInTheDocument();
    expect(within(card).getByText("Listed")).toBeInTheDocument();
  });
});

describe("AmenitiesSection", () => {
  it("should_render_nothing_when_no_amenities_are_selected", () => {
    const { container } = render(<AmenitiesSection amenities={undefined} />);
    expect(container).toBeEmptyDOMElement();
    const empty = { essentials: [], security: [], lifestyle: [], appliances: [] };
    const { container: second } = render(<AmenitiesSection amenities={empty} />);
    expect(second).toBeEmptyDOMElement();
  });

  it("should_group_selected_amenities_by_category", () => {
    render(<AmenitiesSection amenities={{ essentials: ["wifi"], security: [], lifestyle: ["pool"], appliances: [] }} />);
    expect(screen.getByRole("heading", { name: "Amenities" })).toBeInTheDocument();
    expect(screen.getByText("Essentials")).toBeInTheDocument();
    expect(screen.getByText("Lifestyle")).toBeInTheDocument();
    expect(screen.queryByText("Security")).not.toBeInTheDocument();
  });
});

describe("MoveInCostCard", () => {
  it("should_flag_partly_estimated_costs_when_the_deposit_is_not_stated", () => {
    render(<MoveInCostCard listing={{ price: 6000, deposit_amount: null, admin_fee: 0 }} />);
    expect(screen.getByRole("heading", { name: "Due before move-in" })).toBeInTheDocument();
    expect(screen.getByText("Partly estimated")).toBeInTheDocument();
    expect(screen.getByText("Estimate: one month's rent")).toBeInTheDocument();
  });

  it("should_say_set_by_lister_when_every_amount_is_stated", () => {
    render(<MoveInCostCard listing={{ price: 6000, deposit_amount: 6000, admin_fee: 500 }} />);
    expect(screen.getByText("Set by lister")).toBeInTheDocument();
  });
});

describe("ListerIdentity", () => {
  it("should_link_to_the_public_profile_when_there_is_a_username", () => {
    render(<ListerIdentity presence={{ badge: "available", name: "Thandi", username: "thandi", avatarUrl: null }} />);
    expect(screen.getByRole("link", { name: "View Thandi's profile" })).toHaveAttribute("href", "/u/thandi");
  });

  it("should_show_a_plain_name_when_the_profile_is_private", () => {
    render(<ListerIdentity presence={{ badge: "available", name: "Thandi", username: null, avatarUrl: null }} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Thandi")).toBeInTheDocument();
  });
});

describe("BondCalculatorCard", () => {
  it("should_default_the_deposit_to_ten_percent_of_the_price", () => {
    render(<BondCalculatorCard listing={sale} />);
    expect(screen.getByLabelText("Purchase price")).toHaveValue(1_200_000);
    expect(screen.getByLabelText("Deposit")).toHaveValue(120_000);
  });
});

describe("PurchaseProgressTimeline", () => {
  it("should_count_completed_stages", () => {
    render(<PurchaseProgressTimeline currentStage={PURCHASE_STAGES[1]!} completedStages={[PURCHASE_STAGES[0]!]} />);
    expect(screen.getByText(`1/${PURCHASE_STAGES.length}`)).toBeInTheDocument();
    expect(screen.getByText("Current milestone")).toBeInTheDocument();
  });
});
