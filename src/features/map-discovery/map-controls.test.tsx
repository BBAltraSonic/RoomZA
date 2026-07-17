// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MapControls } from "./map-controls";

const map = vi.hoisted(() => ({
  getZoom: vi.fn(() => 12),
  setZoom: vi.fn(),
  panTo: vi.fn(),
}));

vi.mock("@vis.gl/react-google-maps", () => ({
  useMap: () => map,
}));

beforeEach(() => {
  map.getZoom.mockReturnValue(12);
  map.setZoom.mockReset();
  map.panTo.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("MapControls", () => {
  it("renders only locate and zoom controls", () => {
    render(<MapControls />);

    expect(screen.getByRole("button", { name: "Locate me" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /layers/i })).not.toBeInTheDocument();
  });

  it("keeps zoom and geolocation behavior working", () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => success({
      coords: { latitude: -26.2041, longitude: 28.0473 },
    } as GeolocationPosition));
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(<MapControls />);
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    fireEvent.click(screen.getByRole("button", { name: "Locate me" }));

    expect(map.setZoom).toHaveBeenNthCalledWith(1, 13);
    expect(map.setZoom).toHaveBeenNthCalledWith(2, 11);
    expect(map.panTo).toHaveBeenCalledWith({ lat: -26.2041, lng: 28.0473 });
    expect(map.setZoom).toHaveBeenLastCalledWith(15);
  });
});
