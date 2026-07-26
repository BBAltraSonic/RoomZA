// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DiscoveryExploreSections,
  QuickFilterStrip,
  RentalBlogsSection,
} from "./explore-sections";

const scrollBy = vi.fn();

beforeEach(() => {
  scrollBy.mockReset();
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 320 });
  Object.defineProperty(HTMLElement.prototype, "scrollWidth", { configurable: true, get: () => 720 });
  Object.defineProperty(HTMLElement.prototype, "scrollLeft", { configurable: true, writable: true, value: 0 });
  Object.defineProperty(HTMLElement.prototype, "scrollBy", { configurable: true, value: scrollBy });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DiscoveryExploreSections", () => {
  it("keeps only quick filters and rental blogs in the shared responsive feed", () => {
    const { container } = render(<DiscoveryExploreSections activeQuickFilter="all" onQuickFilterChange={() => {}} listingMode="rent" />);

    expect(screen.getByRole("heading", { name: "Quick filters" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Rental tips" })).not.toBeNull();
    expect(screen.getByRole("link", { name: "Browse the blog" })).toHaveAttribute("href", "/blog");
    expect(screen.queryByRole("heading", { name: "Collections" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Guides for your move" })).toBeNull();
    expect(screen.queryByText("Move-in ready")).toBeNull();
    expect(screen.queryByText("Under R5 000")).toBeNull();

    const quickFilterHeading = screen.getByRole("heading", { name: "Quick filters" });
    const quickFilterCards = container.querySelectorAll("[data-slot='quick-filter-track'] > li");
    expect(quickFilterHeading).toHaveClass("sr-only");
    expect(quickFilterCards).toHaveLength(6);
    for (const card of quickFilterCards) {
      expect(card).toHaveClass("shrink-0", "snap-start");
      expect(card.querySelector("button")).toHaveClass("min-h-11");
    }
    expect(screen.queryByText(/Browse every home/i)).not.toBeInTheDocument();
  });
});

describe("QuickFilterStrip", () => {
  it("renders the approved order and a single active filter", () => {
    render(<QuickFilterStrip activeFilter="favourites" onFilterChange={() => {}} listingMode="rent" />);
    const filterButtons = screen.getAllByRole("button").filter((button) => button.hasAttribute("aria-pressed"));
    expect(filterButtons.map((button) => button.textContent)).toEqual([
      expect.stringContaining("All"),
      expect.stringContaining("NSFAS"),
      expect.stringContaining("Furnished"),
      expect.stringContaining("Saved"),
      expect.stringContaining("New"),
      expect.stringContaining("Viewed"),
    ]);
    expect(screen.getByRole("button", { name: "Saved" })).toHaveAttribute("aria-pressed", "true");
    expect(filterButtons.filter((button) => button.getAttribute("aria-pressed") === "true")).toHaveLength(1);
  });

  it("hides NSFAS in buy mode and provides best-effort haptic feedback", () => {
    const onFilterChange = vi.fn();
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: vibrate });
    render(<QuickFilterStrip activeFilter="all" onFilterChange={onFilterChange} listingMode="buy" />);
    expect(screen.queryByRole("button", { name: "NSFAS" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /furnished/i }));
    expect(vibrate).toHaveBeenCalledWith(10);
    expect(onFilterChange).toHaveBeenCalledWith("furnished");
  });

  it("supports keyboard and vertical-wheel scrolling without permanent arrow controls", () => {
    render(<QuickFilterStrip activeFilter="all" onFilterChange={() => {}} listingMode="rent" />);

    const track = screen.getByRole("list", { name: "Quick filters" });
    expect(screen.queryByRole("button", { name: "Scroll quick filters left" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Scroll quick filters right" })).not.toBeInTheDocument();

    fireEvent.keyDown(track, { key: "ArrowRight" });
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 272, behavior: "smooth" });

    vi.spyOn(track, "matches").mockReturnValue(true);
    fireEvent.wheel(track, { deltaX: 0, deltaY: 80 });
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 80, behavior: "auto" });

    track.scrollLeft = 100;
    fireEvent.scroll(track);
    expect(track).toHaveAttribute("data-at-start", "false");

    track.scrollLeft = 400;
    fireEvent.scroll(track);
    expect(track).toHaveAttribute("data-at-end", "true");
  });

  it("offers visible previous and next controls when requested", () => {
    render(
      <QuickFilterStrip
        activeFilter="all"
        onFilterChange={() => {}}
        listingMode="rent"
        showNavigationControls
      />,
    );

    const previous = screen.getByRole("button", { name: "Scroll quick filters left" });
    const next = screen.getByRole("button", { name: "Scroll quick filters right" });

    expect(previous).toBeDisabled();
    expect(next).toBeEnabled();
    fireEvent.click(next);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 272, behavior: "smooth" });
  });
});

describe("RentalBlogsSection", () => {
  it("links real blog content rather than rendering placeholders", () => {
    render(<RentalBlogsSection blogs={[
      { id: "one", slug: "what-to-check", title: "What to check before you view", excerpt: "Compare homes with a practical viewing checklist.", category: "Viewing" },
      { id: "two", slug: "documents-to-prepare", title: "Documents to prepare", excerpt: "Keep your application moving.", category: "Applying" },
    ]} />);

    expect(screen.getByRole("heading", { name: "Rental tips" })).not.toBeNull();
    expect(screen.getByRole("link", { name: "Read What to check before you view" })).toHaveAttribute("href", "/blog/what-to-check");
    expect(screen.getByRole("link", { name: "View all" })).toHaveAttribute("href", "/blog");
    expect(screen.getByText("Documents to prepare")).not.toBeNull();
    expect(screen.queryByText("Open houses")).toBeNull();
  });

  it("keeps the blog destination visible when no posts are published", () => {
    render(<RentalBlogsSection blogs={[]} />);

    expect(screen.getByRole("heading", { name: "Rental tips" })).not.toBeNull();
    expect(screen.getByText("Fresh reads are on the way")).not.toBeNull();
    expect(screen.getByRole("link", { name: "View all" })).toHaveAttribute("href", "/blog");
    expect(screen.getByRole("link", { name: "Browse the blog" })).toHaveAttribute("href", "/blog");
  });
});
