// @vitest-environment jsdom
//
// Detail_Loader Request_Manager behavior (example-based component tests).
// Exercises the second AbortController (`detailRequestRef`) wired inside
// `discovery-page.tsx`: supersession of an in-flight detail request, the
// 2000 ms detail timeout message, a non-supersession detail failure that keeps
// the map interactive, and unmount cleanup.
//
// Validates: Requirements 2.4, 2.5, 2.6, 14.5
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";

// --- Shared holders (hoisted so vi.mock factories can populate them) --------
const holder = vi.hoisted(() => ({
  /** Captured `onBoundsChange` handed to the mocked MapViewLoader. */
  onBoundsChange: null as null | ((bounds: unknown) => void),
  /** Captured `onViewListing` handed to the mocked MapViewLoader — drives Detail_Loader. */
  onViewListing: null as null | ((listingId: string) => void),
}));

// --- Module mocks -----------------------------------------------------------
// next/navigation: STABLE singletons so the DiscoveryPage effects do not
// re-run on every render. An empty search string means no `listingId` deep
// link, so the only detail requests are the ones the tests trigger explicitly.
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
// and capture both `onBoundsChange` and `onViewListing` so the tests can drive
// the Detail_Loader (via onViewListing) without the real map SDK tree. The
// stub also exposes a stable testid used to assert the map stays interactive.
vi.mock("./map-view-loader", () => ({
  MapViewLoader: (props: {
    onBoundsChange?: (b: unknown) => void;
    onViewListing?: (listingId: string) => void;
    listings?: unknown[];
  }) => {
    holder.onBoundsChange = props.onBoundsChange ?? null;
    holder.onViewListing = props.onViewListing ?? null;
    return React.createElement("div", {
      "data-testid": "map-view-loader",
      "data-marker-count": String(props.listings?.length ?? 0),
    });
  },
}));

// Hooks with I/O / external state — neutralized.
vi.mock("./hooks/use-favorites", () => ({
  useFavorites: () => ({ isFavorite: () => false, toggleFavorite: vi.fn() }),
}));

// Presentational children stubbed to trivial nodes. Crucially, none of these
// render the detail error/loading text, so the ONLY detail-status surface in
// the tree is the desktop inline block owned by DiscoveryPage itself.
// Defined via vi.hoisted so it is initialized before the hoisted vi.mock
// factories execute. `React` is only dereferenced at render time (well after
// the module's React import has evaluated), so the closure is safe.
const { mockStub } = vi.hoisted(() => ({
  mockStub: (testId: string) => () =>
    React.createElement("div", { "data-testid": testId }),
}));

vi.mock("@/components/premium/property-card", () => ({
  PropertyCard: mockStub("property-card"),
  SaveIconButton: mockStub("save-icon"),
}));
vi.mock("./listing-detail-panel", () => ({
  ListingDetailPanel: mockStub("listing-detail-panel"),
}));
vi.mock("./map-controls", () => ({ MapControls: mockStub("map-controls") }));
vi.mock("./empty-state-capture", () => ({ EmptyStateCapture: mockStub("empty-state") }));
vi.mock("./filter-bar", () => ({
  FilterBar: (props: { resultCount?: number; isLoading?: boolean }) =>
    React.createElement("div", {
      "data-testid": "filter-bar",
      "data-result-count": String(props.resultCount ?? 0),
      "data-loading": String(Boolean(props.isLoading)),
    }),
}));
vi.mock("./mobile/mobile-discovery-shell", () => ({
  MobileDiscoveryShell: mockStub("mobile-shell"),
}));
vi.mock("./mobile/bottom-sheet", () => ({ MobileBottomSheet: mockStub("bottom-sheet") }));
vi.mock("./mobile/listing-card", () => ({ ListingCard: mockStub("listing-card") }));
vi.mock("./mobile/listing-carousel", () => ({ ListingCarousel: mockStub("listing-carousel") }));
vi.mock("./mobile/explore-sections", () => ({
  LifestyleStrip: mockStub("lifestyle-strip"),
  OpenHousesSection: mockStub("open-houses"),
}));

// Imported AFTER the mocks are registered.
import { DiscoveryPage } from "./discovery-page";

// --- fetch mock -------------------------------------------------------------
// A deferred fetch that mirrors real fetch semantics: aborting the signal
// rejects the pending promise with an AbortError. Each captured call exposes
// helpers to settle it as a successful detail payload, a not-ok response, or a
// network rejection.
type DeferredFetch = {
  url: string;
  signal: AbortSignal | undefined;
  resolveDetail: (detail: unknown) => void;
  resolveNotOk: () => void;
  rejectWith: (error: unknown) => void;
};

let fetchCalls: DeferredFetch[] = [];

function installFetchMock() {
  fetchCalls = [];
  const fetchMock = vi.fn((input: unknown, init?: { signal?: AbortSignal }) => {
    const signal = init?.signal;
    let resolveFn!: (value: unknown) => void;
    let rejectFn!: (reason: unknown) => void;
    const promise = new Promise<unknown>((res, rej) => {
      resolveFn = res;
      rejectFn = rej;
    });

    if (signal) {
      signal.addEventListener("abort", () => {
        rejectFn(new DOMException("The operation was aborted.", "AbortError"));
      });
    }

    fetchCalls.push({
      url: String(input),
      signal,
      resolveDetail: (detail) =>
        resolveFn({ ok: true, json: async () => ({ ok: true, data: detail }) }),
      resolveNotOk: () => resolveFn({ ok: false, json: async () => ({}) }),
      rejectWith: (error) => rejectFn(error),
    });

    return promise;
  });
  vi.stubGlobal("fetch", fetchMock);
}

// --- helpers ----------------------------------------------------------------
function makeDetail(id: string) {
  return { id, latitude: -33.9, longitude: 18.45 };
}

async function flushPromises() {
  for (let i = 0; i < 6; i += 1) {
    await Promise.resolve();
  }
}

/** Drive a Detail_Loader request by simulating a marker "view listing" action. */
async function viewListing(id: string) {
  await act(async () => {
    holder.onViewListing?.(id);
    await flushPromises();
  });
}

// Only fake setTimeout/clearTimeout so the component's 2000 ms detail timeout
// is controllable while promises, microtasks, and Date stay real.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  installFetchMock();
  holder.onBoundsChange = null;
  holder.onViewListing = null;
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("DiscoveryPage Detail_Loader Request_Manager", () => {
  it("aborts a superseded in-flight detail request silently (Req 2.4)", async () => {
    render(React.createElement(DiscoveryPage, {}));

    // First "view listing" → Detail_Loader request #1 in flight.
    await viewListing("a");
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]!.url).toContain("/api/listings/a");
    const first = fetchCalls[0]!;
    const abortSpy = vi.fn();
    first.signal?.addEventListener("abort", abortSpy);

    // Second "view listing" supersedes #1 → #1 aborted, #2 issued.
    await viewListing("b");
    expect(fetchCalls).toHaveLength(2);
    expect(fetchCalls[1]!.url).toContain("/api/listings/b");
    expect(first.signal?.aborted).toBe(true);
    expect(abortSpy).toHaveBeenCalledTimes(1);

    // Resolve the current (superseding) detail request successfully.
    await act(async () => {
      fetchCalls[1]!.resolveDetail(makeDetail("b"));
      await flushPromises();
    });

    // The silently-aborted (superseded) request must NOT surface an error.
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/could not be loaded/i)).toBeNull();
  });

  it("surfaces the 2-second message when a detail request times out (Req 2.5)", async () => {
    render(React.createElement(DiscoveryPage, {}));

    await viewListing("a");
    expect(fetchCalls).toHaveLength(1);

    // Let the 2000 ms detail timeout fire (aborts with didTimeOut = true).
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await flushPromises();
    });

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/could not be loaded within 2 seconds/i);
  });

  it("shows a detail error while the map stays interactive on a non-supersession failure (Req 14.5)", async () => {
    render(React.createElement(DiscoveryPage, {}));

    await viewListing("a");
    expect(fetchCalls).toHaveLength(1);

    // A real (non-abort) failure: the Detail_API responds not-ok (e.g. 404).
    await act(async () => {
      fetchCalls[0]!.resolveNotOk();
      await flushPromises();
    });

    // The failure surfaces a generic detail error...
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/could not be loaded/i);
    // ...but NOT the timeout-specific message.
    expect(alert.textContent).not.toMatch(/within 2 seconds/i);
    // ...and the Map_Surface remains mounted/interactive.
    expect(screen.getByTestId("map-view-loader")).toBeTruthy();
  });

  it("aborts the in-flight detail request when the page unmounts (Req 2.6)", async () => {
    const abortSpy = vi.spyOn(AbortController.prototype, "abort");
    const view = render(React.createElement(DiscoveryPage, {}));

    await viewListing("a");
    expect(fetchCalls).toHaveLength(1);
    const inFlight = fetchCalls[0]!;
    expect(inFlight.signal?.aborted).toBe(false);

    const abortsBeforeUnmount = abortSpy.mock.calls.length;

    await act(async () => {
      view.unmount();
      await flushPromises();
    });

    // The unmount cleanup aborted the in-flight detail request's controller.
    expect(abortSpy.mock.calls.length).toBeGreaterThan(abortsBeforeUnmount);
    expect(inFlight.signal?.aborted).toBe(true);
  });
});
