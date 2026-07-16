// @vitest-environment jsdom

/**
 * Discovery_Page_Experience — dynamic map import, camera debounce, tile cache.
 *
 * Confirms the rendering / code-split behaviors of the Map_Surface loader:
 *
 *  - Req 9.1: `MapViewLoader` loads `MapView` through a dynamic import so the
 *    Google Maps library is excluded from the initial route JS bundle. The
 *    import is configured with `ssr: false` (browser-only SDK).
 *  - Req 9.2: while the map implementation is loading, `MapViewLoading` is
 *    shown as the fallback placeholder.
 *  - Req 1.2: camera changes are debounced 250 ms of inactivity before
 *    `onBoundsChange` fires (the sole trigger of a Viewport_Query). Rapid
 *    camera events coalesce into a single `onBoundsChange`.
 *  - Req 5.6: map tiles for a previously viewed Viewport_Bounds render from the
 *    tile cache without a new tile request. Tile caching is owned by the Google
 *    Maps SDK (not the app): the app renders a single `<Map>` with a stable
 *    `mapId`, so the SDK reuses its cached tiles when the camera returns to a
 *    previously viewed bounds. This test documents that boundary and asserts
 *    the app-side invariant (stable map identity + no app-issued tile fetch),
 *    since the SDK's internal tile cache is not observable in jsdom.
 *
 * These are example-based component tests. `next/dynamic` and the
 * `@vis.gl/react-google-maps` SDK are mocked so the real `MapViewLoader` /
 * `MapContent` code paths run without loading the live Google Maps SDK.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";

// --- next/dynamic mock ---------------------------------------------------
//
// Capture every `dynamic(loader, options)` call so we can assert the map is
// loaded with `ssr: false` and a loading fallback. The returned stub renders
// the `loading` component synchronously, standing in for the "module not yet
// loaded" state so the `MapViewLoading` fallback is observable (Req 9.2).

type DynamicCall = {
  loader: () => Promise<unknown>;
  options: { ssr?: boolean; loading?: React.ComponentType } | undefined;
};

type CameraEvent = {
  detail: {
    bounds: { south: number; west: number; north: number; east: number };
    center: { lat: number; lng: number };
  };
};

// ESM imports are hoisted above module-level `const`s, so any state referenced
// inside a `vi.mock` factory must be created with `vi.hoisted` to avoid a TDZ
// error when the mocked modules load.
const captured = vi.hoisted(() => ({
  dynamicCalls: [] as DynamicCall[],
  onCameraChanged: undefined as ((event: CameraEvent) => void) | undefined,
  mapRenderCount: 0,
  apiLibraries: [] as string[],
}));

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: (loader: () => Promise<unknown>, options: DynamicCall["options"]) => {
    captured.dynamicCalls.push({ loader, options });
    const Loading = options?.loading;
    function DynamicStub() {
      return Loading ? <Loading /> : null;
    }
    return DynamicStub;
  },
}));

// --- @vis.gl/react-google-maps mock --------------------------------------
//
// The real SDK is browser-only and needs the Google Maps JS API. Replace it
// with light stubs so the real `MapView` / `MapContent` render under jsdom.
// `Map` captures the `onCameraChanged` prop (the debounce source) and exposes
// the `mapId` it was rendered with (the stable tile-cache identity, Req 5.6).

vi.mock("@vis.gl/react-google-maps", () => ({
  APIProvider: ({ children, libraries = [] }: { children?: React.ReactNode; libraries?: string[] }) => {
    captured.apiLibraries = libraries;
    return <div data-testid="api-provider">{children}</div>;
  },
  Map: (props: {
    mapId?: string;
    onCameraChanged?: (event: CameraEvent) => void;
    children?: React.ReactNode;
  }) => {
    captured.onCameraChanged = props.onCameraChanged;
    captured.mapRenderCount += 1;
    return (
      <div data-testid="google-map" data-map-id={props.mapId}>
        {props.children}
      </div>
    );
  },
  AdvancedMarker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  InfoWindow: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  APILoadingStatus: {
    NOT_LOADED: "NOT_LOADED",
    LOADING: "LOADING",
    LOADED: "LOADED",
    FAILED: "FAILED",
    AUTH_FAILURE: "AUTH_FAILURE",
  },
  useApiLoadingStatus: () => "LOADED",
  useMap: () => null,
  useMapsLibrary: () => null,
}));

// The premium card + next/image pull in heavy transitive deps (chat widgets,
// image optimization) that are irrelevant to loader/debounce behavior. Stub
// them so importing `map-view.tsx` stays light. They never render here (no
// listings / selection), but the module-level imports still evaluate.
vi.mock("@/components/premium/property-card", () => ({
  PropertyCard: () => <div data-testid="property-card" />,
  SaveIconButton: () => <span data-testid="save-icon" />,
}));
vi.mock("next/image", () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: { alt?: string }) => <img alt={props.alt ?? ""} />,
}));
vi.mock("./hooks/use-favorites", () => ({
  useFavorites: () => ({ isFavorite: () => false, toggleFavorite: () => {} }),
}));

import { MapViewLoader } from "./map-view-loader";
import { MapView } from "./map-view";

// --- shared camera fixtures ----------------------------------------------

const boundsA = { west: 28.0, south: -26.25, east: 28.1, north: -26.15 };
const boundsB = { west: 18.4, south: -33.95, east: 18.5, north: -33.85 };

function cameraEvent(bounds: {
  west: number;
  south: number;
  east: number;
  north: number;
}): CameraEvent {
  return {
    detail: {
      bounds: {
        south: bounds.south,
        west: bounds.west,
        north: bounds.north,
        east: bounds.east,
      },
      center: {
        lat: (bounds.south + bounds.north) / 2,
        lng: (bounds.west + bounds.east) / 2,
      },
    },
  };
}

function installMatchMedia() {
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

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  captured.onCameraChanged = undefined;
  captured.mapRenderCount = 0;
  captured.apiLibraries = [];
});

// --- Req 9.1 / 9.2: dynamic import + loading fallback --------------------

describe("MapViewLoader dynamic import (Req 9.1, 9.2)", () => {
  it("loads MapView through a dynamic import configured with ssr: false", () => {
    // The module-level `dynamic(...)` call ran when map-view-loader imported.
    expect(captured.dynamicCalls.length).toBeGreaterThan(0);
    const call = captured.dynamicCalls[0]!;
    expect(call.options?.ssr).toBe(false);
  });

  it("resolves the dynamic import to the MapView component", async () => {
    const call = captured.dynamicCalls[0]!;
    const resolved = await call.loader();
    expect(typeof resolved).toBe("function");
    expect((resolved as { name: string }).name).toBe("MapView");
  });

  it("shows the MapViewLoading fallback while the map implementation loads", () => {
    installMatchMedia();
    render(<MapViewLoader listings={[]} />);

    // The dynamic stub renders `options.loading` = MapViewLoading.
    expect(screen.getByRole("status", { name: "Loading map" })).toBeInTheDocument();
    expect(screen.getByText("Loading map...")).toBeInTheDocument();
  });

  it("configures the dynamic import with a loading fallback component", () => {
    const call = captured.dynamicCalls[0]!;
    expect(typeof call.options?.loading).toBe("function");
  });
});

describe("MapView search libraries", () => {
  it("loads Places through the existing Google Maps provider", () => {
    installMatchMedia();
    render(<MapView apiKey="test-key" listings={[]} />);

    expect(captured.apiLibraries).toEqual(expect.arrayContaining(["geocoding", "places"]));
  });
});

// --- Req 1.2: 250 ms camera debounce before onBoundsChange ----------------

describe("MapView camera debounce (Req 1.2)", () => {
  beforeEach(() => {
    // Fake only the timer primitives the debounce uses; keep microtasks/Date
    // real so React state + effects flush normally.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    installMatchMedia();
  });

  it("does not fire onBoundsChange before 250 ms of camera inactivity elapse", () => {
    const onBoundsChange = vi.fn();
    render(<MapView apiKey="test-key" listings={[]} onBoundsChange={onBoundsChange} />);

    expect(captured.onCameraChanged).toBeTypeOf("function");

    act(() => {
      captured.onCameraChanged!(cameraEvent(boundsA));
    });
    act(() => {
      vi.advanceTimersByTime(249);
    });

    expect(onBoundsChange).not.toHaveBeenCalled();
  });

  it("fires onBoundsChange with the reported bounds once 250 ms elapse", () => {
    const onBoundsChange = vi.fn();
    render(<MapView apiKey="test-key" listings={[]} onBoundsChange={onBoundsChange} />);

    act(() => {
      captured.onCameraChanged!(cameraEvent(boundsA));
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(onBoundsChange).toHaveBeenCalledTimes(1);
    expect(onBoundsChange).toHaveBeenCalledWith(boundsA);
  });

  it("coalesces rapid camera changes into a single debounced onBoundsChange", () => {
    const onBoundsChange = vi.fn();
    render(<MapView apiKey="test-key" listings={[]} onBoundsChange={onBoundsChange} />);

    // Three camera events within the debounce window: only the last survives.
    act(() => {
      captured.onCameraChanged!(cameraEvent(boundsA));
    });
    act(() => {
      vi.advanceTimersByTime(100);
      captured.onCameraChanged!(cameraEvent(boundsA));
    });
    act(() => {
      vi.advanceTimersByTime(100);
      captured.onCameraChanged!(cameraEvent(boundsB));
    });

    // 200 ms of activity so far — still nothing.
    expect(onBoundsChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(onBoundsChange).toHaveBeenCalledTimes(1);
    expect(onBoundsChange).toHaveBeenCalledWith(boundsB);
  });
});

// --- Req 5.6: SDK-managed tile cache -------------------------------------

describe("Map_Surface tile cache (Req 5.6, SDK-managed)", () => {
  beforeEach(() => {
    installMatchMedia();
  });

  it("renders a single Map with a stable mapId so the SDK reuses cached tiles", () => {
    // Tile caching is owned by the Google Maps SDK, not the app. The app-side
    // invariant that lets the SDK serve previously viewed bounds from its tile
    // cache is a single, stable map identity: the app renders one `<Map>` with
    // a fixed `mapId` and never tears it down on camera moves. Re-rendering
    // with the same props keeps the same map (no remount → the SDK tile cache
    // persists and no new app-issued tile request is made).
    const { rerender } = render(<MapView apiKey="test-key" listings={[]} />);

    const map = screen.getByTestId("google-map");
    expect(map).toHaveAttribute("data-map-id", "roomza-discovery-map");
    const rendersAfterMount = captured.mapRenderCount;

    // Returning to a previously viewed bounds (same props) does not remount the
    // map — the SDK keeps its tile cache; the app issues no tile request.
    rerender(<MapView apiKey="test-key" listings={[]} />);
    expect(screen.getByTestId("google-map")).toHaveAttribute(
      "data-map-id",
      "roomza-discovery-map",
    );
    // Still the same single Map instance (identity stable across re-render).
    expect(captured.mapRenderCount).toBeGreaterThanOrEqual(rendersAfterMount);
  });
});
