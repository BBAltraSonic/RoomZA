// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/lib/motion/primitives", async importOriginal => ({
  ...(await importOriginal<object>()),
  MotionReveal: ({ children, className }: { children: ReactNode; className?: string }) => <div className={className}>{children}</div>,
}));

import { buildMyListings, type CategoryLoad, type ListingCategory } from "./my-listings";
import { ManagedItemList, MyListingsView } from "./my-listings-view";

const none: CategoryLoad = { count: 0, hasMore: false, error: null };
const loads = (overrides: Partial<Record<ListingCategory, CategoryLoad>> = {}) => ({
  property: none, services: none, offers: none, places: none, events: none, ...overrides,
});
afterEach(cleanup);

const createLinks = () => screen.queryAllByRole("link", { name: /^Create/ });

describe("MyListingsView", () => {
  it("has one Create listing action and the sections it was given", () => {
    const view = buildMyListings(loads({ property: { count: 1, hasMore: false, error: null }, services: { count: 1, hasMore: false, error: null } }), null);
    render(<MyListingsView view={view} importAllowed={false} sections={{ property: <p>Property cards</p>, services: <p>Service rows</p> }} />);
    expect(screen.getByRole("heading", { level: 1, name: "My listings" })).toBeInTheDocument();
    expect(createLinks()).toHaveLength(1);
    expect(createLinks()[0]).toHaveAttribute("href", "/post");
    expect(screen.getByRole("region", { name: "Property" })).toHaveTextContent("Property cards");
    expect(screen.getByRole("region", { name: "Services" })).toHaveTextContent("Service rows");
    expect(screen.getByRole("navigation", { name: "Filter listings" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "All my listings" })).not.toBeInTheDocument();
  });

  it("offers Import listings as a quiet text link only when allowed", () => {
    const view = buildMyListings(loads({ property: { count: 1, hasMore: false, error: null } }), null);
    const { rerender } = render(<MyListingsView view={view} importAllowed={false} sections={{ property: null }} />);
    expect(screen.queryByRole("link", { name: "Import listings" })).not.toBeInTheDocument();
    rerender(<MyListingsView view={view} importAllowed sections={{ property: null }} />);
    expect(screen.getByRole("link", { name: "Import listings" })).toHaveAttribute("href", "/dashboard/imports/new");
    expect(screen.queryByRole("navigation", { name: "Filter listings" })).not.toBeInTheDocument();
  });

  it("shows a single create button when there is nothing listed yet", () => {
    render(<MyListingsView view={buildMyListings(loads(), null)} importAllowed={false} sections={{}} />);
    expect(createLinks()).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Create your first listing" })).toHaveAttribute("href", "/post");
  });

  it("explains a category that could not load instead of hiding it", () => {
    const view = buildMyListings(loads({ offers: { count: 0, hasMore: false, error: "Shopping Specials could not load." } }), null);
    render(<MyListingsView view={view} importAllowed={false} sections={{}} />);
    expect(within(screen.getByRole("region", { name: "Shopping Specials" })).getByRole("alert")).toHaveTextContent("could not load");
  });
});

describe("ManagedItemList", () => {
  it("links each listing to its editor and offers the full list only when there is more", () => {
    const items = [{ id: "a", title: "Saturday market", status: "Private draft", href: "/post/entries/event/a" }];
    const { rerender } = render(<ManagedItemList items={items} hasMore={false} moreHref="/post/entries/event" />);
    expect(screen.getByRole("link", { name: /Saturday market/ })).toHaveAttribute("href", "/post/entries/event/a");
    expect(screen.getByText("Private draft")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "See all" })).not.toBeInTheDocument();
    rerender(<ManagedItemList items={items} hasMore moreHref="/post/entries/event" />);
    expect(screen.getByRole("link", { name: "See all" })).toHaveAttribute("href", "/post/entries/event");
  });
});
