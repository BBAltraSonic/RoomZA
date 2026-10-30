"use client";

import { useEffect, useRef, useState } from "react";

const INITIAL_COUNT = 8;
const CHUNK = 8;

/**
 * Renders a long list in chunks as the visitor nears its end. The sentinel is
 * observed through the nearest scroll container, so this works in both the
 * bottom sheet and the desktop panel.
 */
export function useProgressiveWindow({ total, resetKey, minCount = 0 }: { total: number; resetKey: string; minCount?: number }) {
  const [revealed, setRevealed] = useState({ key: "", count: INITIAL_COUNT });
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const count = Math.max(revealed.key === resetKey ? revealed.count : INITIAL_COUNT, minCount);
  const hasMore = count < total;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!hasMore || !sentinel || typeof IntersectionObserver === "undefined") return;
    // Recreated per count: a sentinel still in view after a reveal must fire again.
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setRevealed({ key: resetKey, count: Math.min(total, count + CHUNK) });
    }, { rootMargin: "600px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [count, hasMore, resetKey, total]);

  return { count, hasMore, sentinelRef };
}
