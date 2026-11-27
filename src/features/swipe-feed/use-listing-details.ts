"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ListingDetail } from "@/features/listings/detail-cards/types";

const DETAIL_TIMEOUT_MS = 12_000;

export type DetailEntry =
  | { status: "loading"; detail: null }
  | { status: "ready"; detail: ListingDetail }
  | { status: "error"; detail: null };

const LOADING: DetailEntry = { status: "loading", detail: null };

/**
 * Full details for the listings the feed is showing (the current card and the
 * next). Each is fetched once and cached for the feed's lifetime; a listing that
 * leaves the window mid-request is aborted and fetched again if it comes back.
 */
export function useListingDetails({ ids, listingMode, seed }: { ids: readonly string[]; listingMode: "rent" | "buy"; seed?: ListingDetail | null }) {
  const [entries, setEntries] = useState<ReadonlyMap<string, DetailEntry>>(() => seedEntries(seed));
  const [mode, setMode] = useState(listingMode);
  const requests = useRef(new Map<string, AbortController>());
  const [attempt, setAttempt] = useState(0);

  // A market switch invalidates every detail read for the previous market.
  if (mode !== listingMode) {
    setMode(listingMode);
    setEntries(seedEntries(seed));
  }

  const idsKey = ids.join(",");
  useEffect(() => {
    const wanted = new Set(idsKey ? idsKey.split(",") : []);
    for (const [id, controller] of requests.current) {
      if (wanted.has(id)) continue;
      controller.abort();
      requests.current.delete(id);
      setEntries((current) => withoutEntry(current, id));
    }
    for (const id of wanted) {
      if (entries.has(id) && entries.get(id)!.status !== "loading") continue;
      if (requests.current.has(id)) continue;
      const controller = new AbortController();
      requests.current.set(id, controller);
      setEntries((current) => new Map(current).set(id, LOADING));
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(DETAIL_TIMEOUT_MS)]);
      const url = listingMode === "buy" ? `/api/listings/${encodeURIComponent(id)}?mode=buy` : `/api/listings/${encodeURIComponent(id)}`;
      fetch(url, { signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("detail_failed");
          const payload = (await response.json()) as { data?: ListingDetail };
          if (payload.data?.id !== id) throw new Error("detail_mismatch");
          return payload.data;
        })
        .then((detail) => {
          if (controller.signal.aborted) return;
          setEntries((current) => new Map(current).set(id, { status: "ready", detail }));
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setEntries((current) => new Map(current).set(id, { status: "error", detail: null }));
        })
        .finally(() => {
          if (requests.current.get(id) === controller) requests.current.delete(id);
        });
    }
    // `entries` is read for the cache check only; re-running on every entry change would refetch nothing new.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, listingMode, attempt]);

  // Unmounting or switching market cancels everything in flight. React runs this
  // cleanup before the fetch effect above sets up again for the new market.
  useEffect(() => {
    const active = requests.current;
    return () => {
      for (const controller of active.values()) controller.abort();
      active.clear();
    };
  }, [listingMode]);

  const get = useCallback((id: string): DetailEntry => entries.get(id) ?? LOADING, [entries]);
  const retry = useCallback((id: string) => {
    setEntries((current) => withoutEntry(current, id));
    setAttempt((value) => value + 1);
  }, []);

  return { get, retry };
}

function seedEntries(seed: ListingDetail | null | undefined): ReadonlyMap<string, DetailEntry> {
  return seed ? new Map([[seed.id, { status: "ready", detail: seed }]]) : new Map();
}

function withoutEntry(map: ReadonlyMap<string, DetailEntry>, id: string) {
  if (!map.has(id)) return map;
  const next = new Map(map);
  next.delete(id);
  return next;
}
