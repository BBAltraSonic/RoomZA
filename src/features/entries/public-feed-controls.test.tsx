// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PublicEntryFeedScreen } from "./public-feed-screen";
const push = vi.hoisted(() => vi.fn());
vi.mock("@/features/discovery/saved-specials-client", () => ({ SavedSpecialsProvider: ({children}: {children: React.ReactNode}) => children, useSavedSpecial: () => ({saved:false,pending:false,count:0,toggle:vi.fn()}) }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push }) }));
vi.mock("@/features/map-discovery/location-selector", () => ({ LocationSelector: ({ onSelect }: { onSelect: (place: { id: string; fullAddress: string }) => void }) => <button onClick={() => onSelect({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", fullAddress: "Fixture, ZA" })}>Choose fixture</button> }));
beforeEach(() => { window.sessionStorage.clear(); vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ matches: query.includes("min-width: 1024"), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }))); });
afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); vi.unstubAllGlobals(); push.mockReset(); });
it.each(["event", "tourism"] as const)("keeps %s search and sorting available before selection", category => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  render(<PublicEntryFeedScreen category={category} areaId={null} place={null} initial={null} view="feed" />);
  fireEvent.change(screen.getByRole("searchbox", { name: "Search specials on this page" }), { target: { value: "music" } });
  fireEvent.click(screen.getByRole("button", { name: "Latest" }));
  expect(fetcher).not.toHaveBeenCalled();
  expect(screen.getByRole("region", { name: "Discovery map" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Choose fixture" }));
  const url = new URL(push.mock.calls[0]![0], "https://fixture.test");
  expect(url.searchParams.get("kind")).toBe(category);
  expect(url.searchParams.get("q")).toBe("music");
  expect(url.searchParams.get("sort")).toBe("Latest");
});
it.each(["event", "tourism"] as const)("retains %s results on failed refresh without cancelling expiry", async category => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  try {
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", serverNow = "2026-10-14T08:00:00Z";
    const place = { id, providerId: "fixture", label: "Fixture", secondaryLabel: "ZA", fullAddress: "Fixture, ZA", center: { lat: -33.9, lng: 18.4 }, bounds: { west: 18, south: -34, east: 19, north: -33 } };
    const item = { entryId: id, category, approvedAt: serverNow, state: "live" as const,
      content: { title: "Expiring entry", description: "Description", venueName: "Venue", address: "Address", areaId: id, latitude: -33.9, longitude: 18.4, startsAt: serverNow, endsAt: "2026-10-14T08:00:01Z" } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({}, { status: 503 })));
    render(<PublicEntryFeedScreen category={category} areaId={id} place={place} initial={{ category, areaId: id, page: 1, totalCount: 1, items: [item], hasNext: false, serverNow }} />);
    await act(async () => {});
    expect(screen.getByText(/^Could not load specials\./)).toHaveAttribute("role", "alert");
    fireEvent.click(screen.getByRole("button", { name: "Refresh specials" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(screen.getByRole("heading", { name: "Expiring entry" })).toBeVisible();
    await act(async () => { await vi.advanceTimersByTimeAsync(501); });
    expect(screen.queryByRole("heading", { name: "Expiring entry" })).not.toBeInTheDocument();
  } finally { cleanup(); vi.useRealTimers(); }
});
