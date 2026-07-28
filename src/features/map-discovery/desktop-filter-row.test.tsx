// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { DesktopFilterRow } from "./desktop-filter-row";

afterEach(cleanup);

describe("DesktopFilterRow", () => {
  it("keeps primary filters and quick filters visible while secondary filters stay behind More filters", () => {
    const { container } = render(
      <DesktopFilterRow
        filters={{}}
        onFilterChange={vi.fn()}
        activeQuickFilter="all"
        onQuickFilterChange={vi.fn()}
        listingMode="rent"
        resultCount={12}
        isLoading={false}
        activeFilterCount={0}
        moreFiltersOpen={false}
        onToggleMoreFilters={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Type" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Price" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Beds" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "All homes" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "NSFAS" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Furnished" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Saved" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "More filters" })).toBeTruthy();
    expect(container.querySelector('[data-slot="desktop-filter-row"]')).toHaveClass(
      "min-h-14",
      "px-6",
      "py-2",
    );
    expect(screen.getByRole("button", { name: "All homes" })).toHaveClass("h-9");

    expect(screen.queryByRole("button", { name: "Available Now" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Live Video Tours" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Instant Viewings" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Replies Under 5 Minutes" })).toBeNull();
  });

  it("routes quick-filter and More filters actions to the discovery page", () => {
    const onQuickFilterChange = vi.fn();
    const onToggleMoreFilters = vi.fn();

    render(
      <DesktopFilterRow
        filters={{ beds: 2 }}
        onFilterChange={vi.fn()}
        activeQuickFilter="all"
        onQuickFilterChange={onQuickFilterChange}
        listingMode="rent"
        resultCount={8}
        isLoading={false}
        activeFilterCount={1}
        moreFiltersOpen={false}
        onToggleMoreFilters={onToggleMoreFilters}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Furnished" }));
    fireEvent.click(screen.getByRole("button", { name: "More filters" }));

    expect(onQuickFilterChange).toHaveBeenCalledWith("furnished");
    expect(onToggleMoreFilters).toHaveBeenCalledTimes(1);
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("removes the rent-only NSFAS shortcut in buy mode", () => {
    render(
      <DesktopFilterRow
        filters={{}}
        onFilterChange={vi.fn()}
        activeQuickFilter="all"
        onQuickFilterChange={vi.fn()}
        listingMode="buy"
        resultCount={5}
        isLoading={false}
        activeFilterCount={0}
        moreFiltersOpen={false}
        onToggleMoreFilters={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "NSFAS" })).toBeNull();
  });
});
