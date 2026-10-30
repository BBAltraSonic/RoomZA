"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatViewportBbox, viewportResponseSchema, type ViewportQuery, type ViewportResponse } from "./viewport-contract";
import { observeDiscoveryRefresh } from "./refresh";
import { readFeedCache, reuseStable, writeFeedCache } from "./feed-cache";

type CachedFeed = { feed: ViewportResponse; storedAt: number; expiresAt: number | null };
type FeedItem = ViewportResponse["items"][number];
const itemId = (item: FeedItem) => "offerId" in item ? item.offerId : "entryId" in item ? item.entryId : item.id;

/** A cached snapshot is usable only until its first special starts or ends. */
function readLiveFeed(key: string) {
  const cached = readFeedCache<CachedFeed>("viewport:" + key);
  if (!cached || (cached.expiresAt !== null && Date.now() >= cached.expiresAt)) return null;
  const serverNow = new Date(Date.parse(cached.feed.serverNow) + Date.now() - cached.storedAt).toISOString();
  return { ...cached, feed: { ...cached.feed, serverNow } };
}

/** Latest-request wins; failed refreshes preserve the last public snapshot. */
export function useViewportFeed(query: ViewportQuery | null) {
  const key = query ? new URLSearchParams({ category: query.category, bbox: formatViewportBbox(query.bounds), q: query.q, sort: query.sort, ...(query.category === "service" ? { serviceType: query.serviceType } : {}) }).toString() : null;
  const [feed, setFeed] = useState<ViewportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [nextTransition, setNextTransition] = useState<number | null>(null);
  const [renderedKey, setRenderedKey] = useState(key);
  // Revisited viewports paint at once; the refresh below happens behind them.
  if (renderedKey !== key) {
    setRenderedKey(key);
    const cached = key ? readLiveFeed(key) : null;
    if (cached) {
      setFeed(cached.feed);
      setLoading(false);
      setError(false);
      setNextTransition(cached.expiresAt);
    }
  }
  const shown = useRef<{ key: string; items: readonly FeedItem[] } | null>(null);
  // A camera/filter change must not cancel the old snapshot's expiry deadline.
  useEffect(() => {
    if (nextTransition === null) return;
    const timer = setTimeout(() => { setFeed(null); setRetry(value => value + 1); }, Math.max(0, Math.min(nextTransition - Date.now(), 2147483647)));
    return () => clearTimeout(timer);
  }, [nextTransition]);
  useEffect(() => {
    if (!key) return;
    let disposed = false;
    let request: AbortController | undefined;
    let alarm: ReturnType<typeof setTimeout> | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    async function refresh() {
      clearTimeout(alarm); clearTimeout(deadline); request?.abort();
      const controller = new AbortController(); request = controller;
      // Background refreshes leave what is on screen alone until they have news.
      if (shown.current?.key !== key) setLoading(true);
      const started = performance.now();
      deadline = setTimeout(() => controller.abort("timeout"), 12000);
      try {
        const response = await fetch("/api/discovery/viewport?" + key, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Viewport unavailable");
        const fresh = viewportResponseSchema.parse(await response.json());
        const expected = new URLSearchParams(key!);
        if (fresh.category !== expected.get("category") || formatViewportBbox(fresh.bounds) !== expected.get("bbox")) throw new Error("Wrong viewport");
        if (disposed || request !== controller || controller.signal.aborted) return;
        clearTimeout(deadline);
        const now = performance.now(), elapsed = now - started;
        const transitions = fresh.items.flatMap(item => {
          if ("endsAt" in item) return [Date.parse(item.endsAt) - Date.parse(fresh.serverNow) - elapsed];
          if ("category" in item) return [Date.parse(item.content.endsAt) - Date.parse(fresh.serverNow) - elapsed, ...(item.state === "upcoming" ? [Date.parse(item.content.startsAt) - Date.parse(fresh.serverNow) - elapsed] : [])];
          return [];
        });
        // Never display a snapshot that crossed an expiry during transit.
        if (transitions.some(delay => delay <= 0)) {
          shown.current = null;
          setFeed(null); alarm = setTimeout(() => { void refresh(); }, 100); return;
        }
        const items = reuseStable(shown.current?.items ?? [], fresh.items as FeedItem[], itemId);
        const next = { ...fresh, items } as ViewportResponse;
        shown.current = { key: key!, items };
        setFeed(next); setLoading(false); setError(false);
        const expiresAt = transitions.length ? Date.now() + Math.min(...transitions) : null;
        setNextTransition(expiresAt);
        writeFeedCache("viewport:" + key, { feed: next, storedAt: Date.now(), expiresAt } satisfies CachedFeed);
      } catch {
        if (disposed || request !== controller || (controller.signal.aborted && controller.signal.reason !== "timeout")) return;
        setError(true); setLoading(false);
      } finally { if (request === controller) clearTimeout(deadline); }
    }
    // Query typing is debounced; movement reports only settled bounds.
    const start = setTimeout(() => { void refresh(); }, 200);
    const stop = observeDiscoveryRefresh(refresh);
    return () => { disposed = true; clearTimeout(start); clearTimeout(alarm); clearTimeout(deadline); request?.abort(); stop(); };
  }, [key, retry]);
  const refresh = useCallback(() => setRetry(value => value + 1), []);
  return { feed, loading, error, refresh };
}
