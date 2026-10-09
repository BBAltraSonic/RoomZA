// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { PublicOfferFeedScreen } from "./public-feed-screen";
import type { DiscoveryPlace } from "@/features/places/place";
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push }) }));
vi.mock("@/features/map-discovery/location-selector", () => ({ LocationSelector: ({ onSelect }: { onSelect: (place: DiscoveryPlace) => void }) => <button onClick={() => onSelect(place)}>Select fixture place</button> }));
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const place: DiscoveryPlace = { id, providerId: "fixture", label: "Fixture place", secondaryLabel: "ZA", fullAddress: "Fixture place, ZA", center: { lat: -33.96, lng: 18.47 }, bounds: { west: 18.4, south: -34, east: 18.6, north: -33.9 } };
const empty = { areaId: id, serverNow: "2026-10-02T10:00:00Z", totalCount: 0, items: [], nextCursor: null };
afterEach(() => { cleanup(); window.history.replaceState(null,"","/"); vi.unstubAllGlobals(); vi.restoreAllMocks(); push.mockReset(); });
describe("selected-place offer map", () => {
  it("searches and sorts the current page without changing its authoritative count or area", async () => {
    const offer = (offerId: string, title: string, endsAt: string, confirmedAt: string, latitude: number) => ({
      offerId, revisionId: offerId, confirmedAt, startsAt: "2026-10-01T08:00:00Z", endsAt, areaId: id, status: "live",
      content: { title, benefit: "Fixture benefit", terms: "Fixture terms", shopName: title, address: "Fixture address", areaId: id, latitude, longitude: 18.47, startsAt: "2026-10-01T08:00:00Z", endsAt },
      place: { id, name: place.label, region: "ZA", fullAddress: place.fullAddress }, poster: null,
    });
    const items = [
      offer("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "Near shop", "2026-10-02T14:00:00Z", "2026-10-01T10:00:00Z", -33.96),
      offer("cccccccc-cccc-4ccc-8ccc-cccccccccccc", "Latest shop", "2026-10-02T15:00:00Z", "2026-10-02T09:00:00Z", -34.3),
      offer("dddddddd-dddd-4ddd-8ddd-dddddddddddd", "Ends first", "2026-10-02T12:00:00Z", "2026-10-01T11:00:00Z", -34.1),
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...empty, totalCount: 3, items }))));
    render(<PublicOfferFeedScreen areaId={id} place={place} initial={null} cursor={null} view="feed" />);
    await screen.findByRole("heading", { name: "Ends first" });
    expect(screen.getByRole("region", { name: "Discovery map" })).toBeInTheDocument();
    const titles = () => screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(titles()).toEqual(["Ends first", "Near shop", "Latest shop"]);
    fireEvent.click(screen.getByRole("button", { name: "Latest" }));
    expect(titles()).toEqual(["Latest shop", "Ends first", "Near shop"]);
    fireEvent.click(screen.getByRole("button", { name: "Nearest" }));
    expect(titles()).toEqual(["Near shop", "Ends first", "Latest shop"]);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "latest" } });
    expect(titles()).toEqual(["Latest shop"]);
    expect(screen.getByText(/^3 offers ·/)).toBeVisible();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "missing" } });
    expect(screen.getByText(/No specials match/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clear specials search" }));
    expect(titles()).toHaveLength(3);
    const property = within(screen.getByRole("navigation", { name: "Discovery categories" })).getByRole("link", { name: "Property" });
    expect(new URL(property.getAttribute("href")!, "https://example.test").searchParams.get("areaId")).toBe(id);
  });
  it("never defaults a location or queries offers before selection", () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    render(<PublicOfferFeedScreen areaId={null} place={null} initial={null} cursor={null} />);
    expect(screen.getByText(/Choose a location to see offers/)).toBeVisible();
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search specials on this page" }), { target: { value: "coffee" } });
    fireEvent.click(screen.getByRole("button", { name: "Latest" }));
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Select fixture place" }));
    const url = new URL(push.mock.calls[0]![0], "https://example.test");
    expect(url.searchParams.get("areaId")).toBe(id);
    expect(url.searchParams.get("view")).toBe("map");
    expect(url.searchParams.get("q")).toBe("coffee");
    expect(url.searchParams.get("sort")).toBe("Latest");
  });
  it("uses current exact count for a truthful empty state and carries the place into Property Map", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(empty))));
    render(<PublicOfferFeedScreen areaId={id} place={place} initial={null} cursor={null} />);
    expect(await screen.findByRole("heading", { name: "No current offers in Fixture place" })).toBeVisible();
    expect(screen.getByText(/^0 offers ·/)).toBeVisible();
    const url = new URL(screen.getByRole("link", { name: "Browse Property in this area" }).getAttribute("href")!, "https://pinpoint.example");
    expect(url.searchParams.get("areaId")).toBe(id);
    expect(url.searchParams.get("view")).toBe("map");
  });
  it("rejects a response for the wrong area and offers recovery without calling it empty", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ ...empty, areaId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }))).mockResolvedValueOnce(new Response(JSON.stringify(empty)));
    vi.stubGlobal("fetch", fetcher);
    render(<PublicOfferFeedScreen areaId={id} place={place} initial={null} cursor={null} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load offers");
    expect(screen.queryByText("0 offers")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh offers" }));
    expect(await screen.findByRole("heading", { name: "No current offers in Fixture place" })).toBeVisible();
  });
  it("ignores a superseded response when the old location screen unmounts", async () => {
    let resolve!: (response: Response) => void;
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>((r) => { resolve = r; })).mockResolvedValueOnce(new Response(JSON.stringify(empty)));
    vi.stubGlobal("fetch", fetcher);
    const old = render(<PublicOfferFeedScreen areaId={id} place={place} initial={null} cursor={null} />);
    old.unmount();
    render(<PublicOfferFeedScreen areaId={id} place={place} initial={null} cursor={null} />);
    await screen.findByRole("heading", { name: "No current offers in Fixture place" });
    await act(async () => { resolve(new Response("{}", { status: 503 })); });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
