// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const harness = vi.hoisted(() => ({
  mapProps: null as null | Record<string, unknown>,
  markerProps: null as null | Record<string, unknown>,
  forward: vi.fn(),
  reverse: vi.fn(),
  easeTo: vi.fn(),
}));

vi.mock("@/lib/maptiler", () => ({
  getMapTilerStyleUrl: (_apiKey: string, dark: boolean) =>
    `https://api.maptiler.com/maps/${dark ? "base-v4-dark" : "base-v4-light"}/style.json?key=maptiler-key`,
  forwardGeocode: harness.forward,
  reverseGeocode: harness.reverse,
}));

vi.mock("react-map-gl/maplibre", async () => {
  const React = await import("react");
  const MapLibreMap = React.forwardRef(function MockMapLibre(
    props: Record<string, unknown> & { children?: React.ReactNode },
    ref: React.ForwardedRef<{ easeTo: typeof harness.easeTo }>,
  ) {
    React.useImperativeHandle(ref, () => ({ easeTo: harness.easeTo }));
    harness.mapProps = props;
    return <div data-testid="maplibre-location-map">{props.children}</div>;
  });
  return {
    __esModule: true,
    default: MapLibreMap,
    Marker: (props: Record<string, unknown> & { children?: React.ReactNode }) => {
      harness.markerProps = props;
      return <div data-testid="draggable-maplibre-marker">{props.children}</div>;
    },
  };
});

import { LocationPicker } from "./location-picker";

const LOCATION = {
  id: "address.main-road",
  label: "12 Main Road",
  secondaryLabel: "Cape Town, Western Cape",
  fullAddress: "12 Main Road, Cape Town, Western Cape",
  center: { lat: -33.9249, lng: 18.4241 },
  placeType: "address" as const,
  hierarchy: { place: "Cape Town", region: "Western Cape" },
  categories: [],
};

beforeEach(() => {
  harness.mapProps = null;
  harness.markerProps = null;
  harness.forward.mockReset().mockResolvedValue([]);
  harness.reverse.mockReset().mockResolvedValue([]);
  harness.easeTo.mockReset();
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LocationPicker MapLibre and MapTiler flow", () => {
  it("uses MapLibre with MapTiler Base and preserves existing location values", () => {
    render(
      <LocationPicker
        mapApiKey="maptiler-key"
        defaultAddress="12 Main Road, Cape Town"
        defaultLat={-33.9249}
        defaultLng={18.4241}
      />,
    );

    expect(screen.getByTestId("maplibre-location-map")).toBeInTheDocument();
    expect(harness.mapProps).toMatchObject({
      mapStyle: "https://api.maptiler.com/maps/base-v4-light/style.json?key=maptiler-key",
      attributionControl: { compact: true },
    });
    expect(document.querySelector('input[name="address"]')).toHaveValue(
      "12 Main Road, Cape Town",
    );
    expect(document.querySelector('input[name="latitude"]')).toHaveValue("-33.9249");
    expect(document.querySelector('input[name="longitude"]')).toHaveValue("18.4241");
  });

  it("reverse geocodes a MapLibre click and preserves hidden coordinates", async () => {
    harness.reverse.mockResolvedValue([{
      ...LOCATION,
      label: "45 Bree Street",
      fullAddress: "45 Bree Street, Cape Town",
      center: { lat: -33.921, lng: 18.419 },
    }]);
    render(<LocationPicker mapApiKey="maptiler-key" />);

    await act(async () => {
      (harness.mapProps?.onClick as (event: {
        lngLat: { lat: number; lng: number };
      }) => void)({ lngLat: { lat: -33.921, lng: 18.419 } });
    });

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: /Search address/ }))
        .toHaveValue("45 Bree Street, Cape Town");
    });
    expect(harness.reverse).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: "maptiler-key",
      coordinates: { lat: -33.921, lng: 18.419 },
    }));
    expect(document.querySelector('input[name="latitude"]')).toHaveValue("-33.921");
    expect(document.querySelector('input[name="longitude"]')).toHaveValue("18.419");
    expect(screen.getByTestId("draggable-maplibre-marker")).toBeInTheDocument();
  });

  it("geocodes a typed address and moves the MapLibre camera", async () => {
    harness.forward.mockResolvedValue([{
      ...LOCATION,
      label: "1 Jan Smuts Avenue",
      fullAddress: "1 Jan Smuts Avenue, Johannesburg",
      center: { lat: -26.181, lng: 28.019 },
    }]);
    render(<LocationPicker mapApiKey="maptiler-key" />);

    const input = screen.getByRole("textbox", { name: /Search address/ });
    fireEvent.change(input, { target: { value: "1 Jan Smuts Avenue" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(harness.easeTo).toHaveBeenCalledWith({
        center: [28.019, -26.181],
        zoom: 14,
        duration: 450,
      });
    });
    expect(harness.forward).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: "maptiler-key",
      query: "1 Jan Smuts Avenue",
      autocomplete: false,
    }));
    expect(document.querySelector('input[name="address"]')).toHaveValue(
      "1 Jan Smuts Avenue, Johannesburg",
    );
  });

  it("renders and selects MapTiler address suggestions", async () => {
    harness.forward.mockResolvedValue([LOCATION]);
    render(<LocationPicker mapApiKey="maptiler-key" />);

    const input = screen.getByRole("textbox", { name: /Search address/ });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "12 Main" } });

    fireEvent.click(await screen.findByRole("option", { name: /12 Main Road/ }));
    expect(input).toHaveValue("12 Main Road, Cape Town, Western Cape");
    expect(document.querySelector('input[name="latitude"]')).toHaveValue("-33.9249");
    expect(document.querySelector('input[name="longitude"]')).toHaveValue("18.4241");
  });
});
