// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

vi.mock("@/lib/motion/primitives", () => ({
  BlurImage: ({ alt }: { alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} />
  ),
}));

import { DesktopAreaSpotlight } from "./desktop-area-spotlight";
import type { ListingCardModel } from "./lib/types";

afterEach(cleanup);

const firstListing: ListingCardModel = {
  id: "home-1",
  title: "Mfuleni apartment",
  area: "Mfuleni, Cape Town",
  imageUrls: ["https://images.example.com/one.jpg", "https://images.example.com/two.jpg"],
  price: 4_800,
  bedrooms: 1,
  bathrooms: 1,
  rating: null,
  reviewCount: null,
  distanceKm: 0.4,
};

describe("DesktopAreaSpotlight", () => {
  it("summarizes the current area and opens the first result", () => {
    const onOpenFirstListing = vi.fn();
    const { container } = render(
      <DesktopAreaSpotlight
        location="Mfuleni"
        listingLabel="rentals"
        count={12}
        firstListing={firstListing}
        onOpenFirstListing={onOpenFirstListing}
      />,
    );

    expect(screen.getByRole("heading", { name: "Find a place in Mfuleni." })).toBeTruthy();
    expect(screen.getByText("12 rentals match this map view.")).toBeTruthy();
    expect(container.querySelector('[data-slot="desktop-area-spotlight"]')).toHaveClass(
      "ml-6",
      "mr-4",
      "mt-[22px]",
      "min-h-[232px]",
      "rounded-[var(--radius-panel)]",
    );

    fireEvent.click(screen.getByRole("button", { name: "View first home" }));
    expect(onOpenFirstListing).toHaveBeenCalledTimes(1);
  });

  it("does not render an empty promotional shell without a listing", () => {
    const { container } = render(
      <DesktopAreaSpotlight
        location="Johannesburg metro"
        listingLabel="rentals"
        count={0}
        onOpenFirstListing={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
