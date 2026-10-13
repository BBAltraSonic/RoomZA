// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { PublicEntryFeedScreen } from "./public-feed-screen";
const push = vi.hoisted(() => vi.fn());
vi.mock("@/features/discovery/saved-specials-client", () => ({ SavedSpecialsProvider: ({children}: {children: React.ReactNode}) => children, useSavedSpecial: () => ({saved:false,pending:false,count:0,toggle:vi.fn()}) }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push }) }));
vi.mock("@/features/map-discovery/location-selector", () => ({ LocationSelector: ({ onSelect }: { onSelect: (place: { id: string; fullAddress: string }) => void }) => <button onClick={() => onSelect({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", fullAddress: "Fixture, ZA" })}>Choose fixture</button> }));
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
