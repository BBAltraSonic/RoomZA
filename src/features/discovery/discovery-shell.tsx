"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ComponentProps, type ReactNode } from "react";
import { DiscoverySearchProvider, DiscoveryToolbarDock } from "@/components/navigation/discovery-search-dock";
import { MobileBottomSheet } from "@/features/map-discovery/mobile/bottom-sheet";
import type { SheetSnap } from "@/features/map-discovery/lib/sheet";
import { FloatingDiscoveryDetail } from "./floating-discovery-detail";

const desktopQuery = "(min-width: 1024px)";
const subscribeDesktop = (callback: () => void) => {
  const query = window.matchMedia?.(desktopQuery);
  query?.addEventListener("change", callback);
  return () => query?.removeEventListener("change", callback);
};
const desktopSnapshot = () => window.matchMedia?.(desktopQuery).matches ?? false;

type DiscoverySurface = "desktop" | "mobile";

/** The results panel: a card on the dark map stage, so the map still reads as the page. */
export const discoveryRailClassName = "relative order-first m-2 flex min-h-0 w-[380px] shrink-0 flex-col overflow-hidden rounded-[var(--radius-panel)] border border-border/70 bg-surface-results shadow-[var(--elevation-3)] xl:w-[420px] 2xl:w-[460px]";

/**
 * The one discovery layout: map, results and details, on a rail or in a sheet.
 * Only the surface for this viewport is mounted, so a results update never does
 * the work twice. An environment supplies its content through the slots.
 */
export function DiscoveryShell({
  header, results, map, resultsLabel, compactResults = false, detail,
  detailLabel = "Special details", sheetKey = "discovery", resultCount, resultsSummary,
  announcements, progress, rail, sheet, onSearchFocus, detailExpanded, onToggleDetailExpanded, onCloseDetail,
}: {
  /** Content can differ per surface, such as a compact desktop detail. */
  detail?: ReactNode | ((surface: DiscoverySurface) => ReactNode);
  detailLabel?: string;
  header: ReactNode;
  results?: ReactNode;
  map: ReactNode;
  resultsLabel: string;
  /** Accepted for older callers; discovery always renders the map. */
  view?: "feed" | "map";
  onboarding?: boolean;
  compactResults?: boolean;
  sheetKey?: string;
  resultCount?: number;
  resultsSummary?: ReactNode;
  /** Screen reader context placed ahead of the header. */
  announcements?: ReactNode;
  /** Drawn over the top edge of the map body. */
  progress?: ReactNode;
  /** Replaces the default results rail. */
  rail?: ReactNode;
  /** Overrides for the mobile sheet. Passing `snap` makes the caller own its position. */
  sheet?: Partial<ComponentProps<typeof MobileBottomSheet>>;
  onSearchFocus?: () => void;
  detailExpanded?: boolean;
  onToggleDetailExpanded?: () => void;
  onCloseDetail?: () => void;
}) {
  const desktop = useSyncExternalStore(subscribeDesktop, desktopSnapshot, () => false);
  const [ownSnap, setOwnSnap] = useState<SheetSnap>("peek");
  const [ownDetailExpanded, setOwnDetailExpanded] = useState(false);
  const scrollTop = useRef(0);
  const desktopScroll = useRef<HTMLDivElement>(null);
  const mapPane = useRef<HTMLDivElement>(null);
  const storageKey = `pinpoint:discovery-sheet:${sheetKey}`;
  const snap = sheet?.snap ?? ownSnap;
  const expanded = detailExpanded ?? ownDetailExpanded;
  const detailContent = typeof detail === "function" ? detail(desktop ? "desktop" : "mobile") : detail;
  const hadDetail = useRef(Boolean(detailContent));

  useEffect(() => {
    let restored: SheetSnap = "peek";
    try {
      const saved = window.sessionStorage.getItem(storageKey);
      if (saved === "peek" || saved === "browse" || saved === "full") restored = saved;
    } catch { /* Storage is optional in private browsing. */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate browser-only session state
    setOwnSnap(restored);
    scrollTop.current = 0;
  }, [storageKey]);

  const parentSnapChange = sheet?.onSnapChange;
  const changeSnap = useCallback((next: SheetSnap) => {
    if (parentSnapChange) {
      parentSnapChange(next);
      return;
    }
    setOwnSnap(next);
    try { window.sessionStorage.setItem(storageKey, next); } catch { /* Optional persistence. */ }
  }, [parentSnapChange, storageKey]);
  const getScrollTop = useCallback(() => scrollTop.current, []);
  const saveScrollTop = useCallback((next: number) => { scrollTop.current = next; }, []);
  const saveSheetHeight = useCallback((height: number) => {
    mapPane.current?.style.setProperty("--discovery-sheet-height", `${height}px`);
  }, []);
  const parentSheetHeight = sheet?.onVisibleHeightChange;
  const settleSheetHeight = useCallback((height: number) => {
    saveSheetHeight(height);
    parentSheetHeight?.(height);
  }, [parentSheetHeight, saveSheetHeight]);
  const searchFocus = useCallback(() => {
    if (snap === "peek") changeSnap("browse");
  }, [snap, changeSnap]);

  // Restore the list before provider effects return focus to its opener.
  useLayoutEffect(() => {
    if (hadDetail.current && !detailContent) {
      changeSnap("browse");
    }
    hadDetail.current = Boolean(detailContent);
    if (desktop || detailContent) saveSheetHeight(0);
    if (desktop && !detailContent && desktopScroll.current) desktopScroll.current.scrollTop = scrollTop.current;
  }, [detailContent, desktop, changeSnap, saveSheetHeight]);

  const defaultRail = <aside aria-label={resultsLabel} className={discoveryRailClassName} data-slot="discovery-rail" data-compact={compactResults}>
    <DiscoveryToolbarDock className="shrink-0 border-b border-border/70 px-4 py-2.5" />
    <div ref={desktopScroll} onScroll={event => saveScrollTop(event.currentTarget.scrollTop)} className="min-h-0 flex-1 overflow-y-auto">{results}</div>
  </aside>;

  return <DiscoverySearchProvider onSearchFocus={onSearchFocus ?? searchFocus} panel={desktop}>
    <main className="flex h-[calc(100dvh_-_var(--app-mobile-nav-offset))] min-h-0 w-full flex-col overflow-hidden bg-surface-results text-ink" data-slot="discovery-shell">
      {announcements}
      <div className="contents">{header}</div>
      <div ref={mapPane} className="relative isolate flex min-h-0 flex-1 overflow-hidden [container-type:size] lg:flex-row lg:bg-surface-chrome" data-discovery-map-body>
        {progress}
        {desktop ? rail ?? defaultRail : null}
        <section aria-label="Discovery map" className="relative h-full min-w-0 flex-1">{map}
          {desktop && detailContent ? <FloatingDiscoveryDetail label={detailLabel} expanded={expanded} onClose={onCloseDetail} onToggleExpanded={onToggleDetailExpanded ?? (() => setOwnDetailExpanded(value => !value))}>{detailContent}</FloatingDiscoveryDetail> : null}
        </section>
        {!desktop ? detailContent ? <aside aria-label={detailLabel} data-slot="mobile-detail-sheet"
          className="absolute inset-x-0 bottom-0 z-[var(--z-detail-mobile)] overflow-hidden rounded-t-2xl bg-panel shadow-[var(--elevation-3)] animate-in fade-in slide-in-from-bottom-12 duration-300 ease-[var(--ease-out-quart)] motion-reduce:animate-none"
          style={{ top: "max(0.5rem, env(safe-area-inset-top))" }}>
          <div className="h-full min-h-0">{detailContent}</div>
        </aside> : <MobileBottomSheet contained resultCount={resultCount} resultNoun="listings"
          aria-label={snap === "full" ? "Show map" : snap === "browse" ? "Open full listings list" : "Browse listings"}
          peek={resultsSummary ?? <p className="text-sm font-semibold">{resultsLabel}</p>}
          header={<p className="px-5 pb-3 text-sm font-semibold">{resultsLabel}</p>}
          onContentScrollPositionChange={saveScrollTop} getInitialScrollTop={getScrollTop}
          {...sheet}
          snap={snap} onSnapChange={changeSnap}
          onVisibleHeightChange={settleSheetHeight}
          onDragHeightChange={saveSheetHeight}>
          {sheet?.children ?? results}
        </MobileBottomSheet> : null}
      </div>
    </main>
  </DiscoverySearchProvider>;
}
