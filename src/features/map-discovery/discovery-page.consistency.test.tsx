// @vitest-environment jsdom

/**
 * Discovery_Page_Experience — consistency with the existing discovery specs.
 *
 * Task 11.4 / Requirement 15. This comprehensive spec is the system-of-record
 * for data, behavior, and performance, and MUST compose with the two narrower
 * specs without contradicting or redefining their presentation:
 *   - `mobile-map-discovery` owns the Bottom_Sheet / Listing_Carousel / Sort_Label
 *     layout and interaction.
 *   - `discovery-pop` owns the Value_Proposition / Primary_Search_CTA / spotlight
 *     presentation.
 *
 * These are example-based composition tests (not property tests). They assert
 * the *seams* between DiscoveryPage and the deferred-presentation components:
 *  - Req 15.1: the experience renders at the site root `/` with no separate
 *    route and no redirect. The root `Home` server component renders
 *    `DiscoveryPage` directly, and DiscoveryPage never navigates away on mount.
 *  - Req 15.2: DiscoveryPage *supplies* the listing data to the Bottom_Sheet and
 *    Listing_Carousel (via the `cards` prop) without redefining their layout —
 *    the mocked presentational components are the ones that render, DiscoveryPage
 *    only feeds them data.
 *  - Req 15.3: DiscoveryPage supplies the data-fetch / interactivity underlying
 *    the Value_Proposition (the empty-state capture, fed `bbox` + `filters`) and
 *    the Primary_Search_CTA (search query state + submit wiring) without
 *    redefining their presentation.
 *  - Req 15.4: when the Map_Surface bounds first resolve, the Viewport_Query
 *    fires — there is no spotlight gate; the very first bounds resolution issues
 *    the `/api/listings` request.
 *  - Req 15.5: the "Closest"/nearest ordering DiscoveryPage produces for the
 *    cards (which feed the Sort_Label) is ascending distance from the
 *    Distance_Origin, matching the Sort_Label semantics owned by
 *    `mobile-map-discovery`.
 *
 * Mocks mirror the sibling discovery-page.*.test.tsx files so the file is
 * self-contained. The pure Card_Pipeline (cap -> model -> mostNearestSort) runs
 * for real inside DiscoveryPage; only the browser-only map and the
 * presentational (mobile-map-discovery-owned) containers are stubbed so their
 * incoming props are observable.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";

import { capListings } from "./lib/cap";
import { haversineKm, resolveDistanceOrigin } from "./lib/distance";
import { mostNearestSort } from "./lib/sort";
import type { ListingCardModel, ViewportBounds } from "./lib/types";

// --- Mocks -----------------------------------------------------------------

// Hoisted harness capturing the props DiscoveryPage passes to the map and to
// the presentational (deferred) components, plus the navigation doubles.
const harness = vi.hoisted(() => ({
  mapProps: null as null | {
    listings?: Array<{ id: string }>;
    selectedListingId?: string;
    onBoundsChange?: (bounds: ViewportBounds) => void;
    onSelectListing?: (id: string) => void;
  },
  shellProps: null as null | {
    cards?: ListingCardModel[];
    searchQuery?: string;
    onSearchChange?: (value: string) => void;
    onSearchSubmit?: () => void;
    emptyState?: unknown;
  },
  carouselProps: null as null | {
    cards?: ListingCardModel[];
    emptyState?: unknown;
  },
  router: {
    replace: vi.fn(),
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  },
  searchParams: new URLSearchParams(""),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => harness.router,
  usePathname: () => "/",
  useSearchParams: () => harness.searchParams,
}));

// Map_Surface (browser-only, dynamic import) — a light stub. It records the
// props it receives (markers, selection) and exposes `onBoundsChange` as the
// sole trigger of a Viewport_Query.
vi.mock("./map-view-loader", () => ({
  MapViewLoader: (props: Record<string, unknown>) => {
    harness.mapProps = props as typeof harness.mapProps;
    return <div data-testid="map-stub" />;
  },
}));

// Bottom_Sheet / mobile shell / carousel — layout + interaction owned by
// `mobile-map-discovery`. Stub them so their *incoming data props* (supplied by
// DiscoveryPage) are observable without redefining their presentation here.
vi.mock("./mobile/mobile-discovery-shell", () => ({
  MobileDiscoveryShell: (props: Record<string, unknown>) => {
    harness.shellProps = props as typeof harness.shellProps;
    return <div data-testid="mobile-shell" />;
  },
}));
vi.mock("./mobile/bottom-sheet", () => ({
  // Render children so the nested ListingCarousel mounts and can capture props.
  MobileBottomSheet: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="bottom-sheet">{children}</div>
  ),
}));
vi.mock("./mobile/listing-carousel", () => ({
  ListingCarousel: (props: Record<string, unknown>) => {
    harness.carouselProps = props as typeof harness.carouselProps;
    return <div data-testid="listing-carousel" />;
  },
}));

// The premium card + detail panel transitively pull in next/image + chat
// widgets; stub them so the desktop subtree renders cheaply.
vi.mock("@/components/premium/property-card", () => ({
  PropertyCard: ({ property }: { property?: { title?: string } }) => (
    <div data-testid="property-card">{property?.title}</div>
  ),
  SaveIconButton: () => <span data-testid="save-icon" />,
}));
vi.mock("./listing-detail-panel", () => ({
  ListingDetailPanel: ({ listing }: { listing?: { title?: string } }) => (
    <div data-testid="detail-panel">{listing?.title}</div>
  ),
}));
vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: { alt?: string }) => <img alt={props.alt ?? ""} />,
}));

// POI overlay + favorites are orthogonal to composition; stub them so they
// never issue their own fetches or touch storage.
vi.mock("./hooks/use-overpass-pois", () => ({
  useOverpassPois: () => ({ pois: [] }),
}));
vi.mock("./hooks/use-favorites", () => ({
  useFavorites: () => ({ isFavorite: () => false, toggleFavorite: () => {} }),
}));

import { DiscoveryPage } from "./discovery-page";
import Home from "@/app/page";

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

// Replay the exact Card_Pipeline DiscoveryPage uses (geolocation unavailable in
// jsdom -> origin is the bounds midpoint) to derive the expected card id order.
function expectedCardOrder(listings: ApiListing[], bounds: ViewportBounds): string[] {
  const origin = resolveDistanceOrigin(null, bounds);
  const models: ListingCardModel[] = capListings(listings).map((listing) => ({
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

// Queue of viewport payloads consumed one-per-Viewport_Query, plus a record of
// the URLs fetched so the Viewport_Query trigger can be asserted.
let fetchQueue: ApiListing[][] = [];
let fetchUrls: string[] = [];

function queueViewport(listings: ApiListing[]) {
  fetchQueue.push(listings);
}

function viewportFetchUrls() {
  return fetchUrls.filter((url) => url.startsWith("/api/listings?"));
}

const BOUNDS_A: ViewportBounds = { west: 18, south: -34, east: 19, north: -33 };

// Drive a new Viewport_Bounds (triggering a Viewport_Query) and let the queued
// payload settle into the derived cards.
async function loadViewport(bounds: ViewportBounds) {
  await act(async () => {
    harness.mapProps?.onBoundsChange?.(bounds);
  });
  await waitFor(() => {
    expect(harness.mapProps).not.toBeNull();
  });
}

beforeEach(() => {
  harness.mapProps = null;
  harness.shellProps = null;
  harness.carouselProps = null;
  harness.searchParams = new URLSearchParams("");
  harness.router.replace.mockClear();
  harness.router.push.mockClear();
  harness.router.prefetch.mockClear();
  fetchQueue = [];
  fetchUrls = [];

  // Real timers: no geolocation timer fires (navigator.geolocation is absent in
  // jsdom) and a successful Viewport_Query clears its 2000ms timeout in
  // `.finally`, so real timers let the fetch microtasks flush under `waitFor`.
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      fetchUrls.push(String(input));
      const payload = fetchQueue.shift() ?? [];
      return Promise.resolve({
        ok: true,
        json: async () => ({ ok: true, data: { listings: payload } }),
      } as Response);
    }),
  );

  Element.prototype.scrollIntoView = vi.fn();
  if (!window.matchMedia) {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  }
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// --- Req 15.1: renders at the site root with no separate route / redirect ---

describe("Req 15.1 — renders at the site root path without a separate route", () => {
  it("the root Home server component renders the DiscoveryPage surface directly", async () => {
    // `Home` is the site root (`/`) server component. Rendering its output must
    // yield the discovery experience itself — not a redirect or a nested route.
    const ui = await Home();
    render(ui);

    expect(await screen.findByTestId("map-stub")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-shell")).toBeInTheDocument();
  });

  it("does not navigate to any other route on mount", async () => {
    render(<DiscoveryPage googleMapsApiKey="test-key" />);

    await waitFor(() => {
      // Route prefetch on mount is expected (Req 5.5) but is not a navigation.
      expect(harness.router.prefetch).toHaveBeenCalled();
    });

    // No redirect: the experience stays at `/`.
    expect(harness.router.push).not.toHaveBeenCalled();
    expect(harness.router.replace).not.toHaveBeenCalled();
  });
});

// --- Req 15.4: Viewport_Query fires when bounds first resolve ---------------

describe("Req 15.4 — Viewport_Query fires when map bounds first resolve", () => {
  it("issues the /api/listings request on the first bounds resolution (no spotlight gate)", async () => {
    queueViewport([makeListing({ id: "a1" })]);

    render(<DiscoveryPage googleMapsApiKey="test-key" />);

    // Before bounds resolve, no Viewport_Query has been issued.
    expect(viewportFetchUrls()).toHaveLength(0);

    await loadViewport(BOUNDS_A);

    await waitFor(() => {
      expect(viewportFetchUrls()).toHaveLength(1);
    });
    // The single request targets the listings API with a bbox for those bounds.
    expect(viewportFetchUrls()[0]).toContain("bbox=");
  });
});

// --- Req 15.2 / 15.5: supplies card data in nearest-first order -------------

describe("Req 15.2 — supplies the Bottom_Sheet / Listing_Carousel data", () => {
  it("feeds the same card data to the mobile shell and the carousel without redefining their layout", async () => {
    const listings = [
      makeListing({ id: "far", latitude: -33.9, longitude: 18.5 }),
      makeListing({ id: "near", latitude: -33.5, longitude: 18.5 }),
      makeListing({ id: "mid", latitude: -33.7, longitude: 18.5 }),
    ];
    queueViewport(listings);

    render(<DiscoveryPage googleMapsApiKey="test-key" />);
    await loadViewport(BOUNDS_A);

    const expected = expectedCardOrder(listings, BOUNDS_A);

    await waitFor(() => {
      expect(harness.shellProps?.cards?.map((c) => c.id)).toEqual(expected);
    });

    // Both the shell (grid) and the carousel receive the identical supplied
    // data array order — DiscoveryPage supplies data, the mobile-map-discovery
    // components own the layout.
    expect(harness.carouselProps?.cards?.map((c) => c.id)).toEqual(expected);
  });
});

describe("Req 15.5 — 'Closest'/nearest ordering is ascending distance from the Distance_Origin", () => {
  it("supplies cards sorted by non-decreasing distanceKm (matching the Sort_Label semantics)", async () => {
    // Deliberately scrambled input so a passing assertion proves the sort ran.
    const listings = [
      makeListing({ id: "far", latitude: -33.9, longitude: 18.5 }),
      makeListing({ id: "near", latitude: -33.5, longitude: 18.5 }),
      makeListing({ id: "mid", latitude: -33.7, longitude: 18.5 }),
    ];
    queueViewport(listings);

    render(<DiscoveryPage googleMapsApiKey="test-key" />);
    await loadViewport(BOUNDS_A);

    await waitFor(() => {
      expect(harness.carouselProps?.cards?.length).toBe(3);
    });

    const cards = harness.carouselProps!.cards!;
    // Distance origin is determinable (bounds midpoint) so every distance is set.
    for (const card of cards) {
      expect(card.distanceKm).not.toBeNull();
    }
    // Ascending distance from the Distance_Origin: each card's distance is
    // >= the previous one's.
    for (let i = 1; i < cards.length; i += 1) {
      expect(cards[i].distanceKm!).toBeGreaterThanOrEqual(cards[i - 1].distanceKm!);
    }
    // And the concrete nearest-first order (independent of hand-computed values).
    expect(cards.map((c) => c.id)).toEqual(["near", "mid", "far"]);
  });
});

// --- Req 15.3: supplies value-prop + CTA data/interactivity -----------------

describe("Req 15.3 — supplies the Value_Proposition + Primary_Search_CTA data/interactivity", () => {
  it("supplies the empty-state (value-prop) capture fed with bbox + filters, without redefining presentation", async () => {
    // A successful zero-result load: DiscoveryPage supplies the empty-state node
    // (the area-alert / value-prop capture) to the deferred carousel/shell.
    queueViewport([]);

    render(<DiscoveryPage googleMapsApiKey="test-key" />);
    await loadViewport(BOUNDS_A);

    await waitFor(() => {
      expect(harness.carouselProps).not.toBeNull();
    });

    // The empty-state presentation is supplied as a node (owned by discovery-pop),
    // and DiscoveryPage supplies its data inputs (bbox + filters).
    const emptyState = harness.carouselProps?.emptyState as
      | { props?: { bbox?: unknown; filters?: unknown } }
      | undefined;
    expect(emptyState).toBeTruthy();
    expect(emptyState?.props).toHaveProperty("bbox");
    expect(emptyState?.props).toHaveProperty("filters");
    // The supplied bbox is the resolved viewport bounds (data, not presentation).
    expect(emptyState?.props?.bbox).toEqual(BOUNDS_A);
  });

  it("supplies the search query state + submit wiring underlying the Primary_Search_CTA", async () => {
    render(<DiscoveryPage googleMapsApiKey="test-key" />);

    await waitFor(() => {
      expect(harness.shellProps).not.toBeNull();
    });

    // DiscoveryPage supplies the search state + interactivity to the deferred
    // presentation (SearchRegion), not its own layout for the CTA.
    expect(typeof harness.shellProps?.onSearchChange).toBe("function");
    expect(typeof harness.shellProps?.onSearchSubmit).toBe("function");

    // Driving the supplied interactivity updates the shareable URL query string
    // (the data-fetch behavior underlying the CTA) without redefining the CTA.
    await act(async () => {
      harness.shellProps?.onSearchChange?.("Cape Town");
    });
    await act(async () => {
      harness.shellProps?.onSearchSubmit?.();
    });

    await waitFor(() => {
      expect(harness.router.replace).toHaveBeenCalled();
    });
    const lastReplace = harness.router.replace.mock.calls.at(-1)?.[0] as string;
    expect(lastReplace).toContain("q=Cape+Town");
  });
});
