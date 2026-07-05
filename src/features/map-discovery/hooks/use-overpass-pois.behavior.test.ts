// @vitest-environment jsdom
//
// POI_Layer (useOverpassPois) degradation + debounce behavior.
//
// Exercises the ≥600 ms debounce on amenity requests, AbortController-based
// supersession, and silent degradation on failure/abort. The hook owns only
// the amenity overlay (`pois`); listing markers and cards are rendered by the
// Discovery shell from a separate data source, so "leaves markers/cards intact
// without the overlay" is verified here as: the hook never throws and never
// surfaces POIs when the request fails or is aborted.
//
// Validates: Requirements 14.3, 14.4
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import { useOverpassPois, type ViewportBounds } from "./use-overpass-pois";

// --- fetch mock (deferred, abort-aware) -------------------------------------
type DeferredFetch = {
  url: string;
  signal: AbortSignal | undefined;
  resolveWith: (elements: unknown[]) => void;
  rejectWith: (error: unknown) => void;
};

let fetchCalls: DeferredFetch[] = [];

function installFetchMock() {
  fetchCalls = [];
  const fetchMock = vi.fn((input: unknown, init?: { signal?: AbortSignal }) => {
    const signal = init?.signal;
    let resolveFn!: (value: unknown) => void;
    let rejectFn!: (reason: unknown) => void;
    const promise = new Promise<unknown>((res, rej) => {
      resolveFn = res;
      rejectFn = rej;
    });

    // Mirror real fetch: aborting the signal rejects with an AbortError.
    if (signal) {
      signal.addEventListener("abort", () => {
        rejectFn(new DOMException("The operation was aborted.", "AbortError"));
      });
    }

    fetchCalls.push({
      url: String(input),
      signal,
      resolveWith: (elements) =>
        resolveFn({ ok: true, json: async () => ({ elements }) }),
      rejectWith: (error) => rejectFn(error),
    });

    return promise;
  });
  vi.stubGlobal("fetch", fetchMock);
}

async function flushPromises() {
  for (let i = 0; i < 6; i += 1) {
    await Promise.resolve();
  }
}

// "groceries" is a pure Overpass category (no static dataset), so an active
// layer always produces exactly one amenity request. Distinct bounds per test
// dodge the module-level POI cache (keyed by category + bounds @ 0.01°).
const GROCERIES = () => new Set<string>(["groceries"]);

const boundsA: ViewportBounds = { west: 18.40, south: -33.95, east: 18.50, north: -33.85 };
const boundsB: ViewportBounds = { west: 28.00, south: -26.25, east: 28.10, north: -26.15 };
const boundsC: ViewportBounds = { west: 31.00, south: -29.90, east: 31.10, north: -29.80 };
const boundsD: ViewportBounds = { west: 25.55, south: -33.98, east: 25.65, north: -33.88 };

// Only fake setTimeout/clearTimeout so the 600 ms debounce is controllable
// while promises, microtasks (queueMicrotask setState), and Date stay real.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  installFetchMock();
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useOverpassPois debounce (Req 14.4)", () => {
  it("does not issue the amenity request before 600 ms elapse", () => {
    renderHook(() => useOverpassPois(GROCERIES(), boundsA));

    act(() => {
      vi.advanceTimersByTime(599);
    });
    expect(fetchCalls).toHaveLength(0);
  });

  it("issues the amenity request once the 600 ms debounce completes", () => {
    renderHook(() => useOverpassPois(GROCERIES(), boundsB));

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(fetchCalls).toHaveLength(1);
  });

  it("aborts the superseded in-flight request when the debounce fires again", () => {
    const { rerender } = renderHook(
      ({ bounds }: { bounds: ViewportBounds }) => useOverpassPois(GROCERIES(), bounds),
      { initialProps: { bounds: boundsC } },
    );

    // First debounce fires → request #1 in flight.
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(fetchCalls).toHaveLength(1);
    const first = fetchCalls[0];
    const abortSpy = vi.fn();
    first.signal?.addEventListener("abort", abortSpy);

    // New bounds → new debounce; when it fires, request #1 is superseded.
    rerender({ bounds: boundsD });
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(fetchCalls).toHaveLength(2);
    expect(first.signal?.aborted).toBe(true);
    expect(abortSpy).toHaveBeenCalledTimes(1);
  });

  it("cancels the pending debounce on unmount before any request is issued", () => {
    const { unmount } = renderHook(() => useOverpassPois(GROCERIES(), boundsA));

    act(() => {
      vi.advanceTimersByTime(300);
    });
    unmount();
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(fetchCalls).toHaveLength(0);
  });
});

describe("useOverpassPois degradation (Req 14.3)", () => {
  it("keeps the amenity overlay empty and does not throw when the request fails", async () => {
    const { result } = renderHook(() => useOverpassPois(GROCERIES(), boundsB));

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(fetchCalls).toHaveLength(1);

    // Network-style failure (not an abort).
    await act(async () => {
      fetchCalls[0].rejectWith(new Error("network failure"));
      await flushPromises();
    });

    // No overlay surfaced, loading cleared, hook still functional.
    expect(result.current.pois).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("keeps the amenity overlay empty and does not throw when the request is aborted", async () => {
    const { result, rerender } = renderHook(
      ({ bounds }: { bounds: ViewportBounds }) => useOverpassPois(GROCERIES(), bounds),
      { initialProps: { bounds: boundsC } },
    );

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(fetchCalls).toHaveLength(1);

    // Supersede → abort request #1, then resolve the survivor with no elements.
    rerender({ bounds: boundsD });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(fetchCalls).toHaveLength(2);
    expect(fetchCalls[0].signal?.aborted).toBe(true);

    await act(async () => {
      fetchCalls[1].resolveWith([]);
      await flushPromises();
    });

    // The aborted request contributed nothing; the overlay stays empty and no
    // error escaped the hook.
    expect(result.current.pois).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});
