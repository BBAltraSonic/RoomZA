// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DiscoveryShell } from "@/features/discovery/discovery-shell";
import { PinpointHeader } from "./pinpoint-header";

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode; prefetch?: boolean }) => { void prefetch; return <a href={href} {...props}>{children}</a>; },
}));

function stubViewport(desktop: boolean) {
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
    matches: query.includes(desktop ? "min-width" : "max-width"), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })));
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.sessionStorage.clear(); });

const header = <PinpointHeader category="property" location={<button>Location</button>}
  search={<form role="search"><input aria-label="Search properties" /></form>}
  toolbar={<button>Sort by price</button>} />;

function Screen() {
  return <DiscoveryShell resultsLabel="Homes near the map" header={header} map={<p>Map</p>} results={<p>Listing cards</p>} />;
}

describe("discovery browse controls", () => {
  it("sit in the results panel on desktop, next to the results they change", () => {
    stubViewport(true);
    render(<Screen />);

    const controls = screen.getByRole("button", { name: "Sort by price" });
    const panel = screen.getByLabelText("Homes near the map");
    expect(panel).toContainElement(controls);
    expect(controls.closest('[data-slot="discovery-toolbar-dock"]')).not.toBeNull();
    expect(document.querySelector('[data-slot="pinpoint-header"]')).not.toContainElement(controls);
    expect(screen.getAllByRole("button", { name: "Sort by price" })).toHaveLength(1);
  });

  it("stay behind Refine in the header on mobile, where the panel is a sheet", () => {
    stubViewport(false);
    render(<Screen />);

    const controls = screen.getByRole("button", { name: "Sort by price" });
    expect(document.querySelector('[data-slot="pinpoint-header"]')).toContainElement(controls);
    expect(document.querySelector('[data-slot="discovery-toolbar-dock"]')).toBeNull();
    const refine = screen.getByRole("button", { name: "Show search, sorting and filters" });
    fireEvent.click(refine);
    expect(refine).toHaveAttribute("aria-expanded", "true");
  });

  it("stay in the header when the screen has no results panel", () => {
    render(header);

    expect(document.querySelector('[data-slot="pinpoint-header"]')).toContainElement(screen.getByRole("button", { name: "Sort by price" }));
  });
});
