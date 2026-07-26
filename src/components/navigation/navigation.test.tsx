// @vitest-environment jsdom

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

let pathname = "/";

vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("./profile-menu", () => ({ ProfileMenu: () => <button type="button">Account menu</button> }));

import { DiscoveryPrimaryNavigation, Navigation } from "./navigation";

afterEach(cleanup);

describe("app navigation shell", () => {
  it("renders the renter global header and mobile tabs with Applications active", () => {
    pathname = "/applications";
    render(<Navigation isAuthenticated currentRole="renter"><main>Applications content</main></Navigation>);

    expect(screen.getByRole("navigation", { name: "Renter workspace" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Renter primary navigation" })).toBeInTheDocument();
    for (const link of screen.getAllByRole("link", { name: "Applications" })) {
      expect(link).toHaveAttribute("aria-current", "page");
    }
  });

  it("combines landlord applicants and buyers and adds Explore on desktop and mobile", () => {
    pathname = "/dashboard/buyers";
    render(<Navigation isAuthenticated currentRole="landlord"><main>Buyer pipeline</main></Navigation>);

    expect(screen.queryByRole("link", { name: "Buyers" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Explore" })).toHaveLength(2);
    for (const link of screen.getAllByRole("link", { name: "Applicants" })) {
      expect(link).toHaveAttribute("aria-current", "page");
    }
    expect(screen.getAllByRole("link", { name: "Viewings" })).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Add listing" })).toBeInTheDocument();
    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Browse map" })).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Landlord primary navigation" }).querySelector('a[href="/dashboard/listings/new"]')).toBeNull();
  });

  it("does not duplicate the map return above renter workspaces", () => {
    pathname = "/applications";
    render(<Navigation isAuthenticated currentRole="renter"><main>Applications content</main></Navigation>);

    expect(screen.queryByRole("link", { name: "Browse map" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Explore" })).not.toHaveLength(0);
  });

  it("suppresses global navigation on focused chat routes", () => {
    pathname = "/messages/conversation-id";
    render(<Navigation isAuthenticated currentRole="renter"><main>Chat</main></Navigation>);

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Account menu" })).not.toBeInTheDocument();
    expect(screen.getByText("Chat")).toBeInTheDocument();
  });

  it("exposes every renter destination inside the global discovery navigation", () => {
    pathname = "/";
    render(
      <Navigation isAuthenticated currentRole="renter">
        <DiscoveryPrimaryNavigation />
      </Navigation>,
    );
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Explore" }).some((link) => link.getAttribute("href") === "/")).toBe(true);
    expect(screen.getAllByRole("link", { name: "Saved" }).some((link) => link.getAttribute("href") === "/saved")).toBe(true);
    expect(screen.getAllByRole("link", { name: "Applications" }).some((link) => link.getAttribute("href") === "/applications")).toBe(true);
    expect(screen.getAllByRole("link", { name: "Messages" }).some((link) => link.getAttribute("href") === "/messages")).toBe(true);
    expect(screen.getAllByRole("link", { name: "Profile" }).some((link) => link.getAttribute("href") === "/profile")).toBe(true);
  });

  it("gives landlords an add-listing control in desktop discovery", () => {
    pathname = "/";
    render(
      <Navigation isAuthenticated currentRole="landlord">
        <DiscoveryPrimaryNavigation />
      </Navigation>,
    );

    expect(screen.getByRole("link", { name: "Add listing" })).toHaveAttribute(
      "href",
      "/dashboard/listings/new",
    );
    expect(screen.getAllByRole("link", { name: "Viewings" }).some(
      (link) => link.getAttribute("href") === "/dashboard/viewings",
    )).toBe(true);
    expect(screen.getAllByRole("link", { name: "Explore" }).some(
      (link) => link.getAttribute("href") === "/",
    )).toBe(true);
    expect(screen.queryByRole("link", { name: "Buyers" })).not.toBeInTheDocument();
  });
});
