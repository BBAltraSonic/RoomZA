// @vitest-environment jsdom

import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { ListingDetail } from "./listing-detail-panel";

const holder = vi.hoisted(() => ({
  mapProps: {} as Record<string, unknown>,
  params: new URLSearchParams(),
  onViewListing: null as null | ((listingId: string) => void),
}));

const routerMock = {
  replace: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
  prefetch: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useSearchParams: () => holder.params,
  usePathname: () => "/",
  useRouter: () => routerMock,
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children?: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/hooks/use-on-click-outside", () => ({ useOnClickOutside: () => {} }));
vi.mock("@/lib/hooks/use-scroll-adaptation", () => ({
  useScrollAdaptation: () => ({ chrome: "expanded", onScroll: vi.fn() }),
}));
vi.mock("./hooks/use-favorites", () => ({
  useFavorites: () => ({
    authenticated: true,
    error: null,
    isFavorite: () => false,
    toggleFavorite: vi.fn(),
  }),
}));

vi.mock("./map-view-loader", () => ({
  MapViewLoader: (props: Record<string, unknown>) => {
    holder.mapProps = props;
    holder.onViewListing = props.onViewListing as (listingId: string) => void;
    return <div data-testid="map-view-loader" />;
  },
}));

vi.mock("./listing-detail-panel", () => ({
  ListingDetailPanel: ({
    listing,
    compact,
    onBack,
  }: {
    listing: { id: string };
    compact?: boolean;
    onBack?: () => void;
  }) => (
    <div data-testid="listing-detail-panel" data-listing-id={listing.id} data-compact={String(Boolean(compact))}>
      <button type="button" onClick={onBack}>Close {listing.id}</button>
    </div>
  ),
}));

vi.mock("@/components/premium/property-card", () => ({
  PropertyCard: () => <div />,
  SaveIconButton: () => <button type="button">Save</button>,
}));
vi.mock("./map-controls", () => ({ MapControls: () => <div /> }));
vi.mock("./empty-state-capture", () => ({ EmptyStateCapture: () => <div /> }));
vi.mock("./quick-filter-empty-state", () => ({ QuickFilterEmptyState: () => <div /> }));
vi.mock("./filter-bar", () => ({ FilterBar: () => <div /> }));
vi.mock("./mobile/mobile-discovery-shell", () => ({
  MobileDiscoveryShell: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));
vi.mock("./mobile/bottom-sheet", () => ({ MobileBottomSheet: () => <div /> }));
vi.mock("./mobile/listing-carousel", () => ({ ListingCarousel: () => <div /> }));
vi.mock("./mobile/explore-sections", () => ({ DiscoveryExploreSections: () => <div /> }));

import { DiscoveryPage } from "./discovery-page";

function listing(id: string): ListingDetail {
  return {
    id,
    title: `Listing ${id}`,
    address: "1 Test Road",
    latitude: -26.2,
    longitude: 28.04,
  } as ListingDetail;
}

beforeEach(() => {
  holder.mapProps = {};
  holder.params = new URLSearchParams();
  holder.onViewListing = null;
  routerMock.prefetch.mockClear();
  routerMock.push.mockClear();
  vi.stubGlobal("fetch", vi.fn((input: string | URL | Request) => {
    const id = String(input).split("/").pop()?.split("?")[0] ?? "replacement";
    return Promise.resolve({
      ok: true,
      json: async () => ({ ok: true, data: listing(id) }),
    } as Response);
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("desktop property-detail expansion", () => {
  it("switches only the shell width while preserving compact content geometry", async () => {
    const { container } = render(<DiscoveryPage initialListing={listing("first")} />);

    const rail = screen.getByRole("complementary", { name: "Property details" });
    const inner = rail.querySelector('[data-slot="desktop-detail-content"]');
    await screen.findAllByTestId("listing-detail-panel");
    const desktopDetail = inner?.querySelector('[data-testid="listing-detail-panel"]');
    const map = screen.getByTestId("map-view-loader");

    expect(rail).toHaveClass("w-[clamp(340px,30vw,480px)]");
    expect(inner).toHaveClass("w-[clamp(340px,30vw,480px)]", "max-w-full");
    expect(desktopDetail).toHaveAttribute("data-compact", "true");
    expect(map.parentElement).toHaveClass("min-w-0");
    expect(container.querySelector("main")).toHaveClass("overflow-hidden");
    expect(holder.mapProps.detailPanelExpanded).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Expand property details" }));

    expect(rail).toHaveClass("w-[clamp(560px,50vw,760px)]");
    expect(rail).not.toHaveClass("w-[clamp(340px,30vw,480px)]");
    expect(inner).toHaveClass("w-[clamp(340px,30vw,480px)]");
    expect(desktopDetail).toHaveAttribute("data-compact", "true");
    expect(screen.getByRole("button", { name: "Collapse property details" })).toHaveAttribute("aria-expanded", "true");
    expect(holder.mapProps.detailPanelExpanded).toBe(true);
  });

  it("keeps expansion for a replacement listing and resets it after closure", async () => {
    render(<DiscoveryPage initialListing={listing("first")} />);

    fireEvent.click(screen.getByRole("button", { name: "Expand property details" }));
    expect(screen.getByRole("complementary", { name: "Property details" })).toHaveAttribute("data-expanded", "true");

    await act(async () => {
      holder.onViewListing?.("second");
    });

    expect(routerMock.push).toHaveBeenCalledWith("/?listingId=second", { scroll: false });

    await waitFor(() => {
      expect(screen.getAllByTestId("listing-detail-panel").some((panel) => panel.getAttribute("data-listing-id") === "second")).toBe(true);
    });
    expect(screen.getByRole("complementary", { name: "Property details" })).toHaveAttribute("data-expanded", "true");

    fireEvent.click(screen.getAllByRole("button", { name: "Close second" })[0]!);
    expect(screen.queryByRole("complementary", { name: "Property details" })).toBeNull();

    await act(async () => {
      holder.onViewListing?.("third");
    });

    await waitFor(() => {
      expect(screen.getByRole("complementary", { name: "Property details" })).toHaveAttribute("data-expanded", "false");
    });
    expect(screen.getByRole("button", { name: "Expand property details" })).toHaveAttribute("aria-expanded", "false");
  });
});

function deferredBody() {
  let resolve!: (value: unknown) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<unknown>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe("detail response parsing races", () => {
  it("keeps the newer selection when an aborted response finishes parsing", async () => {
    const body = deferredBody();
    vi.stubGlobal("fetch", vi.fn(async (input: unknown) => ({ ok: true, json: () => String(input).endsWith("/old") ? body.promise : Promise.resolve({ ok: true, data: listing("new") }) })));
    render(<DiscoveryPage initialListing={listing("initial")} />);
    await act(async () => { holder.onViewListing?.("old"); });
    await act(async () => { holder.onViewListing?.("new"); });
    await screen.findAllByTestId("listing-detail-panel");
    await act(async () => { body.resolve({ ok: true, data: listing("old") }); });
    for (const panel of screen.getAllByTestId("listing-detail-panel")) expect(panel).toHaveAttribute("data-listing-id", "new");
  });
  it("does not show an older parsing failure over a successfully loaded selection", async () => {
    const body = deferredBody();
    vi.stubGlobal("fetch", vi.fn(async (input: unknown) => ({ ok: true, json: () => String(input).endsWith("/old") ? body.promise : Promise.resolve({ ok: true, data: listing("new") }) })));
    render(<DiscoveryPage initialListing={listing("initial")} />);
    await act(async () => { holder.onViewListing?.("old"); });
    await act(async () => { holder.onViewListing?.("new"); });
    await act(async () => { body.reject(new Error("Late parse failure")); });
    expect(screen.queryByRole("alert")).toBeNull();
    for (const panel of await screen.findAllByTestId("listing-detail-panel")) expect(panel).toHaveAttribute("data-listing-id", "new");
  });
  it("does not reopen a detail panel closed while its response was parsing", async () => {
    const body = deferredBody();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: () => body.promise })));
    render(<DiscoveryPage initialListing={listing("initial")} />);
    await screen.findAllByTestId("listing-detail-panel");
    await act(async () => { holder.onViewListing?.("old"); });
    fireEvent.click(screen.getAllByRole("button", { name: "Close initial" })[0]!);
    await act(async () => { body.resolve({ ok: true, data: listing("old") }); });
    expect(screen.queryByTestId("listing-detail-panel")).toBeNull();
  });
  it("rejects a prior-market response after back/forward changes the market", async () => {
    const body = deferredBody();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: () => body.promise })));
    const view = render(<DiscoveryPage initialListing={listing("initial")} />);
    await act(async () => { holder.onViewListing?.("old"); });
    holder.params = new URLSearchParams("mode=buy"); view.rerender(<DiscoveryPage initialListing={listing("initial")} />);
    await act(async () => { body.resolve({ ok: true, data: listing("old") }); });
    for (const panel of await screen.findAllByTestId("listing-detail-panel")) expect(panel).not.toHaveAttribute("data-listing-id", "old");
  });
  it("ignores a response after a different map marker is selected", async () => {
    const body = deferredBody();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: () => body.promise })));
    render(<DiscoveryPage initialListing={listing("initial")} />);
    await act(async () => { holder.onViewListing?.("old"); });
    await act(async () => { (holder.mapProps.onSelectListing as (id: string) => void)("different"); });
    await act(async () => { body.resolve({ ok: true, data: listing("old") }); });
    expect(screen.queryByTestId("listing-detail-panel")).toBeNull();
  });
});
