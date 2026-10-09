// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { LocationSelector } from "./location-selector";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LocationSelector", () => {
  it("searches South African places and selects one with the keyboard", async () => {
    const location = {
      id: "7a4f8a21-694b-43de-8e72-efc81947b4b5",
      providerId: "place.rondebosch",
      label: "Rondebosch",
      secondaryLabel: "Cape Town, Western Cape, South Africa",
      fullAddress: "Rondebosch, Cape Town, Western Cape, South Africa",
      center: { lat: -33.96, lng: 18.47 },
      bounds: { west: 18.46, south: -33.97, east: 18.49, north: -33.95 },
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { places: [location] } }) });
    vi.stubGlobal("fetch", fetchMock);
    const onSelect = vi.fn();
    render(<LocationSelector idPrefix="test" mapApiKey="test-key" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "Location: Choose a location" }));
    const input = screen.getByRole("combobox", { name: "Search South African locations" });
    fireEvent.change(input, { target: { value: "Ronde" } });
    expect(await screen.findByRole("option", { name: /Rondebosch/ })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/places?q=Ronde", expect.objectContaining({ signal: expect.any(AbortSignal) }));

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(location);
    await waitFor(() => expect(screen.queryByRole("combobox")).not.toBeInTheDocument());
  });

  it("shows a useful prompt before searching", () => {
    render(<LocationSelector idPrefix="test" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Location: Choose a location" }));
    expect(screen.getByRole("combobox", { name: "Search South African locations" })).toBeInTheDocument();
    expect(screen.getByText("Type at least two letters.")).toBeInTheDocument();
  });

  it("returns to the prompt when a pending search is cleared", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<LocationSelector idPrefix="test" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Location: Choose a location" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Search South African locations" }), { target: { value: "Ronde" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear location search" }));
    expect(screen.getByText("Type at least two letters.")).toBeInTheDocument();
    expect(screen.queryByText("Searching South Africa…")).not.toBeInTheDocument();
  });
});
