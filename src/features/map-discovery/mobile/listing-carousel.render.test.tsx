// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./listing-card", () => ({
  ListingCard: ({ card }: { card: ListingCardModel }) => (
    <div data-testid="listing-card" data-listing-id={card.id} />
  ),
}));

import { ListingCarousel } from "./listing-carousel";
import type { ListingCardModel } from "../lib/types";

// Capture observed IntersectionObserver instances so tests can drive the
// infinite-scroll sentinel deterministically (jsdom has no real observer).
type ObserverEntry = { callback: IntersectionObserverCallback; elements: Set<Element> };
let observers: ObserverEntry[] = [];

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds = [];
  private entry: ObserverEntry;
  constructor(callback: IntersectionObserverCallback) {
    this.entry = { callback, elements: new Set() };
    observers.push(this.entry);
  }
  observe(element: Element) {
    this.entry.elements.add(element);
  }
  unobserve(element: Element) {
    this.entry.elements.delete(element);
  }
  disconnect() {
    this.entry.elements.clear();
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

/** Fire an intersection for every currently-observed sentinel. */
function triggerIntersection() {
  act(() => {
    for (const observer of observers) {
      if (observer.elements.size === 0) continue;
      const entries = [...observer.elements].map(
        (target) => ({ isIntersecting: true, target }) as IntersectionObserverEntry,
      );
      observer.callback(entries, {} as IntersectionObserver);
    }
  });
}

beforeEach(() => {
  observers = [];
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function makeCards(count: number): ListingCardModel[] {
  return Array.from({ length: count }, (_, index) => ({
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
}

describe("ListingCarousel geometry", () => {
  it("renders skeletons in a full-width vertical stack while loading", () => {
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

    expect(track).toHaveClass("flex", "flex-col", "gap-4", "px-4", "pb-1");
    expect(track).not.toHaveClass("overflow-x-auto");
    expect(carousel).not.toHaveClass("motion-stage", "motion-stage-cards");
    expect(carousel).toHaveAttribute("role", "status");
    expect(carousel).toHaveAttribute("aria-label", "Loading listings");
    expect(skeletons).toHaveLength(3);

    for (const skeleton of skeletons) {
      expect(skeleton).toHaveClass("w-full", "rounded-2xl");
      expect(skeleton).not.toHaveClass("w-[88vw]");
    }
  });

  it("does not render horizontal page-indicator dots", () => {
    const { container } = render(
      <ListingCarousel
        cards={makeCards(7)}
        isLoading={false}
        error={null}
        onRetry={() => {}}
        onSelectCard={() => {}}
      />,
    );

    expect(container.querySelector('[data-slot="listing-carousel-indicators"]')).not.toBeInTheDocument();
  });

  it("progressively renders large result sets as the sentinel scrolls into view", () => {
    const { getAllByTestId } = render(
      <ListingCarousel
        cards={makeCards(24)}
        isLoading={false}
        error={null}
        onRetry={() => {}}
        onSelectCard={() => {}}
      />,
    );

    expect(getAllByTestId("listing-card")).toHaveLength(8);

    triggerIntersection();
    expect(getAllByTestId("listing-card")).toHaveLength(16);

    triggerIntersection();
    expect(getAllByTestId("listing-card")).toHaveLength(24);
  });

  it("renders and scrolls a previewed marker's card into view without moving focus", () => {
    const { getAllByTestId } = render(
      <ListingCarousel
        cards={makeCards(24)}
        previewedListingId="listing-15"
        isLoading={false}
        error={null}
        onRetry={() => {}}
        onSelectCard={() => {}}
      />,
    );

    expect(getAllByTestId("listing-card")).toHaveLength(16);
    const previewedCard = document.querySelector('[data-listing-id="listing-15"]');
    const previewWrapper = previewedCard?.parentElement;
    expect(previewWrapper).not.toBeNull();
    expect(previewWrapper?.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "nearest",
    });
    expect(document.activeElement).not.toBe(previewWrapper);
  });
});
