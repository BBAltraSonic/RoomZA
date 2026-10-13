// @vitest-environment jsdom
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NavigationContext } from "./navigation-account-context";
import { discoveryCategoryHref, PinpointHeader } from "./pinpoint-header";
import { BrandLogo } from "@/components/brand-logo";

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode; prefetch?: boolean }) => { void prefetch; return <a href={href} {...props}>{children}</a>; },
}));
afterEach(cleanup);

describe("shared Pinpoint discovery chrome", () => {
  it.each(["property", "services", "specials"] as const)("generates only map links for %s, including legacy Feed requests", category => {
    const url = new URL(discoveryCategoryHref(category, "place-id", "Cape Town", "feed"), "http://localhost");
    expect(url.searchParams.get("view")).toBe("map");
    expect(url.searchParams.get("areaId")).toBe("place-id");
    expect(url.searchParams.get("area")).toBe("Cape Town");
    render(<PinpointHeader category={category} view="feed" location={<button>Location</button>} />);
    expect(screen.queryByRole("button", { name: "Feed" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Map" })).not.toBeInTheDocument();
  });
  it("keeps Property query state, place links, counts and account context through extraction", () => {
    const propertyHref = "/?mode=buy&beds=2&listingId=home-id&areaId=place-id&view=map";
    const changeView = vi.fn();
    render(<NavigationContext.Provider value={{ audience: "renter", isAuthenticated: true, profileMenu: <button>Account</button> }}>
      <PinpointHeader category="property" areaId="place-id" area="Cape Town" count={12} propertyHref={propertyHref}
        location={<button>Choose location</button>} view="map" onViewChange={changeView} />
    </NavigationContext.Provider>);
    expect(document.querySelectorAll('[data-slot="pinpoint-header"]')).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Pinpoint home" })).toHaveTextContent("Pinpoint");
    expect(screen.getByRole("link", { name: /^Property\s*12$/ })).toHaveAttribute("href", propertyHref);
    const specials = new URL(screen.getByRole("link", { name: "Specials" }).getAttribute("href")!, "http://localhost");
    expect(specials.pathname).toBe("/offers");
    expect(specials.searchParams.get("areaId")).toBe("place-id");
    expect(specials.searchParams.get("area")).toBe("Cape Town");
    expect(specials.searchParams.get("view")).toBe("map");
    expect(screen.getByRole("link", { name: "Saved homes" })).toHaveAttribute("href", "/saved");
    expect(screen.getByRole("link", { name: "Notifications" })).toHaveAttribute("href", "/profile/notifications");
    expect(screen.getAllByRole("button", { name: "Account" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Map" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Feed" })).not.toBeInTheDocument();
    expect(changeView).not.toHaveBeenCalled();
  });

  it("preserves Refine disclosure and controlled search content", () => {
    render(<PinpointHeader category="property" location={<button>Location</button>}
      search={<form role="search"><input aria-label="Search properties" /></form>} toolbar={<button>Filters</button>} />);
    const refine = screen.getByRole("button", { name: "Show search, sorting and filters" });
    expect(refine).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(refine);
    expect(refine).toHaveAttribute("aria-expanded", "true");
    expect(document.querySelector('[data-slot="pinpoint-header"]')).toHaveAttribute("data-controls-open", "true");
    expect(screen.getByRole("search")).toBeInTheDocument();
  });

  it("keeps unavailable intake disabled and does not invent a category count", () => {
    render(<PinpointHeader category="services" location={<button>Location</button>} addUnavailable="Unavailable" />);
    expect(screen.getByRole("button", { name: "Create listing" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Services" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("button", { name: "Map" })).not.toBeInTheDocument();
  });

  it("shares a sized, singular brand with focused and admin surfaces", () => {
    const { container } = render(<BrandLogo size={16} />);
    expect(screen.getByText("Pinpoint")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).toHaveStyle({ width: "16px" });
    expect(screen.queryByText("Pinpoints")).not.toBeInTheDocument();
  });
});


describe("guest listing return paths", () => {
 it.each(["property","specials","services"] as const)("keeps the %s creation destination through sign-in", category => {
   const intended="/post/new?category="+category+"&areaId=place-id";
   render(<NavigationContext.Provider value={{ audience:"guest",isAuthenticated:false,profileMenu:null }}><PinpointHeader category={category} addHref={intended} location={<span>Choose location</span>} /></NavigationContext.Provider>);
   const link=screen.getByRole("link",{name:/Create listing/i});
   const href=new URL(link.getAttribute("href")!,"https://example.com");
   expect(href.pathname).toBe("/auth");expect(href.searchParams.get("redirect")).toBe(intended);
 });
});
