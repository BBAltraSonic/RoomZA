// @vitest-environment jsdom
//
// Viewport_Query Request_Manager behavior (example-based component tests).
// Exercises the AbortController-based supersession, the 2000 ms timeout, and
// the unmount cleanup wired inside `discovery-page.tsx`.
//
// Validates: Requirements 2.1, 2.2, 2.3, 2.6, 12.2
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";

// --- Shared holders (hoisted so vi.mock factories can populate them) --------
const holder = vi.hoisted(() => ({
  /** Captured `onBoundsChange` callback handed to the mocked MapViewLoader. */
  onBoundsChange: null as null | ((bounds: unknown) => void),
}));

// Hoisted so the (hoisted) vi.mock factories below can reference it. The inner
// arrow (the component) closes over the module-level `React` import and only
// dereferences it at render time, by which point the import is initialized.
const { stub } = vi.hoisted(() => ({
  stub: (testId: string) => () => React.createElement("div", { "data-testid": testId }),
}));

// --- Module mocks -----------------------------------------------------------
// next/navigation: return STABLE singletons so the Viewport_Query effect
// (deps: [viewportBounds, searchParams]) does not re-run on every render.
vi.mock("next/navigation", () => {
  const searchParams = new URLSearchParams("");
  const router = {
    replace: vi.fn(),
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  };
  return {
    useSearchParams: () => searchParams,
    usePathname: () => "/",
    useRouter: () => router,
  };
});

vi.mock("next/link", () => ({
  default: (props: { href?: unknown; children?: React.ReactNode }) =>
    React.createElement(
      "a",
      { href: typeof props.href === "string" ? props.href : "#" },
      props.children,
    ),
}));

vi.mock("@/lib/hooks/use-on-click-outside", () => ({
  useOnClickOutside: () => {},
}));

// The map loader is browser-only + dynamically imported in production. Stub it
// and capture the `onBoundsChange` handler so tests can drive Viewport_Query
// issuance. Deliberately does NOT render children (avoids the map SDK tree).
vi.mock("./map-view-loader", () => ({
  MapViewLoader: (props: { onBoundsChange?: (b: unknown) => void; listings?: unknown[] }) => {
    holder.onBoundsChange = props.onBoundsChange ?? null;
    return React.createElement("div", {
      "data-testid": "map-view-loader",
      "data-marker-count": String(props.listings?.length ?? 0),
    });
  },
}));

// Hooks with I/O / external state — neutralized.
vi.mock("./hooks/use-overpass-pois", () => ({
  useOverpassPois: () => ({ pois: [] }),
}));
vi.mock("./hooks/use-favorites", () => ({
  useFavorites: () => ({ isFavorite: () => false, toggleFavorite: vi.fn() }),
}));

// Presentational children stubbed to trivial nodes. Crucially, none of these
// render the listing error, so the ONLY error surface in the tree is the
// desktop inline `role="alert"` block owned by DiscoveryPage itself.
vi.mock("@/components/premium/property-card", () => ({
  PropertyCard: stub("property-card"),
  SaveIconButton: stub("save-icon"),
}));
vi.mock("./listing-detail-panel", () => ({
  ListingDetailPanel: stub("listing-detail-panel"),
}));
vi.mock("./map-controls", () => ({ MapControls: stub("map-controls") }));
vi.mock("./layer-toggle-panel", () => ({ LayerTogglePanel: stub("layer-toggle-panel") }));
vi.mock("./empty-state-capture", () => ({ EmptyStateCapture: stub("empty-state") }));
vi.mock("./filter-bar", () => ({
  FilterBar: (props: { resultCount?: number; isLoading?: boolean }) =>
    React.createElement("div", {
      "data-testid": "filter-bar",
      "data-result-count": String(props.resultCount ?? 0),
      "data-loading": String(Boolean(props.isLoading)),
    }),
}));
vi.mock("./mobile/mobile-discovery-shell", () => ({
  MobileDiscoveryShell: stub("mobile-shell"),
}));
vi.mock("./mobile/bottom-sheet", () => ({ MobileBottomSheet: stub("bottom-sheet") }));
vi.mock("./mobile/listing-card", () => ({ ListingCard: stub("listing-card") }));
vi.mock("./mobile/listing-carousel", () => ({ ListingCarousel: stub("listing-carousel") }));
vi.mock("./mobile/explore-sections", () => ({
  LifestyleStrip: stub("lifestyle-strip"),
  OpenHousesSection: stub("open-houses"),
  CollectionsSection: stub("collections"),
}));

// Imported AFTER the mocks are registered.
import { DiscoveryPage } from "./discovery-page";

// --- fetch mock -------------------------------------------------------------
type DeferredFetch = {
  url: string;
  signal: AbortSignal | undefined;
  resolveWith: (listings: unknown[]) => void;
  rejectWith: (error: unknown) => void;
};

let fetchCalls: DeferredFetch[] = [];

function installFetchMock() {
  fetchCalls = [];
  const fetchMock = vi.fn(
    (input: unknown, init?: { signal?: AbortSignal }) => {
      const signal = init?.signal;
      let resolveFn!: (value: unknown) => void;
      let rejectFn!: (reason: unknown) => void;
      const promise = new Promise<unknown>((res, rej) => {
        resolveFn = res;
        rejectFn = rej;
      });

      // Mirror real fetch: aborting the signal rejects with an AbortError.
      if (signal) {
        signal.addEventListener("abort", () => {
          rejectFn(new DOMException("The operation was aborted.", "AbortError"));
        });
      }

      fetchCalls.push({
        url: String(input),
        signal,
        resolveWith: (listings) =>
          resolveFn({
            ok: true,
            json: async () => ({ ok: true, data: { listings } }),
          }),
        rejectWith: (error) => rejectFn(error),
      });

      return promise;
    },
  );
  vi.stubGlobal("fetch", fetchMock);
}

// --- helpers ----------------------------------------------------------------
const BOUNDS_A = { west: 18.4, south: -33.95, east: 18.5, north: -33.85 };
const BOUNDS_B = { west: 18.41, south: -33.94, east: 18.51, north: -33.84 };

function makeListing(id: string) {
  return {
    id,
    title: `Listing ${id}`,
    area: "Cape Town",
    price: 9500,
    latitude: -33.9,
    longitude: 18.45,
    bedrooms: 2,
    bathrooms: 1,
    imageUrls: [] as string[],
    availabilityDate: null,
    created_at: "2024-01-01T00:00:00.000Z",
  };
}

async function flushPromises() {
  for (let i = 0; i < 6; i += 1) {
    await Promise.resolve();
  }
}

/** Drive a Viewport_Query by simulating a new map bounds report. */
async function reportBounds(bounds: typeof BOUNDS_A) {
  await act(async () => {
    holder.onBoundsChange?.({ ...bounds });
    await flushPromises();
  });
}

function firstResultCount(): number {
  const bars = screen.getAllByTestId("filter-bar");
  return Number(bars[0]?.getAttribute("data-result-count") ?? "0");
}

// Only fake setTimeout/clearTimeout so the component's 2000 ms timeout is
// controllable while promises, microtasks, and Date stay real.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  installFetchMock();
  holder.onBoundsChange = null;
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("DiscoveryPage Viewport_Query Request_Manager", () => {
  it("aborts a superseded in-flight query silently without showing an error (Req 2.1, 2.2)", async () => {
    render(React.createElement(DiscoveryPage, {}));

    // First bounds report → Viewport_Query #1 in flight.
    await reportBounds(BOUNDS_A);
    expect(fetchCalls).toHaveLength(1);
    const first = fetchCalls[0]!;
    const abortSpy = vi.fn();
    first.signal?.addEventListener("abort", abortSpy);

    // Second bounds report supersedes #1 → #1 aborted, #2 issued.
    await reportBounds(BOUNDS_B);
    expect(fetchCalls).toHaveLength(2);
    expect(first.signal?.aborted).toBe(true);
    expect(abortSpy).toHaveBeenCalledTimes(1);

    // Resolve the current (superseding) query successfully.
    await act(async () => {
      fetchCalls[1]!.resolveWith([makeListing("a")]);
      await flushPromises();
    });

    // The silently-aborted request must NOT surface an error indication.
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/could not be loaded/i)).toBeNull();
  });

  it("surfaces an error on a 2000 ms timeout while retaining previously displayed listings (Req 2.3, 12.2)", async () => {
    render(React.createElement(DiscoveryPage, {}));

    // Establish a set of previously displayed listings via a successful query.
    await reportBounds(BOUNDS_A);
    await act(async () => {
      fetchCalls[0]!.resolveWith([makeListing("a"), makeListing("b")]);
      await flushPromises();
    });
    expect(firstResultCount()).toBe(2);
    expect(screen.queryByRole("alert")).toBeNull();

    // Issue a second query and let it hang until the 2000 ms timeout fires.
    await reportBounds(BOUNDS_B);
    expect(fetchCalls).toHaveLength(2);

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await flushPromises();
    });

    // The timed-out load surfaces an error indication. Use the synchronous
    // getByRole (not findByRole) since the abort→reject→setState chain is
    // already flushed above; findByRole would poll on the faked setTimeout and
    // hang.
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/could not be loaded/i);
    // ...and the previously displayed listings are retained.
    expect(firstResultCount()).toBe(2);
  });

  it("aborts the in-flight Viewport_Query when the page unmounts (Req 2.6)", async () => {
    const abortSpy = vi.spyOn(AbortController.prototype, "abort");
    const view = render(React.createElement(DiscoveryPage, {}));

    await reportBounds(BOUNDS_A);
    expect(fetchCalls).toHaveLength(1);
    const inFlight = fetchCalls[0]!;
    expect(inFlight.signal?.aborted).toBe(false);

    const abortsBeforeUnmount = abortSpy.mock.calls.length;

    await act(async () => {
      view.unmount();
      await flushPromises();
    });

    // The unmount cleanup aborted the in-flight request's controller.
    expect(abortSpy.mock.calls.length).toBeGreaterThan(abortsBeforeUnmount);
    expect(inFlight.signal?.aborted).toBe(true);
  });
});
