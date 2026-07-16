// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/hooks/use-horizontal-scroll-affordance", () => ({
  useHorizontalScrollAffordance: () => ({
    setScrollElement: vi.fn(),
    onScroll: vi.fn(),
    onWheel: vi.fn(),
    atStart: true,
    atEnd: false,
    canScroll: true,
    progress: 0,
  }),
}));

vi.mock("./listing-card", () => ({
  ListingCard: () => <div data-testid="listing-card" />,
}));

import { ListingCarousel } from "./listing-carousel";
import type { ListingCardModel } from "../lib/types";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ListingCarousel geometry", () => {
  it("matches loading skeletons to the compact panoramic card layout", () => {
    const { container } = render(
      <ListingCarousel
        cards={[]}
        isLoading
        error={null}
        onRetry={() => {}}
        onSelectCard={() => {}}
      />,
    );

    const track = container.querySelector('[data-slot="listing-carousel-track"]');
    const carousel = track?.parentElement;
    const skeletons = container.querySelectorAll('[data-slot="listing-card-skeleton"]');

    expect(track).toHaveClass("gap-3", "px-4", "pb-1");
    expect(carousel).not.toHaveClass("motion-stage", "motion-stage-cards");
    expect(carousel).toHaveAttribute("role", "status");
    expect(carousel).toHaveAttribute("aria-label", "Loading listings");
    expect(track).not.toHaveClass("scroll-edge-fade");
    expect(skeletons).toHaveLength(3);

    for (const skeleton of skeletons) {
      expect(skeleton).toHaveClass("w-[88vw]", "max-w-[390px]", "rounded-2xl");
      expect(skeleton.querySelector(".aspect-\\[2\\/1\\]")).toBeInTheDocument();
      expect(skeleton.querySelector(".h-10.rounded-full")).toBeInTheDocument();
      expect(skeleton.querySelector(".px-4.pb-2.pt-1\\.5")).toBeInTheDocument();
    }
  });

  it("caps the compact indicator row at five and omits the extra progress treatment", () => {
    const cards: ListingCardModel[] = Array.from({ length: 7 }, (_, index) => ({
      id: `listing-${index}`,
      title: `Listing ${index}`,
      imageUrls: [],
      price: 10_000 + index,
      bedrooms: 2,
      bathrooms: 1,
      rating: null,
      reviewCount: null,
      distanceKm: index,
    }));

    const { container } = render(
      <ListingCarousel
        cards={cards}
        isLoading={false}
        error={null}
        onRetry={() => {}}
        onSelectCard={() => {}}
      />,
    );

    const indicators = container.querySelector('[data-slot="listing-carousel-indicators"]');
    expect(indicators?.children).toHaveLength(5);
    expect(indicators).toHaveClass("gap-1");
    expect(container.querySelector(".scroll-progress-track")).not.toBeInTheDocument();
  });

  it("progressively renders large result sets as the visitor browses", () => {
    const cards: ListingCardModel[] = Array.from({ length: 24 }, (_, index) => ({
      id: `listing-${index}`,
      title: `Listing ${index}`,
      imageUrls: [],
      price: 10_000 + index,
      bedrooms: 2,
      bathrooms: 1,
      rating: null,
      reviewCount: null,
      distanceKm: index,
    }));

    const { container, getAllByTestId } = render(
      <ListingCarousel
        cards={cards}
        isLoading={false}
        error={null}
        onRetry={() => {}}
        onSelectCard={() => {}}
      />,
    );

    expect(getAllByTestId("listing-card")).toHaveLength(8);

    const track = container.querySelector<HTMLElement>('[data-slot="listing-carousel-track"]')!;
    Object.defineProperties(track, {
      scrollLeft: { configurable: true, value: 1200 },
      clientWidth: { configurable: true, value: 400 },
      scrollWidth: { configurable: true, value: 1600 },
    });
    fireEvent.scroll(track);

    expect(getAllByTestId("listing-card")).toHaveLength(16);
  });
});
