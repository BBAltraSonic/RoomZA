// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { ServicesDiscovery } from "./services-discovery";
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push }) }));
vi.mock("@/features/map-discovery/location-selector", () => ({
  LocationSelector: ({ onSelect }: { onSelect: (value: typeof place) => void }) => <button onClick={() => onSelect(place)}>Select fixture place</button>,
}));
vi.mock("@/features/discovery/discovery-map-loader", () => ({
  DiscoveryMapLoader: ({
    points,
  }: {
    points: { id: string; latitude: number; longitude: number }[];
  }) => <div data-testid="map-points">{JSON.stringify(points)}</div>,
}));
const areaId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const place = {
  id: areaId,
  providerId: "fixture",
  label: "Fixture",
  secondaryLabel: "ZA",
  fullAddress: "Fixture, ZA",
  center: { lat: -33.9, lng: 18.4 },
  bounds: { west: 18, south: -34, east: 19, north: -33 },
};
const item = {
  id,
  area_id: areaId,
  approved_at: "2026-10-03T08:00:00Z",
  content: {
    title: "Fixture plumbing",
    providerName: "Fixture provider",
    serviceType: "Plumbing",
    description: "Fixture only",
    areaId,
    address: "Fixture address",
    latitude: -33.972,
    longitude: 18.483,
    phone: "+27 21 555 0100",
  },
};
const feed = { areaId, totalCount: 1, page: 1, items: [item], hasNext: false };
const mock = (data = feed) =>
  vi
    .fn()
    .mockImplementation((url: string) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url.startsWith("/api/places/") ? { data: { place } } : data,
          ),
        ),
      ),
    );
afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  push.mockReset();
});
describe("Services discovery", () => {
  it("uses approved provider coordinates and keeps legacy Feed URLs on Map", async () => {
    vi.stubGlobal("fetch", mock());
    const ui = render(
      <ServicesDiscovery areaId={areaId} area="Fixture" view="map" />,
    );
    await screen.findByRole("heading", { name: item.content.title });
    expect(JSON.parse(screen.getByTestId("map-points").textContent!)).toEqual([
      {
        id,
        title: item.content.providerName,
        latitude: -33.972,
        longitude: 18.483,
      },
    ]);
    expect(screen.getByRole("link", { name: "Create listing" })).toHaveAttribute(
      "href",
      "/auth?redirect=%2Fpost",
    );
    expect(screen.queryByRole("button", { name: "Feed" })).not.toBeInTheDocument();
    ui.rerender(
      <ServicesDiscovery areaId={areaId} area="Fixture" view="feed" />,
    );
    expect(screen.getByTestId("map-points")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: item.content.title }),
    ).toBeVisible();
  });
  it("does not label a wrong-area response as an empty area", async () => {
    vi.stubGlobal(
      "fetch",
      mock({ ...feed, areaId: id, items: [], totalCount: 0 }),
    );
    render(<ServicesDiscovery areaId={areaId} area="Fixture" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load services",
    );
    expect(
      screen.queryByText("No approved local services in this area yet."),
    ).not.toBeInTheDocument();
  });
  it("ignores a stale request after the area screen unmounts", async () => {
    let resolve!: (value: Response) => void;
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((r) => {
            resolve = r;
          }),
      )
      .mockResolvedValue(new Response(JSON.stringify(feed)));
    vi.stubGlobal("fetch", fetcher);
    const ui = render(<ServicesDiscovery areaId={areaId} area="Fixture" />);
    ui.unmount();
    await act(async () => resolve(new Response("{}", { status: 503 })));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("keeps search and filters available before location selection and carries choices to the location", () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    render(<ServicesDiscovery areaId={null} area={null} view="map" />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search services on this page" }), { target: { value: "plumber" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Service type" }), { target: { value: "Plumbing" } });
    fireEvent.click(screen.getByRole("button", { name: "Nearest" }));
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Select fixture place" }));
    const url = new URL(push.mock.calls[0]![0], "https://fixture.test");
    expect(url.searchParams.get("q")).toBe("plumber");
    expect(url.searchParams.get("serviceType")).toBe("Plumbing");
    expect(url.searchParams.get("sort")).toBe("Nearest");
    expect(url.searchParams.get("areaId")).toBe(areaId);
    expect(url.searchParams.get("view")).toBe("map");
  });

});
