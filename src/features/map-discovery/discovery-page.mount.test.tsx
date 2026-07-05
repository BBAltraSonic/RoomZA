// @vitest-environment jsdom

/**
 * Discovery_Page_Experience — deep-link auto-open + route prefetch on mount.
 *
 * Verifies the two mount-time behaviors wired in `discovery-page.tsx`:
 *  - Req 13.4: a `listingId` URL param opens the Detail_Loader / detail view
 *    exactly once per load (guarded by the `hasAutoOpened` ref so re-renders
 *    and search-param churn never re-open it).
 *  - Req 5.5: on mount the discovery route prefetches its likely next routes,
 *    firing `router.prefetch("/listings")` and `router.prefetch("/saved")`
 *    exactly once each per mount.
 *
 * These are example-based component tests (not property tests). Mocks mirror the
 * sibling discovery-page.*.test.tsx files so the file is self-contained.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";

// --- Module mocks --------------------------------------------------------

// next/navigation: stable pathname + no-op router. `searchParamsMock` is
// reassigned per-test so a test can mount with a `listingId` deep-link param.
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

// The map pulls in the Google Maps SDK, irrelevant here. A light stub avoids
// firing any Viewport_Query (no onBoundsChange is invoked), so the only fetch
// that can occur on mount is the deep-link Detail_Loader request.
vi.mock("./map-view-loader", () => ({
  MapViewLoader: () => <div data-testid="map-stub" />,
}));

// The detail panel transitively imports server actions, chat, and next/image.
// Stub it to a plain node that surfaces the opened listing's title so the
// "detail view opened" assertion is observable without the real subtree.
vi.mock("./listing-detail-panel", () => ({
  ListingDetailPanel: ({ listing }: { listing?: { title?: string } }) => (
    <div data-testid="detail-panel">{listing?.title}</div>
  ),
}));

// The premium card transitively imports next/image + chat widgets; stub it.
vi.mock("@/components/premium/property-card", () => ({
  PropertyCard: ({ property }: { property?: { title?: string } }) => (
    <div data-testid="property-card">{property?.title}</div>
  ),
  SaveIconButton: () => <span data-testid="save-icon" />,
}));

vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: { alt?: string }) => <img alt={props.alt ?? ""} />,
}));

// POI overlay + favorites are orthogonal to mount behavior; stub them so they
// never issue their own fetches or touch storage.
vi.mock("./hooks/use-overpass-pois", () => ({
  useOverpassPois: () => ({ pois: [] }),
}));
vi.mock("./hooks/use-favorites", () => ({
  useFavorites: () => ({ isFavorite: () => false, toggleFavorite: () => {} }),
}));

import { DiscoveryPage } from "./discovery-page";

// --- fetch harness -------------------------------------------------------

/** Records every fetch URL so detail-request counts can be asserted. */
let fetchUrls: string[] = [];

function detailPayload(id: string, title: string) {
  return {
    ok: true,
    json: async () => ({
      ok: true,
      data: { id, title, address: "1 Test Rd", price: 12000, latitude: -33.92, longitude: 18.42, bedrooms: 2, bathrooms: 1 },
    }),
  };
}

beforeEach(() => {
  searchParamsMock = new URLSearchParams();
  routerMock.prefetch.mockClear();
  routerMock.replace.mockClear();
  fetchUrls = [];

  // Real timers are used here: no Viewport_Query (bounds never set) and no
  // geolocation timer fire on mount, and a successful Detail_Loader fetch
  // clears its 2000ms timeout in `.finally`. Real timers let `waitFor` flush
  // the real promise microtasks the fetch chain resolves through.

  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      fetchUrls.push(url);
      // Deep-link Detail_Loader request.
      const match = /\/api\/listings\/([^?]+)$/.exec(url);
      if (match) {
        return Promise.resolve(detailPayload(match[1], `Listing ${match[1]}`) as unknown as Response);
      }
      // Any viewport query (should not happen without bounds) resolves empty.
      return Promise.resolve({ ok: true, json: async () => ({ ok: true, data: { listings: [] } }) } as unknown as Response);
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

function detailFetchCount(id: string) {
  return fetchUrls.filter((url) => url === `/api/listings/${id}`).length;
}

// --- tests ---------------------------------------------------------------

describe("DiscoveryPage deep-link auto-open (Req 13.4)", () => {
  it("opens the detail view once when a listingId URL param is present", async () => {
    searchParamsMock = new URLSearchParams("listingId=l-42");

    render(<DiscoveryPage googleMapsApiKey="test-key" />);

    // The detail view opens with the fetched listing's title.
    expect((await screen.findAllByTestId("detail-panel")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Listing l-42").length).toBeGreaterThan(0);

    // Exactly one Detail_Loader request was issued for the deep-linked id.
    expect(detailFetchCount("l-42")).toBe(1);
  });

  it("does not auto-open again across re-renders / search-param churn", async () => {
    searchParamsMock = new URLSearchParams("listingId=l-7");

    const { rerender } = render(<DiscoveryPage googleMapsApiKey="test-key" />);

    await waitFor(() => {
      expect(detailFetchCount("l-7")).toBe(1);
    });

    // A new search-params object (still carrying the same listingId) triggers a
    // re-render; the `hasAutoOpened` guard must keep the auto-open to once.
    searchParamsMock = new URLSearchParams("listingId=l-7&extra=1");
    rerender(<DiscoveryPage googleMapsApiKey="test-key" />);

    // Let any (incorrect) re-open effect + fetch settle before asserting.
    await act(async () => {
      await Promise.resolve();
    });

    // Still exactly one detail request — no re-open.
    expect(detailFetchCount("l-7")).toBe(1);
  });

  it("does not open the detail view without a listingId param", async () => {
    searchParamsMock = new URLSearchParams();

    render(<DiscoveryPage googleMapsApiKey="test-key" />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByTestId("detail-panel")).not.toBeInTheDocument();
    expect(fetchUrls.some((url) => /\/api\/listings\/[^?]+$/.test(url))).toBe(false);
  });
});

describe("DiscoveryPage route prefetch on mount (Req 5.5)", () => {
  it("prefetches /listings and /saved exactly once each per mount", async () => {
    render(<DiscoveryPage googleMapsApiKey="test-key" />);

    await waitFor(() => {
      expect(routerMock.prefetch).toHaveBeenCalledWith("/listings");
      expect(routerMock.prefetch).toHaveBeenCalledWith("/saved");
    });

    const listingsCalls = routerMock.prefetch.mock.calls.filter(([route]) => route === "/listings");
    const savedCalls = routerMock.prefetch.mock.calls.filter(([route]) => route === "/saved");
    expect(listingsCalls).toHaveLength(1);
    expect(savedCalls).toHaveLength(1);
  });
});
