// @vitest-environment jsdom

/**
 * Discovery_Page_Experience — loading / error / retry / empty state tests.
 *
 * Verifies the state machine wired in `discovery-page.tsx` around the
 * Viewport_Query:
 *  - Req 12.1: while a Viewport_Query is in flight, a loading indication shows.
 *  - Req 12.2: a failed/timed-out query retains the previously displayed
 *    listings until a subsequent query succeeds.
 *  - Req 12.3: a failed/timed-out query shows an error indication with a retry
 *    control.
 *  - Req 12.4: activating retry re-issues the Viewport_Query for the current
 *    bounds and shows the loading indication again.
 *  - Req 12.5: a zero-result successful load shows the empty-state content.
 *
 * These are example-based component tests (not property tests). Render helpers
 * are defined locally to keep this file self-contained alongside the sibling
 * discovery-page.*.test.tsx files created by tasks 6.2/6.3/6.4/7.1.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

// --- Module mocks --------------------------------------------------------

// next/navigation: a stable pathname + empty search params + no-op router.
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
// which is irrelevant to state behavior. Replace it with a light stub that
// exposes buttons to drive `onBoundsChange` (the sole trigger of a
// Viewport_Query). Two distinct bounds let a test issue a *new* query.
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
        set-bounds-a
      </button>
      <button
        type="button"
        onClick={() => onBoundsChange?.({ west: 18.6, south: -33.85, east: 18.7, north: -33.8 })}
      >
        set-bounds-b
      </button>
    </div>
  ),
}));

// The premium card transitively imports next/image + chat widgets. For these
// state tests we only need the listing title to appear so retention is
// observable — so stub it to a plain node.
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

// POI overlay + favorites are orthogonal to listing-load state; stub them so
// they never issue their own fetches or touch storage.
vi.mock("./hooks/use-overpass-pois", () => ({
  useOverpassPois: () => ({ pois: [] }),
}));
vi.mock("./hooks/use-favorites", () => ({
  useFavorites: () => ({ isFavorite: () => false, toggleFavorite: () => {} }),
}));

import { DiscoveryPage } from "./discovery-page";

// --- fetch harness -------------------------------------------------------

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Each fetch call parks on its own deferred so tests control resolution. */
let fetchDeferreds: Deferred<unknown>[] = [];

function jsonResponse(listings: unknown[]) {
  return {
    ok: true,
    json: async () => ({ ok: true, data: { listings } }),
  };
}

function listing(id: string, title: string) {
  return {
    id,
    title,
    area: "Cape Town",
    price: 12000,
    latitude: -33.92,
    longitude: 18.42,
    bedrooms: 2,
    bathrooms: 1,
    imageUrls: [],
    availabilityDate: null,
    created_at: "2024-01-01T00:00:00.000Z",
  };
}

/** The mobile carousel renders skeleton placeholders while loading with no cards. */
function loadingSkeletonCount() {
  return document.querySelectorAll(".animate-pulse").length;
}

beforeEach(() => {
  searchParamsMock = new URLSearchParams();
  routerMock.replace.mockClear();
  routerMock.prefetch.mockClear();
  fetchDeferreds = [];
  // Real timers are used here (mirroring the sibling discovery-page.mount.test).
  // `@testing-library`'s `waitFor`/`findBy*` only detect and advance fake timers
  // when a `jest` global is present; under vitest with `globals: false` there is
  // no `jest` global, so `waitFor` schedules its polling through `setTimeout`.
  // Faking `setTimeout` without ever advancing it therefore freezes that polling
  // and any `waitFor` whose first synchronous check fails blocks until the test
  // timeout. Real timers let `waitFor` flush the real promise microtasks the
  // fetch chain resolves through. The 2000ms Viewport_Query timeout is harmless:
  // resolved/rejected queries settle synchronously well under 2s, and a parked
  // query's deferred is not linked to the AbortController signal, so the
  // timeout's `.abort()` never rejects the pending fetch and never surfaces an
  // error inside the sub-second assertion window.

  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      const d = createDeferred<unknown>();
      fetchDeferreds.push(d);
      return d.promise as Promise<Response>;
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
async function issueQuery(button: "set-bounds-a" | "set-bounds-b") {
  await act(async () => {
    fireEvent.click(screen.getAllByText(button)[0]);
  });
}

async function resolveFetch(index: number, listings: unknown[]) {
  await act(async () => {
    fetchDeferreds[index].resolve(jsonResponse(listings));
  });
}

async function rejectFetch(index: number) {
  await act(async () => {
    fetchDeferreds[index].reject(new Error("network failure"));
  });
}

/**
 * Locate the listings error indication. The page mounts both the desktop and
 * mobile layouts, and the desktop detail-panel error slot also keys off the
 * shared `listingError` state, so a failed Viewport_Query renders more than one
 * `role="alert"` node. Req 12.3 specifies an error indication *with a retry
 * control*, so we select the alert that actually carries the Retry button.
 */
async function findListingsErrorAlert(): Promise<HTMLElement> {
  const alerts = await screen.findAllByRole("alert");
  const alert = alerts.find((el) => within(el).queryByRole("button", { name: /retry/i }));
  if (!alert) {
    throw new Error("Expected a listings error alert containing a retry control");
  }
  return alert;
}

// --- tests ---------------------------------------------------------------

describe("DiscoveryPage listing states", () => {
  it("shows a loading indication while a Viewport_Query is in flight (Req 12.1)", async () => {
    renderPage();
    await issueQuery("set-bounds-a");

    // The query is parked (unresolved) — the carousel shows skeletons and
    // neither the empty state nor an error is shown yet.
    await waitFor(() => {
      expect(fetchDeferreds).toHaveLength(1);
      expect(loadingSkeletonCount()).toBeGreaterThan(0);
    });
    expect(screen.queryByText("Where to next?")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the empty state on a zero-result successful load (Req 12.5)", async () => {
    renderPage();
    await issueQuery("set-bounds-a");
    await resolveFetch(0, []);

    await waitFor(() => {
      expect(screen.getAllByText("Where to next?").length).toBeGreaterThan(0);
    });
    // Loading is done and there is no error.
    expect(loadingSkeletonCount()).toBe(0);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("retains prior listings and surfaces an error with a retry control on failure (Req 12.2, 12.3)", async () => {
    renderPage();

    // First query succeeds and populates listings.
    await issueQuery("set-bounds-a");
    await resolveFetch(0, [listing("l1", "Sea Point Studio"), listing("l2", "Gardens Loft")]);
    await waitFor(() => {
      expect(screen.getAllByText("Sea Point Studio").length).toBeGreaterThan(0);
    });

    // A second query (new bounds) fails.
    await issueQuery("set-bounds-b");
    await rejectFetch(1);

    // Error indication + retry control appear...
    const alert = await findListingsErrorAlert();
    expect(within(alert).getByRole("button", { name: /retry/i })).toBeInTheDocument();

    // ...and the previously displayed listings are retained (Req 12.2).
    expect(screen.getAllByText("Sea Point Studio").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Gardens Loft").length).toBeGreaterThan(0);
  });

  it("re-issues the Viewport_Query and shows loading again when retry is activated (Req 12.4)", async () => {
    renderPage();

    // First query fails (no listings ever displayed).
    await issueQuery("set-bounds-a");
    await rejectFetch(0);

    const alert = await findListingsErrorAlert();
    const retry = within(alert).getByRole("button", { name: /retry/i });
    expect(fetchDeferreds).toHaveLength(1);

    // Activate retry → a new query for the current bounds is issued and the
    // loading indication returns.
    await act(async () => {
      fireEvent.click(retry);
    });

    await waitFor(() => {
      expect(fetchDeferreds.length).toBe(2);
      expect(loadingSkeletonCount()).toBeGreaterThan(0);
    });
    // The error indication is cleared while the retry is in flight.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
