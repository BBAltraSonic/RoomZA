// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { LocationSelector } from "./location-selector";
import { RECENT_LOCATION_KEY } from "@/features/places/catalogue-contract";

const place = {
  id: "7a4f8a21-694b-43de-8e72-efc81947b4b5", providerId: "place.rondebosch", label: "Rondebosch",
  secondaryLabel: "Cape Town, Western Cape, South Africa", fullAddress: "Rondebosch, Cape Town, South Africa",
  center: { lat: -33.96, lng: 18.47 }, bounds: { west: 18.46, south: -33.97, east: 18.49, north: -33.95 },
};
const response = (places: typeof place[] = [], recentPlaces: typeof place[] = []) => ({ ok: true, json: async () => ({ data: { places, recentPlaces } }) });
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response()));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LocationSelector", () => {
  it("shows server-ranked alternate-name matches without literal filtering", async () => {
    const renamed = { ...place, label: "Gqeberha", secondaryLabel: "Eastern Cape, South Africa" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response([renamed])));
    const onSelect = vi.fn();
    render(<LocationSelector idPrefix="alias" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /Location:/ }));
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Port Elizabeth" } });
    expect(await screen.findByRole("option", { name: /Gqeberha/ })).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(renamed);
  });
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
    expect(fetchMock).toHaveBeenCalledWith("/api/discovery/places?q=Ronde", expect.objectContaining({ signal: expect.any(AbortSignal) }));

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(location);
    await waitFor(() => expect(screen.queryByRole("combobox")).not.toBeInTheDocument());
  });

  it("shows a useful prompt before searching", async () => {
    render(<LocationSelector idPrefix="test" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Location: Choose a location" }));
    expect(screen.getByRole("combobox", { name: "Search South African locations" })).toBeInTheDocument();
    expect(await screen.findByText("Search for a suburb, town or city. No suggested locations are available yet.")).toBeInTheDocument();
  });

  it("restores catalogue suggestions when a pending search is cleared", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<LocationSelector idPrefix="test" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Location: Choose a location" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Search South African locations" }), { target: { value: "Ronde" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear location search" }));
    expect(screen.getByText("Loading suggestions…")).toBeInTheDocument();
    expect(screen.queryByText("Searching locations…")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveFocus();
  });

  it("shows catalogue suggestions immediately and remembers only IDs after selection", async () => {
    const fetcher = vi.fn().mockResolvedValue(response([place]));
    vi.stubGlobal("fetch", fetcher);
    const onSelect = vi.fn();
    render(<LocationSelector idPrefix="test" onSelect={onSelect} />);
    const trigger = screen.getByRole("button", { name: "Location: Choose a location" });
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("option", { name: /Rondebosch/ }));
    expect(onSelect).toHaveBeenCalledWith(place);
    expect(JSON.parse(localStorage.getItem(RECENT_LOCATION_KEY)!)).toEqual([place.id]);
    expect(trigger).toHaveFocus();
    expect(fetcher).toHaveBeenCalledWith("/api/discovery/places", expect.anything());
  });

  it("rehydrates recent IDs, deduplicates suggestions and lets the user clear history", async () => {
    localStorage.setItem(RECENT_LOCATION_KEY, JSON.stringify([place.id]));
    const fetcher = vi.fn().mockResolvedValue(response([place], [place]));
    vi.stubGlobal("fetch", fetcher);
    render(<LocationSelector idPrefix="test" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Location:/ }));
    expect(await screen.findAllByRole("option")).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledWith(`/api/discovery/places?recent=${place.id}`, expect.anything());
    fireEvent.click(screen.getByRole("button", { name: "Clear recent locations" }));
    expect(localStorage.getItem(RECENT_LOCATION_KEY)).toBeNull();
    expect(screen.queryByText("Recent locations")).not.toBeInTheDocument();
  });

  it("ignores stale results even when the network completes an aborted request", async () => {
    let finishOld!: (result: ReturnType<typeof response>) => void;
    const old = new Promise<ReturnType<typeof response>>(resolve => { finishOld = resolve; });
    const cape = { ...place, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", label: "Cape Town" };
    const fetcher = vi.fn((url: string) => url.includes("q=Ronde") ? old : Promise.resolve(response(url.includes("q=Cape") ? [cape] : [])));
    vi.stubGlobal("fetch", fetcher);
    render(<LocationSelector idPrefix="test" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Location:/ }));
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Ronde" } });
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith("/api/discovery/places?q=Ronde", expect.anything()));
    fireEvent.change(input, { target: { value: "Cape" } });
    expect(await screen.findByRole("option", { name: /Cape Town/ })).toBeInTheDocument();
    finishOld(response([place]));
    await waitFor(() => expect(screen.queryByRole("option", { name: /Rondebosch/ })).not.toBeInTheDocument());
  });

  it("caches repeated searches and supports keyboard selection across suggestions", async () => {
    const fetcher = vi.fn().mockResolvedValue(response([place]));
    vi.stubGlobal("fetch", fetcher);
    const onSelect = vi.fn();
    render(<LocationSelector idPrefix="test" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /Location:/ }));
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Ronde" } });
    await screen.findByRole("option");
    fireEvent.change(input, { target: { value: "Rond" } });
    await screen.findByRole("option");
    fireEvent.change(input, { target: { value: "Ronde" } });
    await screen.findByRole("option");
    expect(fetcher.mock.calls.filter(([url]) => url === "/api/discovery/places?q=Ronde")).toHaveLength(1);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveAttribute("aria-activedescendant", "test-location-0");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(place);
  });

  it("offers a retry on a failed request and handles corrupt local storage", async () => {
    localStorage.setItem(RECENT_LOCATION_KEY, "invalid JSON");
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: false, status: 429 }).mockResolvedValue(response([place]));
    vi.stubGlobal("fetch", fetcher);
    render(<LocationSelector idPrefix="test" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Location:/ }));
    expect(await screen.findByText("Too many searches. Please wait a moment.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    fireEvent.click(await screen.findByRole("option"));
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("still selects locations when device storage is unavailable", async () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Storage blocked"); });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage blocked"); });
    try {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response([place])));
      const onSelect = vi.fn();
      render(<LocationSelector idPrefix="test" onSelect={onSelect} />);
      fireEvent.click(screen.getByRole("button", { name: /Location:/ }));
      fireEvent.click(await screen.findByRole("option"));
      expect(onSelect).toHaveBeenCalledWith(place);
    } finally { get.mockRestore(); set.mockRestore(); }
  });

  it("preserves private search endpoints without catalogue requests or recent history", async () => {
    const fetcher = vi.fn().mockResolvedValue(response([place]));
    vi.stubGlobal("fetch", fetcher);
    render(<LocationSelector idPrefix="private" searchUrl="/api/private/offers/places" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Location:/ }));
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Ronde" } });
    fireEvent.click(await screen.findByRole("option"));
    expect(fetcher).toHaveBeenCalledWith("/api/private/offers/places?q=Ronde", expect.anything());
    expect(localStorage.getItem(RECENT_LOCATION_KEY)).toBeNull();
  });

  it("limits the combined recent and ranked suggestions to six", async () => {
    const candidates = Array.from({ length: 6 }, (_, index) => ({ ...place, id: `00000000-0000-4000-8000-00000000000${index}`, label: `Area ${index}` }));
    localStorage.setItem(RECENT_LOCATION_KEY, JSON.stringify([place.id]));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(candidates, [place])));
    render(<LocationSelector idPrefix="bounded" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Location:/ }));
    expect(await screen.findAllByRole("option")).toHaveLength(6);
  });
});
