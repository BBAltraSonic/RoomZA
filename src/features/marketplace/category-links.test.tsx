// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CategoryLinks } from "./category-links";

afterEach(cleanup);

describe("CategoryLinks", () => {
  it("should_render_each_category_as_its_own_tile_in_a_two_column_grid", () => {
    render(<CategoryLinks />);
    const nav = screen.getByRole("navigation", { name: "Listing categories" });
    const links = within(nav).getAllByRole("link");
    expect(links.map(link => link.getAttribute("href"))).toEqual([
      "/dashboard/listings/new", "/post/offers", "/post/entries/tourism", "/post/entries/event",
    ]);
    expect(within(nav).getByRole("list").className).toContain("grid-cols-2");
  });

  it("should_only_stretch_the_last_tile_when_the_count_is_odd", () => {
    render(<CategoryLinks />);
    const items = screen.getAllByRole("listitem");
    const spanning = items.filter(item => item.className.includes("col-span-2"));
    expect(spanning).toEqual(items.length % 2 === 1 ? [items.at(-1)] : []);
  });
});
