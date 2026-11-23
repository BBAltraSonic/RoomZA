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
    flyTo: vi.fn(),
    jumpTo: vi.fn(),
    isMoving: vi.fn(() => false),
    cameraForBounds: vi.fn(() => ({ center: { lng: 18.5, lat: -33.95 }, zoom: 12 })),
    getContainer: vi.fn(() => ({ clientWidth: 400, clientHeight: 800 })),
  };
  return {
    bounds,
    dynamicCalls: [] as DynamicCall[],
    mapProps: null as null | Record<string, unknown>,
    // Off for a handed-over map whose tiles are still loading: react-map-gl never simulates `load` for it.
    firesLoad: true,
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
      if (captured.firesLoad) (props.onLoad as (() => void) | undefined)?.();
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
import { MAP_INTRO_PLAYED_KEY } from "./lib/map-intro";

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
  captured.firesLoad = true;
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
    captured.mapApi.flyTo,
    captured.mapApi.jumpTo,
    captured.mapApi.cameraForBounds,
  ]) {
    method.mockClear();
  }
  installBrowserStubs();
  // Most suites describe a visit after the opening flight; its own suite clears this.
  sessionStorage.setItem(MAP_INTRO_PLAYED_KEY, "1");
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

describe("MapView stays out of the camera's way", () => {
  const listing = (id: string, lng = 18.45) => ({ id, title: id, area: "Gardens", price: "R 5k", coordinates: { lat: -33.9, lng } });
  const target = { nonce: 1, center: { lat: -33.96, lng: 18.47 }, bounds: { west: 18.4, south: -34, east: 18.6, north: -33.9 } };

  it("should not replay a search when the sheet settles", async () => {
    const view = render(<MapView mapApiKey="test-token" listings={[]} searchTarget={target} mobileBottomPadding={100} />);
    await screen.findByTestId("maplibre-map");
    expect(captured.mapApi.flyTo).toHaveBeenCalledTimes(1);
    view.rerender(<MapView mapApiKey="test-token" listings={[]} searchTarget={target} mobileBottomPadding={400} />);
    expect(captured.mapApi.flyTo).toHaveBeenCalledTimes(1);
  });

  it("should whoosh onto a chosen location or searched area, framed by the sheet padding", async () => {
    render(<MapView mapApiKey="test-token" listings={[]} searchTarget={target} />);
    await screen.findByTestId("maplibre-map");
    expect(captured.mapApi.cameraForBounds).toHaveBeenCalledWith([[18.4, -34], [18.6, -33.9]], { padding: expect.anything() });
    expect(captured.mapApi.flyTo).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ center: { lng: 18.5, lat: -33.95 }, zoom: 12, minZoom: 6, duration: 1600 }));
    expect(captured.mapApi.fitBounds).not.toHaveBeenCalled();
  });

  it("should whoosh onto a searched point that has no area", async () => {
    render(<MapView mapApiKey="test-token" listings={[]} searchTarget={{ nonce: 2, center: { lat: -33.96, lng: 18.47 } }} />);
    await screen.findByTestId("maplibre-map");
    expect(captured.mapApi.flyTo).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ center: [18.47, -33.96], zoom: 14, minZoom: 8, duration: 1600 }));
    expect(captured.mapApi.easeTo).not.toHaveBeenCalled();
  });

  it("should not pull the map back to a selection when its results refresh", async () => {
    const view = render(<MapView mapApiKey="test-token" listings={[listing("a")]} selectedListingId="a" />);
    await screen.findByTestId("maplibre-map");
    expect(captured.mapApi.easeTo).toHaveBeenCalledTimes(1);
    view.rerender(<MapView mapApiKey="test-token" listings={[{ ...listing("a") }, listing("b")]} selectedListingId="a" />);
    expect(captured.mapApi.easeTo).toHaveBeenCalledTimes(1);
  });

  it("should fit each request once even when listings arrive later", async () => {
    const request = { nonce: 1 };
    const view = render(<MapView mapApiKey="test-token" listings={[listing("a"), listing("b", 18.46)]} fitListingsRequest={request} />);
    await screen.findByTestId("maplibre-map");
    const fits = captured.mapApi.fitBounds.mock.calls.length + captured.mapApi.easeTo.mock.calls.length;
    view.rerender(<MapView mapApiKey="test-token" listings={[listing("c"), listing("d", 18.46)]} fitListingsRequest={request} />);
    expect(captured.mapApi.fitBounds.mock.calls.length + captured.mapApi.easeTo.mock.calls.length).toBe(fits);
  });

  it("should resume a live camera without replaying earlier commands", async () => {
    render(<MapView mapApiKey="test-token" listings={[listing("a")]} selectedListingId="a" searchTarget={target} initialCamera={{ lng: 18.5, lat: -33.8, zoom: 13 }} />);
    await screen.findByTestId("maplibre-map");
    expect(captured.mapProps?.initialViewState).toEqual({ longitude: 18.5, latitude: -33.8, zoom: 13 });
    expect(captured.mapApi.fitBounds).not.toHaveBeenCalled();
    expect(captured.mapApi.flyTo).not.toHaveBeenCalled();
    expect(captured.mapApi.easeTo).not.toHaveBeenCalled();
    expect(screen.queryByRole("status", { name: "Loading map" })).not.toBeInTheDocument();
  });

  it("should replay the opening flight onto its camera when the visitor arrives from another environment", async () => {
    render(<MapView mapApiKey="test-token" listings={[listing("a")]} initialCamera={{ lng: 18.45, lat: -33.9, zoom: 11 }} arrival={1} />);
    await screen.findByTestId("maplibre-map");
    expect(captured.mapApi.jumpTo).toHaveBeenCalledExactlyOnceWith({ center: [18.45, -33.9], zoom: 5 });
    expect(captured.mapApi.flyTo).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ center: [18.45, -33.9], zoom: 11, duration: 1600 }));
  });

  it("should become ready when a handed-over map settles without a load event", async () => {
    captured.firesLoad = false;
    const onCameraChange = vi.fn();
    render(<MapView mapApiKey="test-token" listings={[listing("a")]} initialCamera={{ lng: 18.45, lat: -33.9, zoom: 11 }} arrival={1} onCameraChange={onCameraChange} />);
    await screen.findByTestId("maplibre-map");
    expect(captured.mapApi.jumpTo).not.toHaveBeenCalled();
    act(() => { (captured.mapProps?.onIdle as () => void)(); });
    expect(onCameraChange).toHaveBeenCalledWith({ lng: 18.45, lat: -33.9, zoom: 11 });
    expect(captured.mapApi.jumpTo).toHaveBeenCalledOnce();
  });

  it("should not re-render on camera frames within a zoom level", async () => {
    render(<MapView mapApiKey="test-token" listings={[listing("a")]} />);
    await screen.findByTestId("maplibre-map");
    const rendered = captured.mapProps;
    act(() => { (rendered?.onMove as (event: unknown) => void)({ viewState: { zoom: 11.6 } }); });
    expect(captured.mapProps).toBe(rendered);
  });

  it("should report the camera so another environment can continue from it", async () => {
    const onCameraChange = vi.fn();
    render(<MapView mapApiKey="test-token" listings={[]} onCameraChange={onCameraChange} />);
    await screen.findByTestId("maplibre-map");
    expect(onCameraChange).toHaveBeenCalledWith({ lng: 18.45, lat: -33.9, zoom: 11 });
  });

  it("should cap markers in a dense view and always keep the selected pin", async () => {
    captured.mapApi.getZoom.mockReturnValue(16);
    const listings = Array.from({ length: 200 }, (_, index) => listing("home-" + index, 18.4 + index / 2000));
    render(<MapView mapApiKey="test-token" listings={listings} selectedListingId="home-199" />);
    await screen.findByTestId("maplibre-map");
    await act(async () => {});
    expect(screen.getAllByRole("button", { name: /home-/ })).toHaveLength(60);
    expect(screen.getByRole("button", { name: /^home-199 / })).toBeInTheDocument();
  });
});

describe("MapView camera and provider configuration", () => {
  it("does not interrupt a stored-place recenter with a queued resize at map load", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => { frames.push(callback); return frames.length; }));
    render(<MapView mapApiKey="test-token" listings={[]} searchQuery="Stored Cape Town place"
      searchTarget={{ nonce: 1, center: { lat: -33.96, lng: 18.47 }, bounds: { west: 18.4, south: -34, east: 18.6, north: -33.9 } }} />);
    await screen.findByTestId("maplibre-map");
    expect(captured.mapApi.flyTo).toHaveBeenCalled();
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

  it("should match the base map to the app theme and follow it when it changes", async () => {
    document.documentElement.classList.add("dark");
    try {
      render(<MapView mapApiKey="test-token" listings={[]} />);
      const map = await screen.findByTestId("maplibre-map");
      expect(map.dataset.style).toContain("base-v4-dark");

      await act(async () => { document.documentElement.classList.remove("dark"); });
      expect(screen.getByTestId("maplibre-map").dataset.style).toContain("base-v4-light");
    } finally {
      document.documentElement.classList.remove("dark");
    }
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

describe("MapView opening flight", () => {
  beforeEach(() => sessionStorage.clear());

  it("should fly down onto the city on a fresh visit and load results for where it lands", async () => {
    vi.useFakeTimers();
    const onBoundsChange = vi.fn();
    render(<MapView mapApiKey="test-token" listings={[]} onBoundsChange={onBoundsChange} />);
    await act(async () => {});
    expect(captured.mapProps?.initialViewState).toEqual({ longitude: 28.0473, latitude: -26.2041, zoom: 5 });
    expect(captured.mapApi.flyTo).toHaveBeenCalledOnce();
    expect(captured.mapApi.flyTo.mock.calls[0]![0]).toMatchObject({ center: [28.0473, -26.2041], zoom: 11 });
    act(() => { vi.advanceTimersByTime(300); });
    expect(onBoundsChange).toHaveBeenCalledOnce();
    const landing = onBoundsChange.mock.calls[0]![0];
    expect(landing.west).toBeLessThan(28.0473);
    expect(landing.east).toBeGreaterThan(28.0473);

    // Landing where results were already requested does not ask again.
    captured.mapApi.getCenter.mockReturnValueOnce({ lng: 28.0473, lat: -26.2041 });
    act(() => { (captured.mapProps?.onMoveEnd as () => void)(); vi.advanceTimersByTime(300); });
    expect(onBoundsChange).toHaveBeenCalledOnce();
  });

  it("should play once per tab, and never for a linked or resumed map", async () => {
    sessionStorage.setItem(MAP_INTRO_PLAYED_KEY, "1");
    const { unmount } = render(<MapView mapApiKey="test-token" listings={[]} />);
    await screen.findByTestId("maplibre-map");
    expect(captured.mapProps?.initialViewState).toMatchObject({ zoom: 11 });
    unmount();
    sessionStorage.clear();
    render(<MapView mapApiKey="test-token" listings={[]} searchQuery="Cape Town" />);
    await screen.findByTestId("maplibre-map");
    expect(captured.mapApi.flyTo).not.toHaveBeenCalled();
  });

  it("should stay still for visitors who prefer reduced motion", async () => {
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ matches: query.includes("reduce"), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    render(<MapView mapApiKey="test-token" listings={[]} />);
    await screen.findByTestId("maplibre-map");
    expect(captured.mapProps?.initialViewState).toMatchObject({ zoom: 11 });
    expect(captured.mapApi.flyTo).not.toHaveBeenCalled();
  });

  it("should whoosh down onto the visitor when they press Locate me", async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, "geolocation");
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: (success: PositionCallback) => success({ coords: { latitude: -26, longitude: 28 } } as GeolocationPosition) },
    });
    try {
      render(<MapView mapApiKey="test-token" listings={[]} />);
      await screen.findByTestId("maplibre-map");
      fireEvent.click(screen.getByRole("button", { name: "Locate me" }));
      expect(captured.mapApi.flyTo).toHaveBeenLastCalledWith(expect.objectContaining({ center: [28, -26], zoom: 15, minZoom: 9, duration: 1600 }));
      expect(captured.mapApi.easeTo).not.toHaveBeenCalled();
    } finally {
      if (original) Object.defineProperty(navigator, "geolocation", original);
      else Reflect.deleteProperty(navigator, "geolocation");
    }
  });
});
