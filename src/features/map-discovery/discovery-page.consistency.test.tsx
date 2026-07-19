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
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

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
    onCenterNameChange?: (name: string) => void;
    onPlaceSuggestionsChange?: (suggestions: Array<{ placeId: string; label: string; secondaryLabel?: string }>) => void;
    searchQuery?: string;
    searchPlaceId?: string;
    suggestionQuery?: string;
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
    return <div data-testid="map-stub">{props.children as React.ReactNode}</div>;
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
vi.mock("./mobile/listing-card", () => ({
  ListingCard: ({ card }: { card?: { id?: string } }) => (
    <div data-testid="legacy-grid-card">{card?.id}</div>
  ),
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
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: { alt?: string }) => <img alt={props.alt ?? ""} />,
}));

// Favorites are orthogonal to composition; stub them so they never touch storage.
vi.mock("./hooks/use-favorites", () => ({
  useFavorites: () => ({ isFavorite: () => false, toggleFavorite: () => {} }),
}));

import { DiscoveryPage } from "./discovery-page";

const BLOG_POSTS = [{
  id: "blog-one",
  slug: "rental-viewing-checklist",
  title: "What to check before you view",
  topic: "Viewing",
  excerpt: "Compare homes with a practical viewing checklist.",
  status: "published" as const,
  publishedAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
  cover: null,
  readingMinutes: 3,
}];
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
  window.localStorage.clear();
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

describe("Map-only presentation", () => {
  it("keeps the map results panel and does not expose an alternate list mode", async () => {
    queueViewport([
      makeListing({ id: "first", title: "Panel Card One", created_at: "2024-01-02T00:00:00.000Z" }),
      makeListing({ id: "second", title: "Panel Card Two", created_at: "2024-01-01T00:00:00.000Z" }),
    ]);

    render(<DiscoveryPage googleMapsApiKey="test-key" initialBlogPosts={BLOG_POSTS} />);
    await loadViewport(BOUNDS_A);

    const desktopMapBrowse = screen.getByLabelText("Listings near the map");
    expect(desktopMapBrowse).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sort listings by Latest/ })).toBeInTheDocument();
    expect(within(desktopMapBrowse).getByTestId("listing-carousel")).toBeInTheDocument();
    expect(within(desktopMapBrowse).getByRole("heading", { name: "Quick filters" })).toBeInTheDocument();
    expect(within(desktopMapBrowse).getByRole("heading", { name: "Rental tips" })).toBeInTheDocument();
    expect(within(desktopMapBrowse).queryByRole("heading", { name: "Collections" })).not.toBeInTheDocument();
    expect(within(desktopMapBrowse).queryByRole("heading", { name: "Guides for your move" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "List" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Listings list view")).not.toBeInTheDocument();
    expect(screen.getByTestId("bottom-sheet")).toBeInTheDocument();
  });
});

describe("Location search suggestions", () => {
  it("supports arrow navigation, active descendant, selection, recent searches, and Escape", async () => {
    queueViewport([makeListing({ id: "sea-point", area: "Sea Point" })]);

    render(<DiscoveryPage googleMapsApiKey="test-key" initialBlogPosts={BLOG_POSTS} />);
    await loadViewport(BOUNDS_A);

    act(() => harness.mapProps?.onCenterNameChange?.("Sea Point"));

    const input = screen.getByRole("combobox", { name: "Search listings" });
    input.focus();
    fireEvent.change(input, { target: { value: "sea" } });

    const option = await screen.findByRole("option", { name: "Sea Point" });
    fireEvent.keyDown(input, { key: "ArrowDown" });

    expect(input).toHaveAttribute(
      "aria-activedescendant",
      "desktop-location-suggestions-option-0",
    );
    expect(option).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(input, { key: "Enter" });
    expect(input).toHaveValue("Sea Point");
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(window.localStorage.getItem("roomza:discovery-recent-searches")).toContain("Sea Point");

    fireEvent.click(within(input.closest("form")!).getByRole("button", { name: "Clear search" }));
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("aria-expanded", "false");

    fireEvent.focus(input);
    expect(await screen.findByText("Recent searches")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Sea Point" })).toBeInTheDocument();

    fireEvent.click(within(input.closest("form")!).getByRole("button", { name: /^Search$/ }));
    expect(input).toHaveAttribute("aria-expanded", "false");

    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveFocus();

    fireEvent.blur(input);
    fireEvent.focus(input);
    expect(input).toHaveAttribute("aria-expanded", "true");
    fireEvent.mouseDown(document.body);
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps typing draft-only, commits a normalized plain-text search, and removes a stale placeId", async () => {
    harness.searchParams = new URLSearchParams(
      "mode=buy&quick=furnished&foo=keep&placeId=stale-place&q=Old",
    );
    render(<DiscoveryPage googleMapsApiKey="test-key" />);

    const input = screen.getByRole("combobox", { name: "Search listings" });
    fireEvent.change(input, { target: { value: "  Braam   Studio  " } });

    expect(harness.router.replace).not.toHaveBeenCalled();
    expect(harness.mapProps?.suggestionQuery).toBe("  Braam   Studio  ");
    expect(harness.mapProps?.searchQuery).toBe("Old");
    expect(harness.mapProps?.searchPlaceId).toBe("stale-place");

    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    const lastReplace = harness.router.replace.mock.calls.at(-1)?.[0] as string;
    const params = new URLSearchParams(lastReplace.slice(lastReplace.indexOf("?") + 1));
    expect(params.get("q")).toBe("Braam Studio");
    expect(params.get("placeId")).toBeNull();
    expect(params.get("mode")).toBe("buy");
    expect(params.get("quick")).toBe("furnished");
    expect(params.get("foo")).toBe("keep");
  });

  it("commits a Google place suggestion with q and placeId for map recentering", async () => {
    harness.searchParams = new URLSearchParams("beds=2&mode=buy&foo=keep");
    harness.router.replace.mockImplementation((url: string) => {
      harness.searchParams = new URLSearchParams(url.slice(url.indexOf("?") + 1));
    });
    const view = render(<DiscoveryPage googleMapsApiKey="test-key" />);

    const input = screen.getByRole("combobox", { name: "Search listings" });
    fireEvent.change(input, { target: { value: "cape" } });
    act(() => {
      harness.mapProps?.onPlaceSuggestionsChange?.([
        { placeId: "cape-town-place", label: "Cape Town", secondaryLabel: "Western Cape" },
      ]);
    });

    fireEvent.click(await screen.findByRole("option", { name: /Cape Town/ }));

    const lastReplace = harness.router.replace.mock.calls.at(-1)?.[0] as string;
    const params = new URLSearchParams(lastReplace.slice(lastReplace.indexOf("?") + 1));
    expect(params.get("q")).toBe("Cape Town");
    expect(params.get("placeId")).toBe("cape-town-place");
    expect(params.get("beds")).toBe("2");
    expect(params.get("mode")).toBe("buy");
    expect(params.get("foo")).toBe("keep");

    view.rerender(<DiscoveryPage googleMapsApiKey="test-key" />);
    expect(harness.mapProps?.searchQuery).toBe("Cape Town");
    expect(harness.mapProps?.searchPlaceId).toBe("cape-town-place");
  });

  it("clears q and placeId while preserving filters, mode, quick filters, and unrelated params", () => {
    harness.searchParams = new URLSearchParams(
      "q=Cape+Town&placeId=cape-town-place&mode=buy&quick=furnished&beds=2&foo=keep",
    );
    render(<DiscoveryPage googleMapsApiKey="test-key" />);

    const input = screen.getByRole("combobox", { name: "Search listings" });
    expect(input).toHaveValue("Cape Town");
    fireEvent.click(within(input.closest("form")!).getByRole("button", { name: "Clear search" }));

    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("aria-expanded", "false");

    const lastReplace = harness.router.replace.mock.calls.at(-1)?.[0] as string;
    const params = new URLSearchParams(lastReplace.slice(lastReplace.indexOf("?") + 1));
    expect(params.get("q")).toBeNull();
    expect(params.get("placeId")).toBeNull();
    expect(params.get("mode")).toBe("buy");
    expect(params.get("quick")).toBe("furnished");
    expect(params.get("beds")).toBe("2");
    expect(params.get("foo")).toBe("keep");
  });

  it("offers Clear for a placeId-only URL and removes only that location state", () => {
    harness.searchParams = new URLSearchParams("placeId=place-only&mode=buy&foo=keep");
    render(<DiscoveryPage googleMapsApiKey="test-key" />);

    const input = screen.getByRole("combobox", { name: "Search listings" });
    expect(input).toHaveValue("");
    fireEvent.click(within(input.closest("form")!).getByRole("button", { name: "Clear search" }));

    const lastReplace = harness.router.replace.mock.calls.at(-1)?.[0] as string;
    const params = new URLSearchParams(lastReplace.slice(lastReplace.indexOf("?") + 1));
    expect(params.get("q")).toBeNull();
    expect(params.get("placeId")).toBeNull();
    expect(params.get("mode")).toBe("buy");
    expect(params.get("foo")).toBe("keep");
  });

  it("replaces an uncommitted draft whenever browser history changes the URL q", async () => {
    harness.searchParams = new URLSearchParams("q=First&placeId=first-place&foo=keep");
    const view = render(<DiscoveryPage googleMapsApiKey="test-key" />);

    const input = screen.getByRole("combobox", { name: "Search listings" });
    fireEvent.change(input, { target: { value: "Uncommitted draft" } });
    expect(input).toHaveValue("Uncommitted draft");

    harness.searchParams = new URLSearchParams("q=Second&placeId=second-place&foo=keep");
    view.rerender(<DiscoveryPage googleMapsApiKey="test-key" />);
    await waitFor(() => expect(input).toHaveValue("Second"));

    harness.searchParams = new URLSearchParams("q=First&placeId=first-place&foo=keep");
    view.rerender(<DiscoveryPage googleMapsApiKey="test-key" />);
    await waitFor(() => expect(input).toHaveValue("First"));
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
      expect(cards[i]!.distanceKm!).toBeGreaterThanOrEqual(cards[i - 1]!.distanceKm!);
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

    render(<DiscoveryPage googleMapsApiKey="test-key" initialBlogPosts={BLOG_POSTS} />);
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

    const desktopBrowse = screen.getByLabelText("Listings near the map");
    expect(within(desktopBrowse).getByRole("heading", { name: "Quick filters" })).toBeInTheDocument();
    expect(within(desktopBrowse).getByRole("heading", { name: "Rental tips" })).toBeInTheDocument();
    expect(within(desktopBrowse).queryByRole("heading", { name: "Collections" })).not.toBeInTheDocument();
    expect(within(desktopBrowse).queryByRole("heading", { name: "Guides for your move" })).not.toBeInTheDocument();
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
