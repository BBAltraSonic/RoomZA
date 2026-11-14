// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DiscoveryShell } from "@/features/discovery/discovery-shell";
import { DiscoverySheetPanel } from "./discovery-search-dock";
import { PinpointHeader, type DiscoveryCategory } from "./pinpoint-header";

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode; prefetch?: boolean }) => { void prefetch; return <a href={href} {...props}>{children}</a>; },
}));

function stubViewport(desktop: boolean) {
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
    matches: query.includes(desktop ? "min-width" : "max-width"), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })));
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.sessionStorage.clear(); });

function header(category: DiscoveryCategory = "property", panel?: ReactNode) {
  return <PinpointHeader category={category} location={<button>Location</button>}
    search={<form role="search"><input aria-label="Search properties" /></form>}
    toolbar={<><button>Sort by price</button>{panel}</>} />;
}

function Screen({ category = "property", panel }: { category?: DiscoveryCategory; panel?: ReactNode }) {
  return <DiscoveryShell resultsLabel="Homes near the map" header={header(category, panel)} map={<p>Map</p>} results={<p>Listing cards</p>} />;
}

const pinpointHeader = () => document.querySelector<HTMLElement>('[data-slot="pinpoint-header"]')!;
const sheetToolbar = () => document.querySelector<HTMLElement>('[data-slot="discovery-sheet-toolbar"]');

describe("discovery browse controls", () => {
  it("sit in the results panel on desktop, next to the results they change", () => {
    stubViewport(true);
    render(<Screen />);

    const controls = screen.getByRole("button", { name: "Sort by price" });
    const panel = screen.getByLabelText("Homes near the map");
    expect(panel).toContainElement(controls);
    expect(controls.closest('[data-slot="discovery-toolbar-dock"]')).not.toBeNull();
    expect(pinpointHeader()).not.toContainElement(controls);
    expect(sheetToolbar()).toBeNull();
    expect(screen.getAllByRole("button", { name: "Sort by price" })).toHaveLength(1);
  });

  it.each(["property", "specials", "services"] as const)("move into the bottom sheet on mobile for %s, so the header never expands", category => {
    stubViewport(false);
    render(<Screen category={category} />);

    const controls = screen.getByRole("button", { name: "Sort by price" });
    expect(sheetToolbar()).toContainElement(controls);
    expect(pinpointHeader()).not.toContainElement(controls);
    expect(pinpointHeader()).not.toContainElement(screen.getByRole("search"));
    expect(screen.queryByRole("button", { name: /Refine|Show search, sorting and filters/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Sort by price" })).toHaveLength(1);
  });

  it("open expanding panels inside the bottom sheet on mobile instead of under the header", () => {
    stubViewport(false);
    render(<Screen panel={<DiscoverySheetPanel><section aria-label="More listing filters">Filters</section></DiscoverySheetPanel>} />);

    const panel = screen.getByRole("region", { name: "More listing filters" });
    expect(panel.closest('[data-slot="discovery-sheet-panel"]')).not.toBeNull();
    expect(pinpointHeader()).not.toContainElement(panel);
  });

  it("keep expanding panels in place on desktop", () => {
    stubViewport(true);
    render(<Screen panel={<DiscoverySheetPanel><section aria-label="More listing filters">Filters</section></DiscoverySheetPanel>} />);

    const panel = screen.getByRole("region", { name: "More listing filters" });
    expect(panel.closest('[data-slot="discovery-sheet-panel"]')).toBeNull();
  });

  it("stay in the header when the screen has no results panel or sheet", () => {
    render(header());

    expect(pinpointHeader()).toContainElement(screen.getByRole("button", { name: "Sort by price" }));
  });
});
