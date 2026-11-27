// @vitest-environment jsdom

import { renderHook, waitFor, act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ListingDetail } from "@/features/listings/detail-cards/types";

import { useListingDetails } from "./use-listing-details";

const detail = (id: string) => ({ id, title: `Home ${id}` }) as ListingDetail;
const ok = (id: string) => new Response(JSON.stringify({ ok: true, data: detail(id) }), { status: 200 });

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("useListingDetails", () => {
  it("should_load_each_requested_listing_once", async () => {
    const fetchMock = vi.fn(async (url: string) => ok(url.split("/").pop()!.split("?")[0]!));
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(({ ids }) => useListingDetails({ ids, listingMode: "rent" }), { initialProps: { ids: ["a", "b"] } });

    expect(result.current.get("a").status).toBe("loading");
    await waitFor(() => expect(result.current.get("a").status).toBe("ready"));
    await waitFor(() => expect(result.current.get("b").detail?.title).toBe("Home b"));

    rerender({ ids: ["b", "c"] });
    await waitFor(() => expect(result.current.get("c").status).toBe("ready"));
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/api/listings/a", "/api/listings/b", "/api/listings/c"]);
  });

  it("should_ask_for_the_buy_market_when_buying", async () => {
    const fetchMock = vi.fn(async () => ok("a"));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useListingDetails({ ids: ["a"], listingMode: "buy" }));
    await waitFor(() => expect(result.current.get("a").status).toBe("ready"));
    expect(fetchMock).toHaveBeenCalledWith("/api/listings/a?mode=buy", expect.anything());
  });

  it("should_use_a_seeded_listing_without_fetching", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useListingDetails({ ids: ["a"], listingMode: "rent", seed: detail("a") }));
    expect(result.current.get("a")).toEqual({ status: "ready", detail: detail("a") });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should_report_an_error_and_retry_on_request", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 500 })).mockResolvedValueOnce(ok("a"));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useListingDetails({ ids: ["a"], listingMode: "rent" }));
    await waitFor(() => expect(result.current.get("a").status).toBe("error"));
    act(() => result.current.retry("a"));
    await waitFor(() => expect(result.current.get("a").status).toBe("ready"));
  });

  it("should_report_a_listing_that_no_longer_exists_as_missing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    const { result } = renderHook(() => useListingDetails({ ids: ["a"], listingMode: "rent" }));
    await waitFor(() => expect(result.current.get("a").status).toBe("missing"));
  });

  it("should_reject_a_response_for_a_different_listing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ok("other")));
    const { result } = renderHook(() => useListingDetails({ ids: ["a"], listingMode: "rent" }));
    await waitFor(() => expect(result.current.get("a").status).toBe("error"));
  });

  it("should_abort_requests_for_listings_no_longer_needed", async () => {
    const signals: AbortSignal[] = [];
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => {
      signals.push(init.signal!);
      return new Promise<Response>(() => {});
    }));
    const { rerender } = renderHook(({ ids }) => useListingDetails({ ids, listingMode: "rent" }), { initialProps: { ids: ["a"] } });
    rerender({ ids: ["b"] });
    expect(signals[0]!.aborted).toBe(true);
    expect(signals[1]!.aborted).toBe(false);
  });
});
