// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FilterBar } from "./filter-bar";

describe("FilterBar scroll density", () => {
  it("keeps Instant Connect filters inside the full filter panel", () => {
    const { rerender, unmount } = render(
      <FilterBar
        filters={{ availableNow: true }}
        onFilterChange={vi.fn()}
        condensed
      />,
    );

    expect(screen.queryByRole("button", { name: "Available Now" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Live Video Tours" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Instant Viewings" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Replies Under 5 Minutes" })).toBeNull();

    rerender(
      <FilterBar
        filters={{ availableNow: true }}
        onFilterChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Available Now" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Live Video Tours" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Instant Viewings" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Replies Under 5 Minutes" })).toBeTruthy();

    unmount();
  });

  it("keeps accessible chip names when labels collapse", () => {
    render(
      <FilterBar
        filters={{ beds: 2, propertyTypes: ["apartment"] }}
        onFilterChange={vi.fn()}
        density="minimal"
        condensed
      />,
    );

    expect(screen.getByRole("button", { name: "Type: 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Beds: 2+" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Price" })).toBeTruthy();
  });

  it("opens mobile dropdowns below top-anchored filter rows", () => {
    render(
      <FilterBar
        filters={{}}
        onFilterChange={vi.fn()}
        dropdownPlacement="bottom"
        condensed
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Type" }));

    const dropdown = screen
      .getAllByRole("heading", { name: "Property types" })
      .map((heading) => heading.parentElement)
      .find((element) => element?.classList.contains("lg:hidden"));
    expect(dropdown).toBeTruthy();
    expect(dropdown?.classList.contains("top-[calc(100%+0.5rem)]")).toBe(true);
    expect(dropdown?.classList.contains("bottom-[calc(100%+0.5rem)]")).toBe(false);
  });
});
