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
const unreadMessages = vi.hoisted(() => ({ count: 0, calls: [] as [boolean, unknown][] }));
vi.mock("@/features/chat/unread-messages", () => ({
  useUnreadMessageCount: (enabled: boolean, refreshKey: unknown) => {
    unreadMessages.calls.push([enabled, refreshKey]);
    return enabled ? unreadMessages.count : 0;
  },
}));

const headerAccountTriggers = () => document.querySelectorAll('[data-placement="header"]');
const dockAssistant = () => document.querySelector<HTMLElement>("[data-mobile-navigation] [data-mobile-assistant]");
const workspaceHeader = () => document.querySelector<HTMLElement>('[data-slot="workspace-header"]')!;

import { DiscoveryPrimaryNavigation, Navigation } from "./navigation";

afterEach(() => {
  cleanup();
  unreadMessages.count = 0;
  unreadMessages.calls = [];
});

describe("app navigation shell", () => {
  it("renders the renter global header with primary mobile tabs", () => {
    pathname = "/post/listings";
    render(<Navigation isAuthenticated currentRole="renter"><main>Listings content</main></Navigation>);

    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeInTheDocument();
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
  it.each(["/saved", "/dashboard", "/applications", "/messages", "/profile", "/profile/notifications", "/settings/privacy", "/post/offers", "/post/entries/tourism"])(
    "uses one modern header and one account trigger at %s", (route) => {
      pathname = route;
      render(<Navigation isAuthenticated currentRole="renter"><main>Content</main></Navigation>);
      expect(document.querySelectorAll('[data-slot="workspace-header"]')).toHaveLength(1);
      expect(headerAccountTriggers()).toHaveLength(1);
      expect(screen.getByRole("link", { name: "Pinpoint home" })).toHaveTextContent("Pinpoint");
      expect(screen.queryByRole("search")).not.toBeInTheDocument();
      expect(screen.queryByRole("navigation", { name: "Discovery categories" })).not.toBeInTheDocument();
      expect(within(workspaceHeader()).getByRole("link", { name: "Notifications" })).toHaveAttribute("href", "/profile/notifications");
      const tabsVisible = !["/applications", "/post/offers", "/post/entries/tourism"].includes(route);
      expect(Boolean(document.querySelector("[data-mobile-navigation]"))).toBe(tabsVisible);
      expect(Boolean(dockAssistant())).toBe(tabsVisible);
      // The profile circle stays in the header on every screen size.
      expect(headerAccountTriggers()[0]?.classList.contains("max-lg:hidden!")).toBe(false);
      expect(document.body).toHaveAttribute("data-mobile-nav", tabsVisible ? "visible" : "hidden");
      // Phones hide the header's icon buttons wherever the dock already carries them.
      expect(workspaceHeader()).toHaveAttribute("data-mobile-dock", tabsVisible ? "visible" : "hidden");
    },
  );

  it.each([["/post", false], ["/post/listings", false], ["/dashboard", false], ["/saved", true], ["/profile", true], ["/dashboard/buyers", true]] as const)(
    "shows the header Create listing at %s only when the page has no create button of its own", (route, shown) => {
      pathname = route;
      render(<Navigation isAuthenticated currentRole="landlord"><main>Content</main></Navigation>);
      expect(within(workspaceHeader()).queryAllByRole("link", { name: "Create listing" })).toHaveLength(shown ? 1 : 0);
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
    "gives guests the members' header navigation, routing account pages through sign-in, at %s", (route) => {
      pathname = route;
      render(<Navigation><main>Public content</main></Navigation>);
      expect(document.querySelectorAll('[data-slot="workspace-header"]')).toHaveLength(1);
      const nav = screen.getByRole("navigation", { name: "Main navigation" });
      expect(within(nav).getAllByRole("link").map(link => link.textContent)).toEqual(["Explore", "Saved", "My listings", "Messages", "Profile"]);
      expect(within(nav).getByRole("link", { name: "Explore" })).toHaveAttribute("href", "/");
      for (const [label, href] of [["Saved", "/saved"], ["My listings", "/post/listings"], ["Messages", "/messages"], ["Profile", "/profile"]] as const) {
        expect(within(nav).getByRole("link", { name: label })).toHaveAttribute("href", "/auth?redirect=" + encodeURIComponent(href));
      }
      expect(headerAccountTriggers()).toHaveLength(1);
      expect(within(workspaceHeader()).getByRole("link", { name: "Notifications" })).toHaveAttribute("href", "/profile/notifications");
      expect(document.querySelector("[data-mobile-navigation]")).not.toBeNull();
      expect(dockAssistant()).not.toBeNull();
    },
  );

  it("renders identical header and dock destinations for guests and members", () => {
    pathname = "/listings";
    const destinations = () => [
      ...within(screen.getByRole("navigation", { name: "Main navigation" })).getAllByRole("link"),
      ...within(screen.getByRole("navigation", { name: "Primary mobile navigation" })).getAllByRole("link"),
    ].map(link => link.textContent);
    const { rerender } = render(<Navigation><main>Listings</main></Navigation>);
    const guest = destinations();
    rerender(<Navigation isAuthenticated currentRole="renter"><main>Listings</main></Navigation>);
    expect(destinations()).toEqual(guest);
  });

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
  const assistantSlot = () => dockNav().querySelector<HTMLElement>("[data-mobile-assistant]")!;

  const pillLinks = () => within(dockNav().querySelector<HTMLElement>("[data-mobile-pill]")!).getAllByRole("link");

  it("floats over the map on desktop discovery and stays phone-only on workspaces", () => {
    pathname = "/";
    const { rerender } = render(<Navigation isAuthenticated><main>Map</main></Navigation>);
    expect(dockNav()).toHaveAttribute("data-over-map", "true");
    expect(dockNav().className).not.toContain("lg:hidden");
    pathname = "/saved";
    rerender(<Navigation isAuthenticated><main>Saved</main></Navigation>);
    expect(dockNav()).not.toHaveAttribute("data-over-map");
    expect(dockNav().className).toContain("lg:hidden");
  });
  it("sends the assistant circle to Explore on pages without an assistant, asking it to open there", () => {
    pathname = "/saved";
    render(<Navigation isAuthenticated><main>Saved</main></Navigation>);
    expect(assistantSlot()).toHaveAttribute("href", "/");
    assistantSlot().click();
    expect(sessionStorage.getItem("pinpoint:open-assistant")).toBe("1");
    sessionStorage.clear();
  });
  it("lays out a yellow Create, the Explore/Saved/Notifications/Messages pill, then the assistant circle", () => {
    pathname = "/";
    render(<Navigation isAuthenticated><main>Map</main></Navigation>);
    const nav = dockNav();
    expect(pillLinks().map(link => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Explore", "/"],
      ["Saved", "/saved"],
      ["Notifications", "/profile/notifications"],
      ["Messages", "/messages"],
    ]);
    const create = within(nav).getByRole("link", { name: "Create" });
    expect(within(nav).getAllByRole("link")[0]).toBe(create);
    expect(create).toHaveAttribute("href", "/post");
    expect(create).toHaveAttribute("data-accent", "brand");
    // The circle shares its last slot with Piko's pop-up, which floats above it.
    expect(nav.lastElementChild?.lastElementChild?.lastElementChild).toBe(assistantSlot());
    expect(assistantSlot()).toHaveAccessibleName("Ask Piko");
    expect(within(nav).queryByRole("button", { name: "Account menu" })).not.toBeInTheDocument();
  });
  it("shows guests the same dock and sends protected destinations through sign-in", () => {
    pathname = "/";
    render(<Navigation><main>Map</main></Navigation>);
    expect(pillLinks().map(link => link.textContent)).toEqual(["Explore", "Saved", "Notifications", "Messages"]);
    const nav = dockNav();
    expect(within(nav).getByRole("link", { name: "Explore" })).toHaveAttribute("href", "/");
    for (const [label, href] of [["Create", "/post"], ["Saved", "/saved"], ["Notifications", "/profile/notifications"], ["Messages", "/messages"]] as const) {
      expect(within(nav).getByRole("link", { name: label })).toHaveAttribute("href", "/auth?redirect=" + encodeURIComponent(href));
    }
  });
  it.each([["/messages", "Messages"], ["/saved", "Saved"], ["/profile/notifications", "Notifications"]])("marks %s active in the pill", (route, label) => {
    pathname = route;
    render(<Navigation isAuthenticated><main>Workspace</main></Navigation>);
    expect(pillLinks().filter(link => link.getAttribute("aria-current") === "page").map(link => link.textContent)).toEqual([label]);
  });
  it("shows the label only on the selected pill item, which hugs it while the others share the rest", () => {
    pathname = "/saved";
    render(<Navigation isAuthenticated><main>Saved</main></Navigation>);
    const shown = pillLinks().map(link => [link.textContent, link.querySelector("[data-pill-label]")?.getAttribute("data-visible")]);
    expect(shown).toEqual([["Explore", "false"], ["Saved", "true"], ["Notifications", "false"], ["Messages", "false"]]);
    const [explore, saved] = pillLinks() as [HTMLElement, HTMLElement];
    expect(saved.className).toContain("shrink-0");
    expect(saved.className).not.toContain("flex-1");
    expect(explore.className).toContain("flex-1");
  });
  it.each(["/", "/offers"])("keeps Explore active across discovery for members at %s", route => {
    pathname = route;
    render(<Navigation isAuthenticated><main>Map</main></Navigation>);
    expect(within(dockNav()).getByRole("link", { name: "Explore" })).toHaveAttribute("aria-current", "page");
  });
  it("marks Create active only on the create chooser", () => {
    pathname = "/post";
    render(<Navigation isAuthenticated><main>Create</main></Navigation>);
    expect(within(dockNav()).getByRole("link", { name: "Create" })).toHaveAttribute("aria-current", "page");
  });
  it("shows the unread message count on Messages", () => {
    unreadMessages.count = 3;
    pathname = "/";
    render(<Navigation isAuthenticated><main>Map</main></Navigation>);
    const messages = within(dockNav()).getByRole("link", { name: /^Messages/ });
    expect(messages).toHaveAccessibleName("Messages, 3 unread");
    expect(unreadMessages.calls.at(-1)?.[0]).toBe(true);
  });
  it("caps large unread message counts", () => {
    unreadMessages.count = 140;
    pathname = "/";
    render(<Navigation isAuthenticated><main>Map</main></Navigation>);
    expect(within(dockNav()).getByRole("link", { name: /^Messages/ })).toHaveTextContent("99+");
  });
  it("never asks for unread messages while signed out", () => {
    unreadMessages.count = 3;
    pathname = "/";
    render(<Navigation><main>Map</main></Navigation>);
    expect(unreadMessages.calls.every(([enabled]) => enabled === false)).toBe(true);
  });
});

describe("Piko's dock alert", () => {
  it("pops Piko up above the assistant circle when a saved search has a new match", async () => {
    const { NotificationContext } = await import("@/features/notifications/notification-provider");
    const { MobilePrimaryNavigation } = await import("./mobile-primary-navigation");
    localStorage.clear();
    const value = {
      userId: "user-1", unreadCount: 1, serverNow: "", enabled: true, error: null, refresh: async () => {}, change: async () => true,
      items: [{ id: "m1", title: "Saved search match", message: "A new home matches your saved search.", createdAt: "2026-11-24T10:00:00Z", unread: true, href: "/listing/x", category: "saved_searches" }],
    };
    render(<NotificationContext.Provider value={value}><MobilePrimaryNavigation pathname="/" isAuthenticated overMap /></NotificationContext.Provider>);
    const slot = document.querySelector<HTMLElement>("[data-mobile-navigation] [data-dock-assistant-slot]")!;
    // The pop-up loads on its own chunk, so it arrives a moment after the dock.
    expect(await within(slot).findByRole("status")).toHaveTextContent("Something interesting just popped up!");
    expect(within(slot).getByRole("link", { name: "See the match" })).toHaveAttribute("href", "/listing/x");
    expect(slot.querySelector("[data-mobile-assistant]")).not.toBeNull();
  });
});

describe("dock beside Piko's chat on desktop", () => {
  it("ends the floating dock at the open chat's left edge instead of under it", async () => {
    const { useRegisterDockAssistant } = await import("@/features/piko/dock-assistant");
    const { MobilePrimaryNavigation } = await import("./mobile-primary-navigation");
    function Page({ open }: { open: boolean }) {
      useRegisterDockAssistant(open, () => {});
      return <MobilePrimaryNavigation pathname="/" isAuthenticated={false} overMap />;
    }
    const { rerender } = render(<Page open={false} />);
    const nav = screen.getByRole("navigation", { name: "Primary mobile navigation" });
    expect(nav).not.toHaveAttribute("data-assistant-open");
    expect(nav.className).not.toContain("--assistant-panel-width");
    rerender(<Page open />);
    expect(nav).toHaveAttribute("data-assistant-open", "true");
    expect(nav.className).toContain("lg:right-[calc(var(--assistant-panel-width)+1rem)]");
    // Too narrow beside the chat below 1280px: the dock steps away until the chat closes.
    expect(nav.className).toContain("lg:max-xl:hidden");
  });

  it("leaves phones alone, where the chat already sits above the dock", async () => {
    const { useRegisterDockAssistant } = await import("@/features/piko/dock-assistant");
    const { MobilePrimaryNavigation } = await import("./mobile-primary-navigation");
    function Page() {
      useRegisterDockAssistant(true, () => {});
      return <MobilePrimaryNavigation pathname="/saved" isAuthenticated={false} />;
    }
    render(<Page />);
    const nav = screen.getByRole("navigation", { name: "Primary mobile navigation" });
    expect(nav).not.toHaveAttribute("data-assistant-open");
  });
});
