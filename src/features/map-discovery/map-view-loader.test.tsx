// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

type DynamicCall = {
  loader: () => Promise<unknown>;
  options?: { ssr?: boolean; loading?: React.ComponentType };
};

const captured = vi.hoisted(() => {
  const bounds = {
    west: 18.4,
    south: -33.95,
    east: 18.5,
    north: -33.85,
  };
  const mapApi = {
    getBounds: vi.fn(() => ({
      getWest: () => bounds.west,
      getSouth: () => bounds.south,
      getEast: () => bounds.east,
      getNorth: () => bounds.north,
    })),
    getCenter: vi.fn(() => ({ lng: 18.45, lat: -33.9 })),
    getZoom: vi.fn(() => 13),
    getMap: vi.fn(() => ({ setConfigProperty: vi.fn(), getContainer: () => ({ clientHeight: 900 }) })),
    resize: vi.fn(),
    setCenter: vi.fn(),
    easeTo: vi.fn(),
    fitBounds: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
  };
  return {
    bounds,
    dynamicCalls: [] as DynamicCall[],
    mapProps: null as null | Record<string, unknown>,
    mapApi,
    reverse: vi.fn(),
    category: vi.fn(),
    toggleFavorite: vi.fn(),
  };
});

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: (loader: () => Promise<unknown>, options: DynamicCall["options"]) => {
    captured.dynamicCalls.push({ loader, options });
    const Loading = options?.loading;
    return function DynamicStub() {
      return Loading ? <Loading /> : null;
    };
  },
}));

vi.mock("@/lib/maptiler", () => ({
  getMapTilerStyleUrl: (_apiKey: string, dark: boolean) =>
    `https://api.maptiler.com/maps/${dark ? "base-v4-dark" : "base-v4-light"}/style.json?key=test-token`,
  reverseGeocode: captured.reverse,
  forwardGeocode: captured.category,
}));

vi.mock("./hooks/use-favorites", () => ({
  useFavorites: () => ({
    isFavorite: () => false,
    toggleFavorite: captured.toggleFavorite,
  }),
}));

vi.mock("react-map-gl/maplibre", async () => {
  const React = await import("react");
  const MapLibreMap = React.forwardRef(function MockMapLibreMap(
    props: Record<string, unknown> & { children?: React.ReactNode },
    ref: React.ForwardedRef<typeof captured.mapApi>,
  ) {
    React.useImperativeHandle(ref, () => captured.mapApi);
    React.useEffect(() => {
      (props.onLoad as (() => void) | undefined)?.();
      // The mock models the SDK's one-time load event.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    captured.mapProps = props;
    return (
      <div data-testid="maplibre-map" data-style={String(props.mapStyle)}>
        {props.children}
      </div>
    );
  });

  return {
    __esModule: true,
    default: MapLibreMap,
    Marker: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="maplibre-marker">{children}</div>
    ),
    Popup: ({ children, maxWidth }: { children?: React.ReactNode; maxWidth?: string }) => (
      <div data-testid="maplibre-popup" data-max-width={maxWidth}>{children}</div>
    ),
    Source: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    Layer: () => null,
  };
});

vi.mock("next/image", () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: { alt?: string }) => <img alt={props.alt ?? ""} />,
}));

import { MapView } from "./map-view";
import { MapViewLoader } from "./map-view-loader";
import { version as mapLibreVersion } from "maplibre-gl/package.json";

function installBrowserStubs(desktop = false) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: desktop && query.includes("min-width"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
  vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
}

beforeEach(() => {
  Object.assign(captured.bounds, {
    west: 18.4,
    south: -33.95,
    east: 18.5,
    north: -33.85,
  });
  captured.mapProps = null;
  captured.mapApi.getZoom.mockReturnValue(11);
  captured.reverse.mockReset().mockResolvedValue([]);
  captured.category.mockReset().mockResolvedValue([]);
  captured.toggleFavorite.mockReset();
  for (const method of [
    captured.mapApi.resize,
    captured.mapApi.setCenter,
    captured.mapApi.easeTo,
    captured.mapApi.fitBounds,
    captured.mapApi.zoomIn,
    captured.mapApi.zoomOut,
  ]) {
    method.mockClear();
  }
  installBrowserStubs();
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("MapViewLoader", () => {
  it("keeps the MapLibre implementation browser-only and exposes a loading fallback", async () => {
    const call = captured.dynamicCalls[0]!;
    expect(call.options?.ssr).toBe(false);
    expect(call.options?.loading).toBeTypeOf("function");
    expect(await call.loader()).toBeTypeOf("function");

    render(<MapViewLoader mapApiKey="test-token" listings={[]} />);
    expect(screen.getByRole("status", { name: "Loading map" })).toBeInTheDocument();
  });
});

describe("MapView camera and provider configuration", () => {
  it("does not interrupt a stored-place recenter with a queued resize at map load", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => { frames.push(callback); return frames.length; }));
    render(<MapView mapApiKey="test-token" listings={[]} searchQuery="Stored Cape Town place"
      searchTarget={{ nonce: 1, center: { lat: -33.96, lng: 18.47 }, bounds: { west: 18.4, south: -34, east: 18.6, north: -33.9 } }} />);
    await screen.findByTestId("maplibre-map");
    expect(captured.mapApi.fitBounds).toHaveBeenCalled();
    await act(async () => { frames.forEach(callback => callback(0)); });
    expect(captured.mapApi.resize).toHaveBeenCalled();
    expect(captured.mapApi.setCenter).not.toHaveBeenCalled();
  });
  it("renders MapTiler Base with required attribution and the supplied key", async () => {
    render(<MapView mapApiKey="test-token" listings={[]} />);

    expect(await screen.findByTestId("maplibre-map")).toHaveAttribute(
      "data-style",
      "https://api.maptiler.com/maps/base-v4-light/style.json?key=test-token",
    );
    expect(captured.mapProps).toMatchObject({
      attributionControl: { compact: true },
      reuseMaps: true,
      workerUrl: `/maplibre/${mapLibreVersion}/maplibre-gl-worker.mjs`,
    });
  });

  it("emits one bounds update 250 ms after moveend", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const onBoundsChange = vi.fn();
    render(<MapView mapApiKey="test-token" listings={[]} onBoundsChange={onBoundsChange} />);
    await act(async () => {});
    act(() => {
      vi.runOnlyPendingTimers();
      onBoundsChange.mockClear();
    });

    act(() => {
      (captured.mapProps?.onMoveEnd as (() => void))();
      vi.advanceTimersByTime(249);
    });
    expect(onBoundsChange).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onBoundsChange).toHaveBeenCalledOnce();
    expect(onBoundsChange).toHaveBeenCalledWith(captured.bounds);
  });

  it("coalesces rapid moveend events and retains only the latest bounds", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const onBoundsChange = vi.fn();
    render(<MapView mapApiKey="test-token" listings={[]} onBoundsChange={onBoundsChange} />);
    await act(async () => {});
    act(() => {
      vi.runOnlyPendingTimers();
      onBoundsChange.mockClear();
      (captured.mapProps?.onMoveEnd as (() => void))();
      captured.bounds.west = 19;
      (captured.mapProps?.onMoveEnd as (() => void))();
      vi.advanceTimersByTime(250);
    });

    expect(onBoundsChange).toHaveBeenCalledOnce();
    expect(onBoundsChange).toHaveBeenCalledWith(expect.objectContaining({ west: 19 }));
  });

  it("shows a list-only fallback when the public token is absent", () => {
    render(<MapView listings={[]} />);
    expect(screen.getByText("The map is not configured.")).toBeInTheDocument();
  });
});

describe("MapView interaction surfaces", () => {
  it("never renders broad clusters and close-up price pins together", async () => {
    render(
      <MapView
        mapApiKey="test-token"
        listings={[
          {
            id: "home-1",
            title: "First home",
            area: "Braamfontein",
            price: "R 8,200",
            coordinates: { lat: -33.9, lng: 18.45 },
          },
          {
            id: "home-2",
            title: "Second home",
            area: "Braamfontein",
            price: "R 8,600",
            coordinates: { lat: -33.9001, lng: 18.4501 },
          },
        ]}
      />,
    );

    expect(await screen.findByRole("button", { name: "Preview 2 homes" }))
      .toBeInTheDocument();
    expect(screen.queryByText("R 8,200")).not.toBeInTheDocument();

    act(() => {
      (captured.mapProps?.onMove as (event: {
        viewState: { zoom: number; latitude: number; longitude: number };
      }) => void)({
        viewState: { zoom: 15, latitude: -33.9, longitude: 18.45 },
      });
    });

    expect(screen.queryByRole("button", { name: "Preview 2 homes" }))
      .not.toBeInTheDocument();
    expect(screen.getByText("R 8,200")).toBeInTheDocument();
    expect(screen.getByText("R 8,600")).toBeInTheDocument();
  });

  it("shows the desktop property popup and directions only for a selected home", async () => {
    cleanup();
    installBrowserStubs(true);
    render(
      <MapView
        mapApiKey="test-token"
        listings={[{
          id: "home-1",
          title: "Calm City Studio",
          area: "Braamfontein",
          price: "R 8,200",
          coordinates: { lat: -26.19, lng: 28.04 },
          bedrooms: 1,
          bathrooms: 1,
          listingType: "rent",
          furnished: true,
          landlordTrust: {
            medianFirstResponseSeconds: 300,
            phoneVerified: true,
            emailVerified: false,
          },
        }]}
        selectedListingId="home-1"
        onViewListing={vi.fn()}
      />,
    );

    expect(await screen.findByTestId("maplibre-popup")).toBeInTheDocument();
    expect(screen.getByText("Calm City Studio")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Directions to selected property" }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View details" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Details" })).toBeInTheDocument();
    expect(screen.getByText("Furnished")).toBeInTheDocument();
    expect(screen.getByText("Verified Phone")).toBeInTheDocument();
    expect(screen.getByText("Responds in 5 mins")).toBeInTheDocument();
    const propertyPreview = screen.getByTestId("maplibre-popup");
    expect(propertyPreview).toHaveAttribute("data-max-width", "calc(20rem + 2px)");
    expect(within(propertyPreview).getByRole("button", { name: "Sign in to chat" })).toBeInTheDocument();
    expect(within(propertyPreview).queryByRole("button", { name: "Directions" })).not.toBeInTheDocument();
    expect(captured.mapApi.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({ offset: [0, 150] }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(captured.toggleFavorite).toHaveBeenCalledWith("home-1", { listingType: "rent" });
  });

  it("keeps the selected-property popup off the mobile map", async () => {
    render(
      <MapView
        mapApiKey="test-token"
        listings={[{
          id: "home-1",
          title: "Calm City Studio",
          area: "Braamfontein",
          price: "R 8,200",
          coordinates: { lat: -26.19, lng: 28.04 },
        }]}
        selectedListingId="home-1"
      />,
    );

    await screen.findByTestId("maplibre-map");
    expect(screen.queryByTestId("maplibre-popup")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Directions to selected property" }))
      .toBeInTheDocument();
  });

  it("removes Nearby controls, places overlays and places requests from Property", async () => {
    captured.mapApi.getZoom.mockReturnValue(13);
    render(<MapView mapApiKey="test-token" listings={[]} />);
    await screen.findByTestId("maplibre-map");
    await act(async () => {
      (captured.mapProps?.onMoveEnd as () => void)();
    });
    expect(screen.queryByRole("button", { name: /nearby/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Nearby essentials" })).not.toBeInTheDocument();
    expect(captured.category).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Locate me" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
  });
});
