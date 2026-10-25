// @vitest-environment jsdom

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
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
  it("renders the renter global header with primary mobile tabs", () => {
    pathname = "/post/listings";
    render(<Navigation isAuthenticated currentRole="renter"><main>Listings content</main></Navigation>);

    expect(screen.getByRole("navigation", { name: "Account navigation" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Renter primary navigation" })).not.toBeInTheDocument();
    for (const link of screen.getAllByRole("link", { name: "My listings" })) {
      expect(link).toHaveAttribute("aria-current", "page");
    }
  });

  it("combines landlord applicants and buyers in desktop navigation", () => {
    pathname = "/dashboard/buyers";
    render(<Navigation isAuthenticated currentRole="landlord"><main>Buyer pipeline</main></Navigation>);

    expect(screen.queryByRole("link", { name: "Buyers" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Explore" })).toHaveLength(2);
    for (const link of screen.getAllByRole("link", { name: "My listings" })) {
      expect(link).toHaveAttribute("aria-current", "page");
    }
    expect(screen.queryByRole("link", { name: "Viewings" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create listing" })).toBeInTheDocument();
    expect(screen.queryByRole("search")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Rent" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Buy" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Browse map" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Landlord primary navigation" })).not.toBeInTheDocument();
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
    expect(screen.getAllByRole("link", { name: "My listings" }).some((link) => link.getAttribute("href") === "/post/listings")).toBe(true);
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

    expect(screen.getByRole("link", { name: "Create listing" })).toHaveAttribute(
      "href",
      "/post",
    );
    expect(screen.queryByRole("link", { name: "Viewings" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Explore" }).some(
      (link) => link.getAttribute("href") === "/",
    )).toBe(true);
    expect(screen.queryByRole("link", { name: "Buyers" })).not.toBeInTheDocument();
  });
});

describe("route ownership and workspace chrome", () => {
  it.each(["/saved", "/dashboard", "/applications", "/messages", "/profile", "/profile/notifications", "/settings/privacy", "/post/offers", "/post/entries/tourism", "/post/services"])(
    "uses one modern header and one account trigger at %s", (route) => {
      pathname = route;
      render(<Navigation isAuthenticated currentRole="renter"><main>Content</main></Navigation>);
      expect(document.querySelectorAll('[data-slot="workspace-header"]')).toHaveLength(1);
      expect(screen.getAllByRole("button", { name: "Account menu" })).toHaveLength(1);
      expect(screen.getByRole("link", { name: "Pinpoint home" })).toHaveTextContent("Pinpoint");
      expect(screen.queryByRole("search")).not.toBeInTheDocument();
      expect(screen.queryByRole("navigation", { name: "Discovery categories" })).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Notifications" })).toHaveAttribute("href", "/profile/notifications");
      const tabsVisible = !["/applications", "/post/offers", "/post/entries/tourism", "/post/services"].includes(route);
      expect(Boolean(document.querySelector("[data-mobile-navigation]"))).toBe(tabsVisible);
      expect(document.body).toHaveAttribute("data-mobile-nav", tabsVisible ? "visible" : "hidden");
    },
  );

  it.each(["/admin", "/admin/users", "/auth", "/auth/reset-password", "/dashboard/listings/new", "/dashboard/listings/home/edit", "/messages/conversation", "/listing/home", "/viewings/slot/live"])(
    "leaves specialized chrome to its route at %s", (route) => {
      pathname = route;
      render(<Navigation isAuthenticated currentRole="landlord"><main>Specialized content</main></Navigation>);
      expect(document.querySelector('[data-slot="workspace-header"]')).toBeNull();
      expect(screen.queryByRole("button", { name: "Account menu" })).not.toBeInTheDocument();
      expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
      expect(document.body).toHaveAttribute("data-mobile-nav", "hidden");
    },
  );

  it.each(["/blog", "/trust/verified", "/lister/person", "/neighborhoods/cape-town", "/privacy", "/terms"])(
    "keeps guest public destinations and account access at %s", (route) => {
      pathname = route;
      render(<Navigation><main>Public content</main></Navigation>);
      expect(document.querySelectorAll('[data-slot="workspace-header"]')).toHaveLength(1);
      const nav = screen.getByRole("navigation", { name: "Public navigation" });
      expect(within(nav).getByRole("link", { name: "Map" })).toHaveAttribute("href", "/");
      expect(within(nav).getByRole("link", { name: "Listings" })).toHaveAttribute("href", "/listings");
      expect(screen.getAllByRole("button", { name: "Account menu" })).toHaveLength(1);
      expect(screen.queryByRole("link", { name: "Notifications" })).not.toBeInTheDocument();
      expect(document.querySelector("[data-mobile-navigation]")).not.toBeNull();
    },
  );

  it("moves between workspace, focused and discovery routes without leaving stale navigation offsets", () => {
    pathname = "/applications";
    const { rerender, unmount } = render(<Navigation isAuthenticated currentRole="renter"><main>Content</main></Navigation>);
    expect(document.body.dataset.mobileNav).toBe("hidden");
    pathname = "/messages/conversation";
    rerender(<Navigation isAuthenticated currentRole="renter"><main>Chat</main></Navigation>);
    expect(document.body.dataset.mobileNav).toBe("hidden");
    pathname = "/";
    rerender(<Navigation isAuthenticated currentRole="renter"><main>Discovery</main></Navigation>);
    expect(document.querySelector('[data-slot="workspace-header"]')).toBeNull();
    pathname = "/profile/notifications";
    rerender(<Navigation isAuthenticated currentRole="renter"><main>Notifications</main></Navigation>);
    expect(document.body.dataset.mobileNav).toBe("visible");
    for (const link of screen.getAllByRole("link", { name: "Profile" })) {
      expect(link).toHaveAttribute("aria-current", "page");
    }
    unmount();
    expect(document.body.dataset.mobileNav).toBeUndefined();
  });
});


describe("primary mobile destinations", () => {
  it.each(["/post/listings", "/dashboard", "/settings/privacy"])("keeps Profile active for account destinations at %s", route => {
    pathname = route;
    render(<Navigation isAuthenticated><main>Account workspace</main></Navigation>);
    const nav = screen.getByRole("navigation", { name: "Primary mobile navigation" });
    expect(within(nav).getByRole("link", { name: "Profile" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Create" })).not.toHaveAttribute("aria-current");
  });
  it.each(["/", "/offers", "/services"])("keeps Explore active across discovery at %s", route => {
    pathname = route;
    render(<Navigation isAuthenticated><main>Map</main></Navigation>);
    const nav = screen.getByRole("navigation", { name: "Primary mobile navigation" });
    expect(within(nav).getByRole("link", { name: "Explore" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getAllByRole("link").map(link => link.textContent)).toEqual(["Explore", "Saved", "Create", "Messages", "Profile"]);
    expect(within(nav).getByRole("link", { name: "Create" })).toHaveAttribute("href", "/post");
  });
  it("keeps protected guest destinations and return paths", () => {
    pathname = "/";
    render(<Navigation><main>Map</main></Navigation>);
    const nav = screen.getByRole("navigation", { name: "Primary mobile navigation" });
    expect(within(nav).getByRole("link", { name: "Explore" })).toHaveAttribute("href", "/");
    for (const [label, href] of [["Saved", "/saved"], ["Create", "/post"], ["Messages", "/messages"], ["Profile", "/profile"]] as const) {
      expect(within(nav).getByRole("link", { name: label })).toHaveAttribute("href", "/auth?redirect=" + encodeURIComponent(href));
    }
  });
});
