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
vi.mock("./profile-menu", () => ({
  ProfileMenu: ({ placement = "header", className }: { placement?: string; className?: string }) => <button type="button" data-placement={placement} className={className}>Account menu</button>,
}));

const headerAccountTriggers = () => document.querySelectorAll('[data-placement="header"]');
const dockAccountTriggers = () => document.querySelectorAll('[data-mobile-navigation] [data-placement="dock"]');
const workspaceHeader = () => document.querySelector<HTMLElement>('[data-slot="workspace-header"]')!;

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
      expect(headerAccountTriggers()).toHaveLength(1);
      expect(screen.getByRole("link", { name: "Pinpoint home" })).toHaveTextContent("Pinpoint");
      expect(screen.queryByRole("search")).not.toBeInTheDocument();
      expect(screen.queryByRole("navigation", { name: "Discovery categories" })).not.toBeInTheDocument();
      expect(within(workspaceHeader()).getByRole("link", { name: "Notifications" })).toHaveAttribute("href", "/profile/notifications");
      const tabsVisible = !["/applications", "/post/offers", "/post/entries/tourism", "/post/services"].includes(route);
      expect(Boolean(document.querySelector("[data-mobile-navigation]"))).toBe(tabsVisible);
      expect(dockAccountTriggers()).toHaveLength(tabsVisible ? 1 : 0);
      // The header keeps its profile circle on desktop, and on phones only where the bottom dock is absent.
      expect(headerAccountTriggers()[0]?.classList.contains("max-lg:hidden!")).toBe(tabsVisible);
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

  it.each(["/trust", "/trust/verified", "/lister/person", "/neighborhoods/cape-town", "/privacy", "/terms"])(
    "keeps guest public destinations and account access at %s", (route) => {
      pathname = route;
      render(<Navigation><main>Public content</main></Navigation>);
      expect(document.querySelectorAll('[data-slot="workspace-header"]')).toHaveLength(1);
      const nav = screen.getByRole("navigation", { name: "Public navigation" });
      expect(within(nav).getByRole("link", { name: "Map" })).toHaveAttribute("href", "/");
      expect(within(nav).getByRole("link", { name: "Listings" })).toHaveAttribute("href", "/listings");
      expect(headerAccountTriggers()).toHaveLength(1);
      expect(within(workspaceHeader()).queryByRole("link", { name: "Notifications" })).not.toBeInTheDocument();
      expect(document.querySelector("[data-mobile-navigation]")).not.toBeNull();
      expect(dockAccountTriggers()).toHaveLength(1);
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
    const dock = screen.getByRole("navigation", { name: "Primary mobile navigation" });
    expect(within(dock).getByRole("link", { name: "Notifications" })).toHaveAttribute("aria-current", "page");
    unmount();
    expect(document.body.dataset.mobileNav).toBeUndefined();
  });
});


describe("primary mobile destinations", () => {
  const dockNav = () => screen.getByRole("navigation", { name: "Primary mobile navigation" });
  const accountSlot = () => dockNav().querySelector("[data-mobile-account]")!;

  it("lays out Create, the Explore/Saved/Notifications pill, then the account menu", () => {
    pathname = "/";
    render(<Navigation isAuthenticated><main>Map</main></Navigation>);
    const nav = dockNav();
    expect(within(nav).getAllByRole("link").map(link => link.textContent)).toEqual(["Create", "Explore", "Saved", "Notifications"]);
    const pill = nav.querySelector("[data-mobile-pill]")!;
    expect(within(pill as HTMLElement).getAllByRole("link").map(link => link.textContent)).toEqual(["Explore", "Saved", "Notifications"]);
    expect(within(nav).getByRole("link", { name: "Create" })).toHaveAttribute("href", "/post");
    expect(within(nav).getByRole("link", { name: "Notifications" })).toHaveAttribute("href", "/profile/notifications");
    expect(within(nav).getByRole("button", { name: "Account menu" })).toHaveAttribute("data-placement", "dock");
    expect(nav.lastElementChild?.lastElementChild).toBe(accountSlot());
  });
  it.each(["/post/listings", "/dashboard", "/settings/privacy", "/messages", "/profile"])("marks the account menu active for account destinations at %s", route => {
    pathname = route;
    render(<Navigation isAuthenticated><main>Account workspace</main></Navigation>);
    expect(accountSlot()).toHaveAttribute("data-active", "true");
    for (const link of within(dockNav()).getAllByRole("link")) expect(link).not.toHaveAttribute("aria-current");
  });
  it.each(["/", "/offers", "/services"])("keeps Explore active across discovery at %s", route => {
    pathname = route;
    render(<Navigation isAuthenticated><main>Map</main></Navigation>);
    expect(within(dockNav()).getByRole("link", { name: "Explore" })).toHaveAttribute("aria-current", "page");
    expect(accountSlot()).not.toHaveAttribute("data-active");
  });
  it("marks Create active only on the create chooser", () => {
    pathname = "/post";
    render(<Navigation isAuthenticated><main>Create</main></Navigation>);
    expect(within(dockNav()).getByRole("link", { name: "Create" })).toHaveAttribute("aria-current", "page");
  });
  it("keeps protected guest destinations and return paths", () => {
    pathname = "/";
    render(<Navigation><main>Map</main></Navigation>);
    const nav = dockNav();
    expect(within(nav).getByRole("link", { name: "Explore" })).toHaveAttribute("href", "/");
    for (const [label, href] of [["Saved", "/saved"], ["Create", "/post"], ["Notifications", "/profile/notifications"]] as const) {
      expect(within(nav).getByRole("link", { name: label })).toHaveAttribute("href", "/auth?redirect=" + encodeURIComponent(href));
    }
  });
  it("shows a placeholder account circle while the session loads", () => {
    pathname = "/";
    render(<Navigation status="loading"><main>Map</main></Navigation>);
    expect(within(dockNav()).getByRole("status", { name: "Loading account" })).toBeInTheDocument();
  });
});
