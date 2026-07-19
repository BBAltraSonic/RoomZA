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
  it("renders the renter sidebar and mobile tabs with Applications active", () => {
    pathname = "/applications";
    render(<Navigation isAuthenticated currentRole="renter"><main>Applications content</main></Navigation>);

    expect(screen.getByRole("navigation", { name: "Renter workspace" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Renter primary navigation" })).toBeInTheDocument();
    for (const link of screen.getAllByRole("link", { name: "Applications" })) {
      expect(link).toHaveAttribute("aria-current", "page");
    }
  });

  it("includes Buyers and keeps New listing out of the landlord primary tabs", () => {
    pathname = "/dashboard/buyers";
    render(<Navigation isAuthenticated currentRole="landlord"><main>Buyer pipeline</main></Navigation>);

    expect(screen.getAllByRole("link", { name: "Buyers" })).toHaveLength(2);
    expect(screen.getByRole("link", { name: "New listing" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Landlord primary navigation" }).querySelector('a[href="/dashboard/listings/new"]')).toBeNull();
  });

  it("suppresses global navigation on focused chat routes", () => {
    pathname = "/messages/conversation-id";
    render(<Navigation isAuthenticated currentRole="renter"><main>Chat</main></Navigation>);

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Account menu" })).not.toBeInTheDocument();
    expect(screen.getByText("Chat")).toBeInTheDocument();
  });

  it("exposes compact authenticated shortcuts inside discovery", () => {
    pathname = "/";
    render(
      <Navigation isAuthenticated currentRole="renter">
        <DiscoveryPrimaryNavigation />
      </Navigation>,
    );
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Saved" }).some((link) => link.getAttribute("href") === "/saved")).toBe(true);
    expect(screen.getAllByRole("link", { name: "Applications" }).some((link) => link.getAttribute("href") === "/applications")).toBe(true);
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
  });
});
