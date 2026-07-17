// @vitest-environment jsdom

/**
 * Discovery_Page_Experience — filter ↔ URL synchronization + viewport re-query.
 *
 * Verifies the filter/URL wiring in `discovery-page.tsx` around
 * `handleFilterChange`, the filter-initialized `FilterState`, and the
 * Viewport_Query effect (which depends on `searchParams`):
 *  - Req 6.1: changing Active_Filters updates the URL query string
 *    (`minPrice`, `maxPrice`, `beds`, `baths`, `type`, `q`) within 500 ms.
 *  - Req 6.2: removing a filter value deletes its URL parameter.
 *  - Req 6.3: loading with filter params present initializes Active_Filters.
 *  - Req 1.4: an Active_Filters change re-issues the Viewport_Query for the
 *    current bounds using the updated filters.
 *  - Req 1.5: the Viewport_Query includes the active `q`, `minPrice`,
 *    `maxPrice`, `beds`, `baths`, and `type` values from the URL.
 *  - Req 13.5: the Active_Filters + search query are reproducible from the URL
 *    so the same URL yields the same filtered view.
 *
 * These are example-based component tests (not property tests). Mocks mirror the
 * sibling discovery-page.*.test.tsx files so the file is self-contained.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { FilterState } from "./filter-bar";
import type { QuickFilterKey } from "./lib/types";

// --- Module mocks --------------------------------------------------------

// next/navigation: stable pathname + a per-test reassignable search params +
// a router whose `replace` records the URL it was asked to navigate to. Tests
// can opt in to making `replace` update `searchParamsMock` (simulating the URL
// actually changing) to exercise the re-query path (Req 1.4).
const routerMock = {
  replace: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};
let searchParamsMock = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsMock,
  usePathname: () => "/",
  useRouter: () => routerMock,
}));

// The map is dynamically imported (ssr:false) and pulls in the Google Maps SDK,
// which is irrelevant to filter/URL behavior. Replace it with a light stub that
// exposes a button to drive `onBoundsChange` (the sole trigger of a
// Viewport_Query) with a deterministic bounds so the emitted bbox is stable.
vi.mock("./map-view-loader", () => ({
  MapViewLoader: ({
    onBoundsChange,
  }: {
    onBoundsChange?: (b: { west: number; south: number; east: number; north: number }) => void;
  }) => (
    <div data-testid="map-stub">
      <button
        type="button"
        onClick={() => onBoundsChange?.({ west: 18.4, south: -33.95, east: 18.5, north: -33.9 })}
      >
        set-bounds
      </button>
    </div>
  ),
}));

// Capture the props handed to the FilterBar (there are desktop + mobile
// instances; both receive the same `filters`/`onFilterChange`) and expose
// buttons that drive `onFilterChange` with deterministic filter states so the
// URL sync can be asserted without wrestling the real dropdown UI.
let lastFilterBarFilters: FilterState | null = null;
vi.mock("./filter-bar", () => ({
  FilterBar: ({
    filters,
    onFilterChange,
  }: {
    filters: FilterState;
    onFilterChange: (filters: FilterState) => void;
  }) => {
    lastFilterBarFilters = filters;
    return (
      <div data-testid="filter-bar-stub">
        <button
          type="button"
          onClick={() =>
            onFilterChange({
              price: { min: 5000, max: 15000 },
              beds: 2,
              baths: 1,
              propertyTypes: ["apartment", "house"],
            })
          }
        >
          apply-all-filters
        </button>
        <button type="button" onClick={() => onFilterChange({ beds: 2 })}>
          apply-beds-only
        </button>
      </div>
    );
  },
}));

// The premium card transitively imports next/image + chat widgets; stub it.
vi.mock("@/components/premium/property-card", () => ({
  PropertyCard: ({ property }: { property?: { title?: string } }) => (
    <div data-testid="property-card">{property?.title}</div>
  ),
  SaveIconButton: () => <span data-testid="save-icon" />,
}));

// The detail panel transitively imports server actions, chat, and next/image.
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

// Favorites are orthogonal to filter/URL behavior; stub them so they never touch storage.
vi.mock("./hooks/use-favorites", () => ({
  useFavorites: () => ({
    favorites: new Set<string>(),
    isFavorite: () => false,
    toggleFavorite: () => {},
    isLoading: false,
    error: null,
    authenticated: false,
  }),
}));

let lastQuickFilter: QuickFilterKey | null = null;
vi.mock("./mobile/explore-sections", () => ({
  DiscoveryExploreSections: ({
    activeQuickFilter,
    onQuickFilterChange,
  }: {
    activeQuickFilter: QuickFilterKey;
    onQuickFilterChange: (filter: QuickFilterKey) => void;
  }) => {
    lastQuickFilter = activeQuickFilter;
    return (
      <div data-active-quick-filter={activeQuickFilter}>
        <button type="button" onClick={() => onQuickFilterChange("furnished")}>quick-furnished</button>
        <button type="button" onClick={() => onQuickFilterChange("all")}>quick-all</button>
      </div>
    );
  },
}));

import { DiscoveryPage } from "./discovery-page";

// --- fetch harness -------------------------------------------------------

/** Records every fetch URL so Viewport_Query params can be asserted. */
let fetchUrls: string[] = [];

function viewportUrls() {
  return fetchUrls.filter((url) => url.startsWith("/api/listings?"));
}

/** Parse the query string of the most recent Viewport_Query fetch. */
function lastViewportParams() {
  const urls = viewportUrls();
  const url = urls[urls.length - 1]!;
  return new URLSearchParams(url.slice(url.indexOf("?") + 1));
}

/** Parse the URL string handed to the most recent router.replace call. */
function lastReplaceParams() {
  const calls = routerMock.replace.mock.calls;
  const arg = calls[calls.length - 1]![0] as string;
  return new URLSearchParams(arg.slice(arg.indexOf("?") + 1));
}

beforeEach(() => {
  searchParamsMock = new URLSearchParams();
  routerMock.replace.mockReset();
  routerMock.prefetch.mockClear();
  fetchUrls = [];
  lastFilterBarFilters = null;
  lastQuickFilter = null;

  // Real timers: no Viewport_Query fires until bounds are set, the geolocation
  // timer never arms (jsdom has no navigator.geolocation), and viewport fetches
  // resolve immediately (clearing their 2000ms timeout in `.finally`). Real
  // timers let `waitFor` flush the real promise microtasks.
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      fetchUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ ok: true, data: { listings: [] } }),
      } as unknown as Response);
    }),
  );

  // jsdom doesn't implement these; discovery children call them defensively.
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

// --- helpers -------------------------------------------------------------

function renderPage() {
  return render(<DiscoveryPage googleMapsApiKey="test-key" />);
}

/** Fire the map bounds callback (the only trigger of a Viewport_Query). */
async function issueQuery() {
  await act(async () => {
    fireEvent.click(screen.getAllByText("set-bounds")[0]!);
  });
}

// --- tests ---------------------------------------------------------------

describe("DiscoveryPage filter ↔ URL initialization (Req 6.3)", () => {
  it("initializes Active_Filters from filter params present in the URL", async () => {
    searchParamsMock = new URLSearchParams(
      "minPrice=5000&maxPrice=15000&beds=2&baths=1&type=apartment,house&q=sea+point",
    );

    renderPage();

    await waitFor(() => {
      expect(lastFilterBarFilters).not.toBeNull();
    });

    expect(lastFilterBarFilters).toEqual({
      price: { min: 5000, max: 15000 },
      beds: 2,
      baths: 1,
      propertyTypes: ["apartment", "house"],
    });
  });
});

describe("DiscoveryPage Viewport_Query filter params (Req 1.5, 13.5)", () => {
  it("includes the active q + filter params from the URL in the Viewport_Query", async () => {
    searchParamsMock = new URLSearchParams(
      "minPrice=5000&maxPrice=15000&beds=2&baths=1&type=apartment,house&q=sea+point",
    );

    renderPage();
    await issueQuery();

    await waitFor(() => {
      expect(viewportUrls().length).toBeGreaterThan(0);
    });

    const params = lastViewportParams();
    // The bounds stub emits west,south,east,north each to 6 decimals.
    expect(params.get("bbox")).toBe("18.400000,-33.950000,18.500000,-33.900000");
    expect(params.get("minPrice")).toBe("5000");
    expect(params.get("maxPrice")).toBe("15000");
    expect(params.get("beds")).toBe("2");
    expect(params.get("baths")).toBe("1");
    expect(params.get("type")).toBe("apartment,house");
    expect(params.get("q")).toBe("sea point");
  });

  it("reproduces the same filtered view for the same URL (Req 13.5)", async () => {
    const url = "minPrice=8000&beds=3&type=studio&q=gardens";

    searchParamsMock = new URLSearchParams(url);
    renderPage();
    await issueQuery();
    await waitFor(() => expect(viewportUrls().length).toBeGreaterThan(0));
    const first = viewportUrls()[viewportUrls().length - 1];

    // Tear down and remount from the identical URL.
    cleanup();
    fetchUrls = [];
    searchParamsMock = new URLSearchParams(url);
    renderPage();
    await issueQuery();
    await waitFor(() => expect(viewportUrls().length).toBeGreaterThan(0));
    const second = viewportUrls()[viewportUrls().length - 1];

    expect(second).toBe(first);
  });
});

describe("DiscoveryPage filter → URL synchronization (Req 6.1, 6.2)", () => {
  it("writes the changed filters to the URL query string within 500 ms", async () => {
    renderPage();

    // Changing Active_Filters synchronously calls router.replace (no debounce),
    // which is well within the 500 ms budget.
    await act(async () => {
      fireEvent.click(screen.getAllByText("apply-all-filters")[0]!);
    });

    expect(routerMock.replace).toHaveBeenCalledTimes(1);
    const params = lastReplaceParams();
    expect(params.get("minPrice")).toBe("5000");
    expect(params.get("maxPrice")).toBe("15000");
    expect(params.get("beds")).toBe("2");
    expect(params.get("baths")).toBe("1");
    expect(params.get("type")).toBe("apartment,house");
  });

  it("deletes a filter's parameter from the URL when its value is removed", async () => {
    searchParamsMock = new URLSearchParams("minPrice=5000&maxPrice=15000&beds=2&baths=1");

    renderPage();

    // Apply a filter set that keeps only `beds`, dropping price + baths.
    await act(async () => {
      fireEvent.click(screen.getAllByText("apply-beds-only")[0]!);
    });

    const params = lastReplaceParams();
    expect(params.get("beds")).toBe("2");
    expect(params.get("minPrice")).toBeNull();
    expect(params.get("maxPrice")).toBeNull();
    expect(params.get("baths")).toBeNull();
  });
});

describe("DiscoveryPage committed search request management", () => {
  it("does not request listings while typing and re-queries only after explicit Search", async () => {
    routerMock.replace.mockImplementation((url: string) => {
      searchParamsMock = new URLSearchParams(url.slice(url.indexOf("?") + 1));
    });
    const view = renderPage();
    await issueQuery();
    await waitFor(() => expect(viewportUrls()).toHaveLength(1));

    const input = screen.getByRole("combobox", { name: "Search listings" });
    fireEvent.change(input, { target: { value: "B" } });
    fireEvent.change(input, { target: { value: "Br" } });
    fireEvent.change(input, { target: { value: "Braam" } });

    expect(viewportUrls()).toHaveLength(1);
    expect(routerMock.replace).not.toHaveBeenCalled();

    fireEvent.submit(input.closest("form")!);
    view.rerender(<DiscoveryPage googleMapsApiKey="test-key" />);

    await waitFor(() => expect(viewportUrls()).toHaveLength(2));
    expect(lastViewportParams().get("q")).toBe("Braam");
  });

  it("preserves the committed q when filters change while a different draft is being typed", () => {
    searchParamsMock = new URLSearchParams("q=Sea+Point&placeId=sea-point-place&foo=keep");
    renderPage();

    fireEvent.change(screen.getByRole("combobox", { name: "Search listings" }), {
      target: { value: "Uncommitted draft" },
    });
    fireEvent.click(screen.getAllByText("apply-beds-only")[0]!);

    const params = lastReplaceParams();
    expect(params.get("q")).toBe("Sea Point");
    expect(params.get("placeId")).toBe("sea-point-place");
    expect(params.get("foo")).toBe("keep");
    expect(params.get("beds")).toBe("2");
  });
});

describe("DiscoveryPage Quick Filter URL synchronization", () => {
  it("persists a non-default Quick Filter alongside advanced filters", async () => {
    searchParamsMock = new URLSearchParams("beds=2");
    renderPage();

    await act(async () => {
      fireEvent.click(screen.getAllByText("quick-furnished")[0]!);
    });

    const params = lastReplaceParams();
    expect(params.get("quick")).toBe("furnished");
    expect(params.get("beds")).toBe("2");
  });

  it("resolves an invalid value to All and clears Quick plus advanced filters", async () => {
    searchParamsMock = new URLSearchParams("quick=not-a-filter&beds=2&minPrice=5000&q=sea+point");
    renderPage();

    await waitFor(() => expect(lastQuickFilter).toBe("all"));
    await act(async () => {
      fireEvent.click(screen.getAllByText("quick-all")[0]!);
    });

    const params = lastReplaceParams();
    expect(params.get("quick")).toBeNull();
    expect(params.get("beds")).toBeNull();
    expect(params.get("minPrice")).toBeNull();
    expect(params.get("q")).toBe("sea point");
  });
});

describe("DiscoveryPage filter change re-issues the Viewport_Query (Req 1.4)", () => {
  it("re-requests listings for the current bounds using the updated filters", async () => {
    // Make router.replace commit the new URL to searchParamsMock so the
    // Viewport_Query effect (which depends on searchParams) re-runs, mirroring
    // Next.js updating useSearchParams after a navigation.
    routerMock.replace.mockImplementation((url: string) => {
      searchParamsMock = new URLSearchParams(url.slice(url.indexOf("?") + 1));
    });

    renderPage();

    // First query for the current bounds carries no filters.
    await issueQuery();
    await waitFor(() => expect(viewportUrls().length).toBe(1));
    expect(lastViewportParams().get("minPrice")).toBeNull();

    // Changing the filters updates the URL and re-issues the query for the same
    // bounds with the new filter params.
    await act(async () => {
      fireEvent.click(screen.getAllByText("apply-all-filters")[0]!);
    });

    await waitFor(() => {
      expect(viewportUrls().length).toBe(2);
    });

    const params = lastViewportParams();
    expect(params.get("bbox")).toBe("18.400000,-33.950000,18.500000,-33.900000");
    expect(params.get("minPrice")).toBe("5000");
    expect(params.get("maxPrice")).toBe("15000");
    expect(params.get("beds")).toBe("2");
    expect(params.get("baths")).toBe("1");
    expect(params.get("type")).toBe("apartment,house");
  });
});
