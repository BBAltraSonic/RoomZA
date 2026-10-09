"use client";
import { useEffect, useState } from "react";
import { formatViewportBbox, viewportResponseSchema, type ViewportQuery, type ViewportResponse } from "./viewport-contract";
import { observeDiscoveryRefresh } from "./refresh";

/** Latest-request wins; failed refreshes preserve the last public snapshot. */
export function useViewportFeed(query: ViewportQuery | null) {
  const key = query ? new URLSearchParams({ category: query.category, bbox: formatViewportBbox(query.bounds), q: query.q, sort: query.sort, ...(query.category === "service" ? { serviceType: query.serviceType } : {}) }).toString() : null;
  const [feed, setFeed] = useState<ViewportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [nextTransition, setNextTransition] = useState<number | null>(null);
  // A camera/filter change must not cancel the old snapshot's expiry deadline.
  useEffect(() => {
    if (nextTransition === null) return;
    const timer = setTimeout(() => { setFeed(null); setRetry(value => value + 1); }, Math.max(0, Math.min(nextTransition - performance.now(), 2147483647)));
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
      setLoading(true);
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
          setFeed(null); alarm = setTimeout(() => { void refresh(); }, 100); return;
        }
        setFeed(fresh); setLoading(false); setError(false);
        setNextTransition(transitions.length ? now + Math.min(...transitions) : null);
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
  return { feed, loading, error, refresh: () => setRetry(value => value + 1) };
}
