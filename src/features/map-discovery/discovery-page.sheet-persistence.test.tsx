// @vitest-environment jsdom

/**
 * Discovery_Page_Experience — Bottom_Sheet snap persistence tests.
 *
 * Verifies the session-storage persistence wiring in `discovery-page.tsx`
 * around the mobile Bottom_Sheet snap position:
 *  - Req 13.1: changing the Bottom_Sheet snap position persists the new snap
 *    position to browser session storage.
 *  - Req 13.2: mounting with a persisted snap position restores the sheet to
 *    that snap position.
 *  - Req 13.3: when session storage is unavailable, the page continues to
 *    operate using the default snap position without raising an error.
 *
 * These are example-based component tests (not property tests). They mirror the
 * setup used by the sibling discovery-page.*.test.tsx files (states,
 * request-manager, pipeline) and focus solely on the persistence behavior owned
 * by the orchestrator — the Bottom_Sheet's drag/layout mechanics are owned by
 * `mobile-map-discovery` and are stubbed here.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// The sessionStorage key used by discovery-page.tsx (a private module constant,
// mirrored here so the test asserts against the exact persisted key).
const SHEET_SNAP_STORAGE_KEY = "roomza:mobile-sheet-snap";

// --- Module mocks --------------------------------------------------------

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
// which is irrelevant to snap persistence. Replace it with a light stub.
vi.mock("./map-view-loader", () => ({
  MapViewLoader: () => <div data-testid="map-stub" />,
}));

// Stub the Bottom_Sheet: expose its `snap` prop for observation and buttons that
// drive `onSnapChange` (the sole trigger of the persistence path). The real
// sheet's drag/keyboard mechanics belong to `mobile-map-discovery`.
vi.mock("./mobile/bottom-sheet", () => ({
  MobileBottomSheet: ({
    snap,
    onSnapChange,
  }: {
    snap: string;
    onSnapChange: (next: string) => void;
  }) => (
    <div data-testid="bottom-sheet">
      <span data-testid="current-snap">{snap}</span>
      <button type="button" onClick={() => onSnapChange("peek")}>
        snap-peek
      </button>
      <button type="button" onClick={() => onSnapChange("browse")}>
        snap-browse
      </button>
      <button type="button" onClick={() => onSnapChange("full")}>
        snap-full
      </button>
    </div>
  ),
}));

// The premium card transitively imports next/image + chat widgets; stub to a
// plain node so rendering the carousel never fails.
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

vi.mock("./hooks/use-favorites", () => ({
  useFavorites: () => ({ isFavorite: () => false, toggleFavorite: () => {} }),
}));

import { DiscoveryPage } from "./discovery-page";

// --- setup ---------------------------------------------------------------

beforeEach(() => {
  searchParamsMock = new URLSearchParams();
  routerMock.replace.mockClear();
  routerMock.prefetch.mockClear();
  window.sessionStorage.clear();

  // Real timers are used here: these tests never trigger a Viewport_Query (no
  // bounds change), so the 2000ms request-timeout timer is never armed, and
  // real timers keep `waitFor` polling/timeout behavior working correctly.

  // No Viewport_Query is triggered in these tests, but stub fetch defensively so
  // any incidental fetch never hits the network.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>(() => {})),
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
  window.sessionStorage.clear();
});

function renderPage() {
  return render(<DiscoveryPage googleMapsApiKey="test-key" />);
}

// --- tests ---------------------------------------------------------------

describe("DiscoveryPage Bottom_Sheet snap persistence", () => {
  it("persists a changed snap position to session storage (Req 13.1)", async () => {
    renderPage();

    // Default snap is Peek and nothing is persisted yet.
    expect(screen.getByTestId("current-snap")).toHaveTextContent("peek");
    expect(window.sessionStorage.getItem(SHEET_SNAP_STORAGE_KEY)).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByText("snap-full"));
    });

    // The change is reflected in the sheet and persisted to session storage.
    await waitFor(() => {
      expect(screen.getByTestId("current-snap")).toHaveTextContent("full");
    });
    expect(window.sessionStorage.getItem(SHEET_SNAP_STORAGE_KEY)).toBe("full");

    // A subsequent change overwrites the persisted value.
    await act(async () => {
      fireEvent.click(screen.getByText("snap-browse"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("current-snap")).toHaveTextContent("browse");
    });
    expect(window.sessionStorage.getItem(SHEET_SNAP_STORAGE_KEY)).toBe("browse");
  });

  it("restores the persisted snap position on mount (Req 13.2)", async () => {
    // Seed a persisted snap before the page mounts.
    window.sessionStorage.setItem(SHEET_SNAP_STORAGE_KEY, "browse");

    renderPage();

    // The one-time post-mount hydration restores the sheet to the saved snap.
    await waitFor(() => {
      expect(screen.getByTestId("current-snap")).toHaveTextContent("browse");
    });
  });

  it("migrates the former half position to Browse", async () => {
    window.sessionStorage.setItem(SHEET_SNAP_STORAGE_KEY, "half");

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("current-snap")).toHaveTextContent("browse");
    });
  });

  it("ignores an invalid persisted value and uses the default snap (Req 13.2)", async () => {
    window.sessionStorage.setItem(SHEET_SNAP_STORAGE_KEY, "not-a-real-snap");

    renderPage();

    // An unrecognized stored value is not applied; the default remains.
    await waitFor(() => {
      expect(screen.getByTestId("map-stub")).toBeInTheDocument();
    });
    expect(screen.getByTestId("current-snap")).toHaveTextContent("peek");
  });

  it("falls back to the default snap without raising an error when session storage is unavailable (Req 13.3)", async () => {
    // Simulate private-mode / disabled storage: both reads and writes throw.
    // Replacing the whole `sessionStorage` accessor is more reliable than
    // spying, because jsdom implements Storage as a Proxy.
    const getItem = vi.fn(() => {
      throw new Error("SecurityError: sessionStorage is unavailable");
    });
    const setItem = vi.fn(() => {
      throw new Error("SecurityError: sessionStorage is unavailable");
    });
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, "sessionStorage");
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get: () => ({ getItem, setItem, removeItem: vi.fn(), clear: vi.fn() }),
    });

    try {
      // Mounting (which reads storage) must not throw and must use the default.
      expect(() => renderPage()).not.toThrow();
      await waitFor(() => {
        expect(screen.getByTestId("map-stub")).toBeInTheDocument();
      });
      expect(screen.getByTestId("current-snap")).toHaveTextContent("peek");
      expect(getItem).toHaveBeenCalled();

      // Changing the snap (which writes storage) must not throw either, and the
      // in-memory state still updates so the sheet stays operable.
      await act(async () => {
        fireEvent.click(screen.getByText("snap-full"));
      });
      await waitFor(() => {
        expect(screen.getByTestId("current-snap")).toHaveTextContent("full");
      });
      expect(setItem).toHaveBeenCalled();
    } finally {
      // Restore the real sessionStorage accessor for subsequent tests.
      if (originalDescriptor) {
        Object.defineProperty(window, "sessionStorage", originalDescriptor);
      }
    }
  });
});
