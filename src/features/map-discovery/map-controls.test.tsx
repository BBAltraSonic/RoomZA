// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MapControls } from "./map-controls";

const callbacks = {
  onZoomIn: vi.fn(),
  onZoomOut: vi.fn(),
  onLocate: vi.fn(),
  onDirections: vi.fn(),
};

beforeEach(() => {
  Object.values(callbacks).forEach((callback) => callback.mockReset());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("MapControls", () => {
  it("renders locate, directions, and zoom controls without Nearby", () => {
    render(
      <MapControls
        {...callbacks}
      />,
    );

    expect(screen.getByRole("button", { name: "Locate me" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /nearby/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Directions to selected property" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeInTheDocument();
  });

  it("delegates camera actions and resolves geolocation", () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => success({
      coords: { latitude: -26.2041, longitude: 28.0473 },
    } as GeolocationPosition));
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(
      <MapControls
        {...callbacks}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    fireEvent.click(screen.getByRole("button", { name: "Directions to selected property" }));
    fireEvent.click(screen.getByRole("button", { name: "Locate me" }));

    expect(callbacks.onZoomIn).toHaveBeenCalledTimes(1);
    expect(callbacks.onZoomOut).toHaveBeenCalledTimes(1);
    expect(callbacks.onDirections).toHaveBeenCalledTimes(1);
    expect(callbacks.onLocate).toHaveBeenCalledWith({ lat: -26.2041, lng: 28.0473 });
  });
  it("fits results and uses the category-specific directions label", () => {
    const fit = vi.fn();
    render(<MapControls {...callbacks} onFitResults={fit} directionsLabel="Directions to selected service" />);
    fireEvent.click(screen.getByRole("button", { name: "Show all results on map" }));
    fireEvent.click(screen.getByRole("button", { name: "Directions to selected service" }));
    expect(fit).toHaveBeenCalledOnce(); expect(callbacks.onDirections).toHaveBeenCalledOnce();
  });
  it("does not move a newer page when geolocation completes after unmount", () => {
    let finish!: PositionCallback;
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: (success: PositionCallback) => { finish = success; } } });
    const ui = render(<MapControls {...callbacks} />);
    fireEvent.click(screen.getByRole("button", { name: "Locate me" }));
    ui.unmount();
    finish({ coords: { latitude: -33.9, longitude: 18.4 } } as GeolocationPosition);
    expect(callbacks.onLocate).not.toHaveBeenCalled();
  });

});
