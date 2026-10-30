// @vitest-environment jsdom
//
// Closing details clears local state at once, but the URL only drops `listingId`
// when the router transition lands. These tests hold that transition open, as a
// real network does, to prove the listing is not reopened in the gap.
import { clearFeedCache } from "@/features/discovery/feed-cache";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const navigation = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const state = {
    params: new URLSearchParams(""),
    pending: [] as string[],
    set(url: string) {
      state.params = new URLSearchParams(url.split("?")[1] ?? "");
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
  return state;
});
const holder = vi.hoisted(() => ({ onViewListing: null as null | ((listingId: string) => void), selectedListingId: undefined as string | undefined }));

vi.mock("next/navigation", () => {
  const router = {
    // Opening is immediate here; closing is what must outlive the transition.
    push: (url: string) => navigation.set(url),
    replace: (url: string) => { navigation.pending.push(url); },
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  };
  return {
    useSearchParams: () => React.useSyncExternalStore(navigation.subscribe, () => navigation.params),
    usePathname: () => "/",
    useRouter: () => router,
  };
});

vi.mock("next/link", () => ({
  default: (props: { href?: unknown; children?: React.ReactNode }) =>
    React.createElement("a", { href: typeof props.href === "string" ? props.href : "#" }, props.children),
}));
vi.mock("@/lib/hooks/use-on-click-outside", () => ({ useOnClickOutside: () => {} }));
vi.mock("./map-view-loader", () => ({
  MapViewLoader: (props: { onViewListing?: (listingId: string) => void; selectedListingId?: string }) => {
    holder.onViewListing = props.onViewListing ?? null;
    holder.selectedListingId = props.selectedListingId;
    return React.createElement("div", { "data-testid": "map-view-loader" });
  },
}));
vi.mock("./hooks/use-favorites", () => ({
  useFavorites: () => ({ favorites: new Set(), isFavorite: () => false, toggleFavorite: vi.fn() }),
}));
vi.mock("./listing-detail-panel", () => ({ ListingDetailPanel: () => React.createElement("div", { "data-testid": "listing-detail-panel" }) }));
vi.mock("./mobile/listing-carousel", () => ({ ListingCarousel: () => null }));
vi.mock("./mobile/explore-sections", () => ({ DiscoveryExploreSections: () => null }));

import { DiscoveryPage } from "./discovery-page";

let detailFetches: string[] = [];

async function settle() {
  await act(async () => {
    vi.advanceTimersByTime(1);
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
  });
}

async function openListing(id: string) {
  await act(async () => { holder.onViewListing?.(id); });
  await settle();
  await settle();
}

async function closeDetails() {
  fireEvent.click(screen.getByRole("button", { name: "Close property details" }));
  await settle();
}

async function landPendingNavigation() {
  await act(async () => { navigation.set(navigation.pending.pop()!); });
  await settle();
}

beforeEach(() => {
  clearFeedCache();
  navigation.params = new URLSearchParams("");
  navigation.pending = [];
  detailFetches = [];
  holder.onViewListing = null;
  holder.selectedListingId = undefined;
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("min-width: 1024px"), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.stubGlobal("fetch", vi.fn(async (input: unknown) => {
    const url = String(input);
    const match = url.match(/\/api\/listings\/([^/?]+)/);
    if (match) {
      detailFetches.push(match[1]!);
      return { ok: true, json: async () => ({ ok: true, data: { id: match[1], title: "Home", latitude: -33.9, longitude: 18.45 } }) };
    }
    return { ok: true, json: async () => ({ ok: true, data: { listings: [] } }) };
  }));
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("closing listing details", () => {
  it("should not reload the listing while the URL is still catching up", async () => {
    render(<DiscoveryPage />);
    await openListing("a");
    expect(detailFetches).toEqual(["a"]);

    await closeDetails();

    expect(navigation.params.get("listingId")).toBe("a");
    expect(detailFetches).toEqual(["a"]);
  });

  it("should not select the listing again, which would flash its map popup", async () => {
    render(<DiscoveryPage />);
    await openListing("a");

    await closeDetails();

    expect(holder.selectedListingId).toBeUndefined();
  });

  it("should keep details closed after the URL updates", async () => {
    render(<DiscoveryPage />);
    await openListing("a");

    await closeDetails();
    await landPendingNavigation();

    expect(navigation.params.has("listingId")).toBe(false);
    expect(screen.queryByRole("complementary", { name: "Property details" })).not.toBeInTheDocument();
    expect(detailFetches).toEqual(["a"]);
  });

  it("should open the same listing again after closing it", async () => {
    render(<DiscoveryPage />);
    await openListing("a");
    await closeDetails();
    await landPendingNavigation();

    await openListing("a");

    expect(detailFetches).toEqual(["a", "a"]);
    expect(screen.getByRole("complementary", { name: "Property details" })).toBeInTheDocument();
  });

  it("should reopen when history returns to a closed listing", async () => {
    render(<DiscoveryPage />);
    await openListing("a");
    await closeDetails();
    await landPendingNavigation();

    await act(async () => { navigation.set("/?listingId=a"); });
    await settle();
    await settle();

    expect(detailFetches).toEqual(["a", "a"]);
  });

  it("should still follow a link to a different listing during the gap", async () => {
    render(<DiscoveryPage />);
    await openListing("a");
    await closeDetails();

    await act(async () => { navigation.set("/?listingId=b"); });
    await settle();
    await settle();

    expect(detailFetches).toEqual(["a", "b"]);
  });
});
