// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FilterBar } from "./filter-bar";

describe("FilterBar scroll density", () => {
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
