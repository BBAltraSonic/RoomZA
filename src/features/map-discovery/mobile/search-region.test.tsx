// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LISTING_SEARCH_QUERY_MAX_LENGTH } from "@/features/listings/search-query";
import { SearchRegion } from "./search-region";

afterEach(cleanup);

describe("mobile SearchRegion", () => {
  it("offers an accessible submit control and submits the form", () => {
    const onSearchSubmit = vi.fn();
    render(
      <SearchRegion
        searchQuery="Braam"
        onSearchChange={() => {}}
        onSearchSubmit={onSearchSubmit}
        onToggleFilters={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(onSearchSubmit).toHaveBeenCalledTimes(1);
  });

  it("limits the mobile search input to the shared query length", () => {
    render(
      <SearchRegion
        searchQuery=""
        onSearchChange={() => {}}
        onSearchSubmit={() => {}}
        onToggleFilters={() => {}}
      />,
    );

    expect(screen.getByRole("combobox")).toHaveAttribute(
      "maxlength",
      String(LISTING_SEARCH_QUERY_MAX_LENGTH),
    );
  });

  it("offers Clear for committed location state even when the visible query is empty", () => {
    const onClearSearch = vi.fn();
    render(
      <SearchRegion
        searchQuery=""
        searchActive
        onSearchChange={() => {}}
        onSearchSubmit={() => {}}
        onClearSearch={onClearSearch}
        onToggleFilters={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(onClearSearch).toHaveBeenCalledTimes(1);
  });

  it("dismisses an open suggestion surface on outside pointer interaction", () => {
    const onDismissSearchSuggestions = vi.fn();
    render(
      <SearchRegion
        searchQuery="Sea Point"
        onSearchChange={() => {}}
        onSearchSubmit={() => {}}
        onToggleFilters={() => {}}
        suggestions={[{ id: "recent-sea-point", label: "Sea Point", source: "recent" }]}
        suggestionsOpen
        onDismissSearchSuggestions={onDismissSearchSuggestions}
      />,
    );

    expect(screen.getByRole("option", { name: "Sea Point" })).toBeInTheDocument();
    fireEvent.mouseDown(document.body);

    expect(onDismissSearchSuggestions).toHaveBeenCalledTimes(1);
  });
});
