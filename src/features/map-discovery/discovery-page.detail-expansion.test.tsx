// @vitest-environment jsdom

import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { ListingDetail } from "./listing-detail-panel";

const holder = vi.hoisted(() => ({
  mapProps: {} as Record<string, unknown>,
  onViewListing: null as null | ((listingId: string) => void),
}));

const routerMock = {
  replace: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
  prefetch: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
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
