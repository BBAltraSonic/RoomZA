// @vitest-environment jsdom
//
// Task 6.4 — Card_Pipeline wiring and selected-listing reconciliation.
//
// Verifies, at the orchestrator (DiscoveryPage) integration level, that a
// successful Viewport_Query flows through the capped -> model -> mostNearestSort
// pipeline into the Map_Surface markers, that marker order matches the
// Card_Pipeline (card) order, that the Marker_Cap is applied, and that a
// returned set that omits the currently selected listing clears the selection.
//
// Requirements: 1.3 (replace displayed listings), 1.6 (clear absent selection),
// 7.1 (Marker_Cap of 200), 8.1 (marker order matches card order).
//
// The Map_Surface (browser-only) and the mobile presentational shell/sheet
// (owned by the mobile-map-discovery spec) are mocked; the mocked MapViewLoader
// is the observation point for `markerListings` and `selectedListingId`, and the
// source of `onBoundsChange` / `onSelectListing` used to drive the orchestrator.
// The pure Card_Pipeline (cap, distance, sort, marker-sync) runs for real inside
// DiscoveryPage.

import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";

import { capListings } from "./lib/cap";
import { haversineKm, resolveDistanceOrigin } from "./lib/distance";
import { mostNearestSort } from "./lib/sort";
import type { ListingCardModel, ViewportBounds } from "./lib/types";

// --- Mocks -----------------------------------------------------------------

// Shared holder for the latest props the orchestrator passes to the map, plus
// the navigation doubles. Hoisted so it is available inside vi.mock factories.
const harness = vi.hoisted(() => ({
  mapProps: null as null | {
    listings: Array<{ id: string }>;
    selectedListingId?: string;
    onBoundsChange?: (bounds: ViewportBounds) => void;
    onSelectListing?: (id: string) => void;
  },
  router: {
    replace: vi.fn(),
    push: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  },
  searchParams: new URLSearchParams(""),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => harness.router,
  usePathname: () => "/",
  useSearchParams: () => harness.searchParams,
}));

// Observation point: render the derived markerListings (in order) and the
// current selectedListingId so the test can read them from the DOM.
vi.mock("./map-view-loader", () => ({
  MapViewLoader: (props: typeof harness.mapProps & Record<string, unknown>) => {
    harness.mapProps = props as typeof harness.mapProps;
    const listings = (props?.listings ?? []) as Array<{ id: string }>;
    const selectedListingId = (props?.selectedListingId ?? "") as string;
    return (
      <div data-testid="map-view">
        <div data-testid="markers">
          {listings.map((marker, index) => (
            <span
              key={marker.id}
              data-testid="marker"
              data-id={marker.id}
              data-index={index}
            />
          ))}
        </div>
        <span data-testid="selected-id">{selectedListingId}</span>
      </div>
    );
  },
}));

// Presentational containers owned by the mobile-map-discovery spec — out of
// scope for this pipeline test and dependent on browser gesture/resize APIs.
vi.mock("./mobile/mobile-discovery-shell", () => ({
  MobileDiscoveryShell: () => <div data-testid="mobile-shell" />,
}));
vi.mock("./mobile/bottom-sheet", () => ({
  MobileBottomSheet: () => <div data-testid="bottom-sheet" />,
}));
vi.mock("./mobile/listing-card", () => ({
  ListingCard: () => <div data-testid="listing-card" />,
}));
vi.mock("./mobile/listing-carousel", () => ({
  ListingCarousel: () => <div data-testid="listing-carousel" />,
}));
vi.mock("./mobile/explore-sections", () => ({
  LifestyleStrip: () => <div data-testid="lifestyle-strip" />,
  OpenHousesSection: () => <div data-testid="open-houses" />,
  RentalBlogsSection: () => <div data-testid="rental-blogs" />,
}));

// Heavy client subtrees / I/O hooks. `use-favorites` is the critical one: the
// real hook calls `createClient()` which throws on the missing Supabase env in
// the test environment, so it must be neutralized (as the sibling
// discovery-page.*.test.tsx suites do).
vi.mock("./hooks/use-favorites", () => ({
  useFavorites: () => ({ isFavorite: () => false, toggleFavorite: vi.fn() }),
}));
vi.mock("@/lib/hooks/use-on-click-outside", () => ({
  useOnClickOutside: () => {},
}));

vi.mock("@/components/premium/property-card", () => ({
  PropertyCard: () => <div data-testid="property-card" />,
  SaveIconButton: () => <div data-testid="save-icon" />,
}));
vi.mock("./listing-detail-panel", () => ({
  ListingDetailPanel: () => <div data-testid="listing-detail-panel" />,
}));
vi.mock("./map-controls", () => ({ MapControls: () => <div data-testid="map-controls" /> }));
vi.mock("./empty-state-capture", () => ({
  EmptyStateCapture: () => <div data-testid="empty-state" />,
}));
vi.mock("./filter-bar", () => ({
  FilterBar: () => <div data-testid="filter-bar" />,
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt } = props as { src?: string; alt?: string };
    return <img src={typeof src === "string" ? src : ""} alt={alt ?? ""} />;
  },
}));
vi.mock("next/link", () => ({
  default: (props: { href?: unknown; children?: React.ReactNode }) => (
    <a href={typeof props.href === "string" ? props.href : "#"}>{props.children}</a>
  ),
}));

// Imported after the mocks are registered.
import { DiscoveryPage } from "./discovery-page";

// --- Test data helpers -----------------------------------------------------

type ApiListing = {
  id: string;
  title: string;
  area: string;
  price: number;
  latitude: number;
  longitude: number;
  bedrooms: number;
  bathrooms: number;
  imageUrls: string[];
  availabilityDate: string | null;
  created_at: string | null;
};

function makeListing(overrides: Partial<ApiListing> & { id: string }): ApiListing {
  return {
    title: `Title ${overrides.id}`,
    area: "Cape Town",
    price: 10000,
    latitude: -33.9,
    longitude: 18.4,
    bedrooms: 2,
    bathrooms: 1,
    imageUrls: [],
    availabilityDate: null,
    created_at: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// Compute the expected marker id order by replaying the exact Card_Pipeline the
// orchestrator uses (geolocation unavailable in jsdom -> origin is the bounds
// midpoint), so the assertion is independent of hand-computed distances.
function expectedMarkerOrder(listings: ApiListing[], bounds: ViewportBounds): string[] {
  const origin = resolveDistanceOrigin(null, bounds);
  const capped = capListings(listings);
  const models: ListingCardModel[] = capped.map((listing) => ({
    id: listing.id,
    title: listing.title,
    imageUrls: listing.imageUrls,
    price: listing.price,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    rating: null,
    reviewCount: null,
    distanceKm: origin
      ? haversineKm(origin, { lat: listing.latitude, lng: listing.longitude })
      : null,
  }));
  return mostNearestSort(models).map((card) => card.id);
}

// Queue of viewport payloads consumed one-per-Viewport_Query.
let fetchQueue: ApiListing[][] = [];

function queueViewport(listings: ApiListing[]) {
  fetchQueue.push(listings);
}

function markerIds(): string[] {
  return Array.from(document.querySelectorAll('[data-testid="marker"]')).map(
    (node) => node.getAttribute("data-id") ?? "",
  );
}

function selectedId(): string {
  return document.querySelector('[data-testid="selected-id"]')?.textContent ?? "";
}

// Drive a new Viewport_Bounds (which triggers a Viewport_Query) and wait for the
// queued payload to be applied to the markers.
async function loadViewport(bounds: ViewportBounds) {
  await act(async () => {
    harness.mapProps?.onBoundsChange?.(bounds);
  });
  await waitFor(() => {
    expect(harness.mapProps).not.toBeNull();
  });
}

// --- Suite -----------------------------------------------------------------

const BOUNDS_A: ViewportBounds = { west: 18, south: -34, east: 19, north: -33 };
const BOUNDS_B: ViewportBounds = { west: 28, south: -26, east: 29, north: -25 };

beforeEach(() => {
  harness.mapProps = null;
  harness.searchParams = new URLSearchParams("");
  harness.router.replace.mockClear();
  harness.router.prefetch.mockClear();
  fetchQueue = [];

  // jsdom does not implement scrollIntoView; DiscoveryPage's selected card
  // scrolls itself into view on selection. Provide a no-op so selection works.
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }

  vi.stubGlobal(
    "fetch",
    vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => {
      const payload = fetchQueue.shift() ?? [];
      return Promise.resolve({
        ok: true,
        json: async () => ({ ok: true, data: { listings: payload } }),
      } as Response);
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DiscoveryPage Card_Pipeline wiring", () => {
  it("replaces displayed markers via the capped -> sorted pipeline in card order (Req 1.3, 8.1)", async () => {
    // Input order is deliberately not nearest-first so we can prove the sort ran.
    const listingsA = [
      makeListing({ id: "far", latitude: -33.9, longitude: 18.5 }),
      makeListing({ id: "near", latitude: -33.5, longitude: 18.5 }),
      makeListing({ id: "mid", latitude: -33.7, longitude: 18.5 }),
    ];
    queueViewport(listingsA);

    render(<DiscoveryPage />);
    await loadViewport(BOUNDS_A);

    const expectedA = expectedMarkerOrder(listingsA, BOUNDS_A);
    await waitFor(() => {
      expect(markerIds()).toEqual(expectedA);
    });
    // Sanity: origin is the bounds midpoint, so the nearest-first order is known
    // and differs from the (scrambled) input order.
    expect(expectedA).toEqual(["near", "mid", "far"]);

    // A second successful Viewport_Query replaces the displayed listings.
    const listingsB = [
      makeListing({ id: "b1", latitude: -25.5, longitude: 28.5 }),
      makeListing({ id: "b2", latitude: -25.2, longitude: 28.5 }),
    ];
    queueViewport(listingsB);
    await loadViewport(BOUNDS_B);

    await waitFor(() => {
      expect(markerIds()).toEqual(expectedMarkerOrder(listingsB, BOUNDS_B));
    });
    // None of the previous set remain (Req 1.3 replacement).
    expect(markerIds()).not.toContain("near");
    expect(markerIds()).not.toContain("mid");
    expect(markerIds()).not.toContain("far");
  });

  it("caps the rendered markers at the Marker_Cap of 200 (Req 7.1)", async () => {
    const many = Array.from({ length: 250 }, (_, index) =>
      makeListing({
        id: `l-${index}`,
        // Spread coordinates so every listing has a distinct distance.
        latitude: -34 + index * 0.003,
        longitude: 18 + index * 0.003,
      }),
    );
    queueViewport(many);

    render(<DiscoveryPage />);
    await loadViewport(BOUNDS_A);

    await waitFor(() => {
      expect(markerIds().length).toBe(200);
    });
  });

  it("clears the selection when the selected listing is absent from the next payload (Req 1.6)", async () => {
    const listingsA = [
      makeListing({ id: "a1", latitude: -33.5, longitude: 18.5 }),
      makeListing({ id: "a2", latitude: -33.6, longitude: 18.5 }),
      makeListing({ id: "a3", latitude: -33.7, longitude: 18.5 }),
    ];
    queueViewport(listingsA);

    render(<DiscoveryPage />);
    await loadViewport(BOUNDS_A);
    await waitFor(() => {
      expect(markerIds()).toContain("a2");
    });

    // Select a listing via the Map_Surface marker activation.
    act(() => {
      harness.mapProps?.onSelectListing?.("a2");
    });
    await waitFor(() => {
      expect(selectedId()).toBe("a2");
    });

    // Next viewport omits the selected listing -> selection must clear.
    const listingsB = [
      makeListing({ id: "a1", latitude: -33.5, longitude: 18.5 }),
      makeListing({ id: "a3", latitude: -33.7, longitude: 18.5 }),
    ];
    queueViewport(listingsB);
    await loadViewport(BOUNDS_B);

    await waitFor(() => {
      expect(markerIds()).toEqual(expectedMarkerOrder(listingsB, BOUNDS_B));
    });
    expect(selectedId()).toBe("");
  });

  it("retains the selection when the selected listing is still present (Req 1.6)", async () => {
    const listingsA = [
      makeListing({ id: "a1", latitude: -33.5, longitude: 18.5 }),
      makeListing({ id: "a2", latitude: -33.6, longitude: 18.5 }),
    ];
    queueViewport(listingsA);

    render(<DiscoveryPage />);
    await loadViewport(BOUNDS_A);
    await waitFor(() => expect(markerIds()).toContain("a2"));

    act(() => {
      harness.mapProps?.onSelectListing?.("a2");
    });
    await waitFor(() => expect(selectedId()).toBe("a2"));

    // Next payload still contains the selected listing.
    const listingsB = [
      makeListing({ id: "a2", latitude: -33.6, longitude: 18.5 }),
      makeListing({ id: "a4", latitude: -33.8, longitude: 18.5 }),
    ];
    queueViewport(listingsB);
    await loadViewport(BOUNDS_B);

    await waitFor(() => {
      expect(markerIds()).toEqual(expectedMarkerOrder(listingsB, BOUNDS_B));
    });
    expect(selectedId()).toBe("a2");
  });
});
