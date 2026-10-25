// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useState } from "react";
import { DiscoveryShell } from "./discovery-shell";
import { DiscoveryDetailSurface } from "./discovery-detail-surface";
import { DiscoveryResultsSummary } from "./discovery-results-summary";
import { DiscoverySearch } from "@/components/navigation/discovery-search-dock";

beforeEach(() => {
  window.sessionStorage.clear();
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ matches: query.includes("max-width"), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function Browse({ category = "service", count = 4, loading = false, error = false, retry = vi.fn() }: {
  category?: string; count?: number; loading?: boolean; error?: boolean; retry?: () => void;
}) {
  const [detail, setDetail] = useState(false);
  return <DiscoveryShell sheetKey={category} resultsLabel="Nearby results" detailLabel="Listing details" resultCount={loading || error ? undefined : count}
    resultsSummary={<DiscoveryResultsSummary label="Services" count={count} loading={loading} error={error} onRetry={retry} />}
    header={<header>Navigation<DiscoverySearch view="map"><input aria-label="Search listings" /></DiscoverySearch></header>}
    map={<button>Map marker</button>}
    results={<div><button onClick={() => setDetail(true)}>Open listing</button><p>Listing cards</p></div>}
    detail={detail ? <DiscoveryDetailSurface label="Listing details" onClose={() => setDetail(false)}><button onClick={() => setDetail(false)}>Back to results</button><p>Complete details</p></DiscoveryDetailSurface> : undefined} />;
}
const sheet = () => document.querySelector<HTMLElement>("[data-snap]")!;

it("starts in Peek and supports Browse, Full List and Show map without dragging", () => {
  render(<Browse />);
  expect(sheet()).toHaveAttribute("data-snap", "peek");
  expect(screen.queryByText("Listing cards")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "↑ 4 listings" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "↑ 4 listings" }));
  expect(sheet()).toHaveAttribute("data-snap", "browse");
  expect(screen.getByText("Listing cards")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "↑ Full list" }));
  expect(sheet()).toHaveAttribute("data-snap", "full");
  fireEvent.click(screen.getByRole("button", { name: "↓ Show map" }));
  expect(sheet()).toHaveAttribute("data-snap", "peek");
});

it("keeps one search input docked and promotes Peek without lowering Full List", () => {
  render(<Browse />);
  const input = screen.getByRole("textbox", { name: "Search listings" });
  expect(input.closest('[data-slot="discovery-search-dock"]')).not.toBeNull();
  fireEvent.focus(input);
  expect(sheet()).toHaveAttribute("data-snap", "browse");
  fireEvent.click(screen.getByRole("button", { name: "↑ Full list" }));
  fireEvent.focus(input);
  expect(sheet()).toHaveAttribute("data-snap", "full");
  expect(screen.getAllByRole("textbox")).toHaveLength(1);
});

it("persists positions separately for Services, Shopping, Places and Events", () => {
  for (const [category, snap] of [["service", "browse"], ["shopping", "full"], ["tourism", "browse"], ["event", "peek"]] as const) {
    render(<Browse category={category} />);
    expect(sheet()).toHaveAttribute("data-snap", "peek");
    if (snap !== "peek") fireEvent.click(screen.getByRole("button", { name: "Browse listings" }));
    if (snap === "full") fireEvent.click(screen.getByRole("button", { name: "↑ Full list" }));
    cleanup();
    render(<Browse category={category} />);
    expect(sheet()).toHaveAttribute("data-snap", snap);
    cleanup();
  }
});

it("shows loading, failed refresh with retry, and empty states in Peek", () => {
  const retry = vi.fn();
  const view = render(<Browse loading />);
  expect(screen.getByRole("status")).toHaveTextContent("Checking services");
  expect(screen.queryByRole("button", { name: "↑ 4 listings" })).not.toBeInTheDocument();
  view.rerender(<Browse error retry={retry} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Previous results kept");
  fireEvent.click(screen.getByRole("button", { name: "Retry services" }));
  expect(retry).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Browse listings" }));
  expect(screen.getByText("Listing cards")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Open full listings list" }));
  fireEvent.click(screen.getByRole("button", { name: "↓ Show map" }));
  view.rerender(<Browse count={0} />);
  expect(screen.getByRole("status")).toHaveTextContent("No matching listings");
  expect(screen.queryByRole("button", { name: "↑ 0 listings" })).not.toBeInTheDocument();
});

it("restores Browse and the prior scroll position after contained detail dismissal", () => {
  render(<Browse />);
  fireEvent.click(screen.getByRole("button", { name: "Browse listings" }));
  const scroller = document.querySelector<HTMLElement>(".scroll-contained")!;
  Object.defineProperties(scroller, { scrollHeight: { value: 2000 }, clientHeight: { value: 500 } });
  scroller.scrollTop = 240;
  fireEvent.scroll(scroller);
  fireEvent.click(screen.getByRole("button", { name: "Open listing" }));
  const details = screen.getByRole("group", { name: "Listing details" });
  expect(details.closest('[data-slot="mobile-detail-sheet"]')).not.toBeNull();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByText("Navigation")).toBeVisible();
  expect(screen.getByRole("button", { name: "Map marker" })).toBeVisible();
  expect(within(details).getByRole("button", { name: "Back to results" })).toHaveFocus();
  fireEvent.keyDown(details, { key: "Escape" });
  expect(sheet()).toHaveAttribute("data-snap", "browse");
  expect(document.querySelector<HTMLElement>(".scroll-contained")!.scrollTop).toBe(240);
});

it("ignores invalid stored positions and works when storage is unavailable", () => {
  window.sessionStorage.setItem("pinpoint:discovery-sheet:service", "invalid");
  const view = render(<Browse />);
  expect(sheet()).toHaveAttribute("data-snap", "peek");
  view.unmount();
  const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  render(<Browse />);
  fireEvent.click(screen.getByRole("button", { name: "Browse listings" }));
  expect(sheet()).toHaveAttribute("data-snap", "browse");
  get.mockRestore(); set.mockRestore();
});

it("keeps desktop results and map operable while details float over the map", () => {
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ matches: query.includes("min-width"), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  render(<Browse />);
  fireEvent.click(screen.getByRole("button", { name: "Open listing" }));
  expect(screen.getByText("Listing cards")).toBeVisible();
  expect(screen.getByRole("button", { name: "Map marker" })).toBeVisible();
  const details = document.querySelector('[data-slot="desktop-floating-details"]')!;
  expect(details.closest('[aria-label="Discovery map"]')).not.toBeNull();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Expand listing details" }));
  expect(details).toHaveAttribute("data-expanded", "true");
  fireEvent.click(screen.getByRole("button", { name: "Back to results" }));
  expect(document.querySelector('[data-slot="desktop-floating-details"]')).toBeNull();
  expect(screen.getByText("Listing cards")).toBeVisible();
});
