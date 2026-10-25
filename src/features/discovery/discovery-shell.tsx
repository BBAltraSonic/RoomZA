"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { DiscoverySearchProvider } from "@/components/navigation/discovery-search-dock";
import { MobileBottomSheet } from "@/features/map-discovery/mobile/bottom-sheet";
import type { SheetSnap } from "@/features/map-discovery/lib/sheet";
import { cn } from "@/lib/utils";
import { FloatingDiscoveryDetail } from "./floating-discovery-detail";

const desktopQuery = "(min-width: 1024px)";
const subscribeDesktop = (callback: () => void) => {
  const query = window.matchMedia?.(desktopQuery);
  query?.addEventListener("change", callback);
  return () => query?.removeEventListener("change", callback);
};
const desktopSnapshot = () => window.matchMedia?.(desktopQuery).matches ?? false;

/** Map discovery with the same contained mobile sheets as Property. */
export function DiscoveryShell({
  header, results, map, resultsLabel, compactResults = false, detail,
  detailLabel = "Special details", sheetKey = "discovery", resultCount, resultsSummary,
}: {
  detail?: ReactNode;
  detailLabel?: string;
  header: ReactNode;
  results: ReactNode;
  map: ReactNode;
  view?: "feed" | "map";
  resultsLabel: string;
  onboarding?: boolean;
  compactResults?: boolean;
  sheetKey?: string;
  resultCount?: number;
  resultsSummary?: ReactNode;
}) {
  const desktop = useSyncExternalStore(subscribeDesktop, desktopSnapshot, () => false);
  const [snap, setSnap] = useState<SheetSnap>("peek");
  const [detailExpanded, setDetailExpanded] = useState(false);
  const scrollTop = useRef(0);
  const desktopScroll = useRef<HTMLDivElement>(null);
  const mapPane = useRef<HTMLDivElement>(null);
  const hadDetail = useRef(Boolean(detail));
  const storageKey = `pinpoint:discovery-sheet:${sheetKey}`;

  useEffect(() => {
    let restored: SheetSnap = "peek";
    try {
      const saved = window.sessionStorage.getItem(storageKey);
      if (saved === "peek" || saved === "browse" || saved === "full") restored = saved;
    } catch { /* Storage is optional in private browsing. */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate browser-only session state
    setSnap(restored);
    scrollTop.current = 0;
  }, [storageKey]);

  const changeSnap = useCallback((next: SheetSnap) => {
    setSnap(next);
    try { window.sessionStorage.setItem(storageKey, next); } catch { /* Optional persistence. */ }
  }, [storageKey]);
  const getScrollTop = useCallback(() => scrollTop.current, []);
  const saveScrollTop = useCallback((next: number) => { scrollTop.current = next; }, []);
  const saveSheetHeight = useCallback((height: number) => {
    mapPane.current?.style.setProperty("--discovery-sheet-height", `${height}px`);
  }, []);
  const searchFocus = useCallback(() => {
    if (snap === "peek") changeSnap("browse");
  }, [snap, changeSnap]);

  // Restore the list before provider effects return focus to its opener.
  useLayoutEffect(() => {
    if (hadDetail.current && !detail) {
      changeSnap("browse");
    }
    hadDetail.current = Boolean(detail);
    if (desktop || detail) saveSheetHeight(0);
    if (desktop && !detail && desktopScroll.current) desktopScroll.current.scrollTop = scrollTop.current;
  }, [detail, desktop, changeSnap, saveSheetHeight]);

  return <DiscoverySearchProvider onSearchFocus={searchFocus}>
    <main className="flex h-[calc(100dvh_-_var(--app-mobile-nav-offset))] min-h-0 w-full flex-col overflow-hidden bg-surface-results text-ink" data-slot="discovery-shell">
      <div className="contents">{header}</div>
      <div ref={mapPane} className="relative isolate flex min-h-0 flex-1 overflow-hidden [container-type:size] lg:flex-row" data-discovery-map-body>
        {desktop ? <aside aria-label={resultsLabel} className={cn(
          "relative order-first flex min-h-0 w-[360px] shrink-0 flex-col overflow-hidden border-r border-border bg-surface-results xl:w-[400px] 2xl:w-[440px]",
          compactResults && "xl:w-[400px]",
        )}>
          <div ref={desktopScroll} onScroll={event => saveScrollTop(event.currentTarget.scrollTop)} className="min-h-0 flex-1 overflow-y-auto">{results}</div>
        </aside> : null}
        <section aria-label="Discovery map" className="relative h-full min-w-0 flex-1">{map}
          {desktop && detail ? <FloatingDiscoveryDetail label={detailLabel} expanded={detailExpanded} onToggleExpanded={() => setDetailExpanded(value => !value)}>{detail}</FloatingDiscoveryDetail> : null}
        </section>
        {!desktop ? detail ? <aside aria-label={detailLabel} data-slot="mobile-detail-sheet"
          className="absolute inset-x-0 bottom-0 z-[var(--z-detail-mobile)] overflow-hidden rounded-t-2xl bg-panel shadow-[var(--elevation-3)] animate-in fade-in slide-in-from-bottom-12 duration-300 ease-[var(--ease-out-quart)] motion-reduce:animate-none"
          style={{ top: "max(0.5rem, env(safe-area-inset-top))" }}>
          <div className="h-full min-h-0">{detail}</div>
        </aside> : <MobileBottomSheet contained snap={snap} onSnapChange={changeSnap} resultCount={resultCount} resultNoun="listings"
          aria-label={snap === "full" ? "Show map" : snap === "browse" ? "Open full listings list" : "Browse listings"}
          peek={resultsSummary ?? <p className="text-sm font-semibold">{resultsLabel}</p>}
          header={<p className="px-5 pb-3 text-sm font-semibold">{resultsLabel}</p>}
          onVisibleHeightChange={saveSheetHeight}
          onContentScrollPositionChange={saveScrollTop} getInitialScrollTop={getScrollTop}>
          {results}
        </MobileBottomSheet> : null}
      </div>
    </main>
  </DiscoverySearchProvider>;
}
