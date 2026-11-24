// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { QuickFilterEmptyState } from "./quick-filter-empty-state";

afterEach(cleanup);

const mood = (container: HTMLElement) => container.querySelector("[data-piko-mood]")?.getAttribute("data-piko-mood") ?? null;

describe("QuickFilterEmptyState", () => {
  it("should_show_piko_looking_around_when_an_area_has_no_homes", () => {
    const { container } = render(<QuickFilterEmptyState filter="all" onClear={vi.fn()} />);
    expect(mood(container)).toBe("noResults");
    expect(screen.getByRole("status")).toHaveTextContent("No homes in this area");
  });

  it("should_show_piko_resting_when_nothing_is_saved_yet", () => {
    const { container } = render(<QuickFilterEmptyState filter="favourites" onClear={vi.fn()} />);
    expect(mood(container)).toBe("empty");
  });

  it("should_greet_guests_who_open_favourites", () => {
    const { container } = render(<QuickFilterEmptyState filter="favourites" authenticated={false} onClear={vi.fn()} />);
    expect(mood(container)).toBe("hello");
  });

  it("should_keep_the_plain_icon_when_saved_homes_fail_to_load", () => {
    const { container } = render(<QuickFilterEmptyState filter="favourites" favoritesError onClear={vi.fn()} />);
    expect(mood(container)).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
