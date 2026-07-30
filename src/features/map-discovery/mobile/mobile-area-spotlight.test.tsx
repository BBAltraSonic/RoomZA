// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/motion/primitives", () => ({
  BlurImage: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} data-src={src} />
  ),
}));

import type { ListingCardModel } from "../lib/types";
import { MobileAreaSpotlight } from "./mobile-area-spotlight";

afterEach(cleanup);

const firstListing: ListingCardModel = {
  id: "home-1",
  title: "Mfuleni apartment",
  area: "Mfuleni, Cape Town",
  imageUrls: ["https://images.example.com/one.jpg"],
  price: 4_800,
  bedrooms: 1,
  bathrooms: 1,
  rating: null,
  reviewCount: null,
  distanceKm: 0.4,
};

describe("MobileAreaSpotlight", () => {
  it("keeps the compact two-image promo actionable", () => {
    const onOpenFirstListing = vi.fn();
    const { container } = render(
      <MobileAreaSpotlight
        location="Mfuleni"
        listingLabel="rentals"
        count={12}
        firstListing={firstListing}
        onOpenFirstListing={onOpenFirstListing}
      />,
    );

    expect(screen.getByRole("heading", { name: "Find a place in Mfuleni." })).toBeVisible();
    expect(screen.getByText("12 rentals match this map view.")).toBeVisible();
    expect(container.querySelector('[data-slot="mobile-area-spotlight"]')).toHaveClass(
      "h-[132px]",
      "rounded-[var(--radius-panel)]",
    );

    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute("data-src", firstListing.imageUrls[0]);
    expect(images[1]).toHaveAttribute("data-src", firstListing.imageUrls[0]);

    fireEvent.click(screen.getByRole("button", { name: "View first home" }));
    expect(onOpenFirstListing).toHaveBeenCalledTimes(1);
  });

  it("uses two placeholders and singular result grammar when images are missing", () => {
    const { container } = render(
      <MobileAreaSpotlight
        location="Cape Town"
        listingLabel="rentals"
        count={1}
        firstListing={{ ...firstListing, imageUrls: [] }}
        onOpenFirstListing={vi.fn()}
      />,
    );

    expect(screen.getByText("1 rental matches this map view.")).toBeVisible();
    expect(container.querySelectorAll('[data-slot="area-spotlight-image-placeholder"]')).toHaveLength(2);
  });

  it("does not render without a first listing", () => {
    const { container } = render(
      <MobileAreaSpotlight
        location="Johannesburg metro"
        listingLabel="rentals"
        count={0}
        onOpenFirstListing={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
