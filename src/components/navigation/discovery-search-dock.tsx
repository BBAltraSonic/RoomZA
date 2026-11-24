"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import chrome from "./pinpoint-chrome.module.css";
import styles from "./pinpoint-header.module.css";

type Dock = {
  target: HTMLDivElement | null;
  setTarget: (node: HTMLDivElement | null) => void;
  /** The desktop results panel or, on mobile, the bottom sheet. */
  toolbarTarget: HTMLDivElement | null;
  setToolbarTarget: (node: HTMLDivElement | null) => void;
  /** Where panels the controls open (such as Filters) expand inside the mobile sheet. */
  sheetPanelTarget: HTMLDivElement | null;
  setSheetPanelTarget: (node: HTMLDivElement | null) => void;
  /** The results panel sits beside the map, so it holds the browse controls. */
  panel: boolean;
  onSearchFocus?: () => void;
};

const DockContext = createContext<Dock | null>(null);
const mobileQuery = "(max-width: 1023px)";
function subscribeMobile(callback: () => void) {
  if (!window.matchMedia) return () => {};
  const media = window.matchMedia(mobileQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

/** One search form and one set of controls keep their handlers and refs wherever they dock. */
export function DiscoverySearchProvider({ children, onSearchFocus, panel = false }: { children: ReactNode; onSearchFocus?: () => void; panel?: boolean }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const [toolbarTarget, setToolbarTarget] = useState<HTMLDivElement | null>(null);
  const [sheetPanelTarget, setSheetPanelTarget] = useState<HTMLDivElement | null>(null);
  const value = useMemo(() => ({ target, setTarget, toolbarTarget, setToolbarTarget, sheetPanelTarget, setSheetPanelTarget, panel, onSearchFocus }),
    [target, toolbarTarget, sheetPanelTarget, panel, onSearchFocus]);
  return <DockContext.Provider value={value}>{children}</DockContext.Provider>;
}

export function DiscoverySearchDock() {
  const { setTarget } = useContext(DockContext) ?? {};
  const attachDock = useCallback((node: HTMLDivElement | null) => setTarget?.(node), [setTarget]);
  if (!setTarget) return null;
  return <div ref={attachDock} data-slot="discovery-search-dock" className="relative z-10 shrink-0 px-4 pb-3 lg:hidden" />;
}

/** Where the results panel shows the sort and filter controls. Renders nothing in a sheet. */
export function DiscoveryToolbarDock({ className }: { className?: string }) {
  const dock = useContext(DockContext);
  const setToolbarTarget = dock?.setToolbarTarget;
  const attachDock = useCallback((node: HTMLDivElement | null) => setToolbarTarget?.(node), [setToolbarTarget]);
  if (!dock?.panel) return null;
  return <div ref={attachDock} data-slot="discovery-toolbar-dock" className={cn("flex min-w-0 flex-wrap items-center gap-2 empty:hidden", className)} />;
}

/**
 * The mobile sheet's home for the browse controls and the panels they open, so
 * the header never has to expand. Reports its height so Browse can make room.
 */
export function DiscoverySheetControlsDock({ onHeightChange }: { onHeightChange?: (height: number) => void }) {
  const dock = useContext(DockContext);
  const setToolbarTarget = dock?.setToolbarTarget;
  const setSheetPanelTarget = dock?.setSheetPanelTarget;
  const observer = useRef<ResizeObserver | null>(null);
  const attachToolbar = useCallback((node: HTMLDivElement | null) => {
    setToolbarTarget?.(node);
    observer.current?.disconnect();
    observer.current = null;
    if (!node || !onHeightChange) return;
    onHeightChange(node.offsetHeight);
    if (typeof ResizeObserver === "undefined") return;
    observer.current = new ResizeObserver(() => onHeightChange(node.offsetHeight));
    observer.current.observe(node);
  }, [setToolbarTarget, onHeightChange]);
  const attachPanel = useCallback((node: HTMLDivElement | null) => setSheetPanelTarget?.(node), [setSheetPanelTarget]);
  if (!dock || dock.panel) return null;
  return <>
    <div ref={attachToolbar} data-slot="discovery-sheet-toolbar" className="relative z-10 flex shrink-0 touch-pan-x items-center gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] empty:hidden lg:hidden [&>*]:shrink-0" />
    <div ref={attachPanel} data-slot="discovery-sheet-panel" className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] empty:hidden lg:hidden" />
  </>;
}

/**
 * Renders a panel opened by the browse controls inside the mobile sheet. While
 * the sheet is away (a detail is open) it waits rather than expand the header.
 */
export function DiscoverySheetPanel({ children }: { children: ReactNode }) {
  const dock = useContext(DockContext);
  if (!dock || dock.panel) return children;
  return dock.sheetPanelTarget ? createPortal(children, dock.sheetPanelTarget) : null;
}

/**
 * "docked" puts the controls in the results panel or mobile sheet, "pending"
 * waits a frame for the desktop panel to mount, and "header" keeps them in the
 * header (hidden on mobile when a discovery shell manages them).
 */
export function useDiscoveryToolbarDock(): { place: "header"; managed: boolean } | { place: "pending" } | { place: "docked"; target: HTMLDivElement } {
  const dock = useContext(DockContext);
  if (!dock) return { place: "header", managed: false };
  if (dock.toolbarTarget) return { place: "docked", target: dock.toolbarTarget };
  return dock.panel ? { place: "pending" } : { place: "header", managed: true };
}

export function DiscoverySearch({ children, hint, view }: { children: ReactNode; hint?: string; view: "map" | "feed" }) {
  const dock = useContext(DockContext);
  const mobile = useSyncExternalStore(subscribeMobile, () => window.matchMedia?.(mobileQuery).matches ?? false, () => false);
  const content = <div className={styles.search}>{hint ? <p className={styles.searchLabel}>{hint}</p> : null}{children}</div>;
  if (view === "map" && mobile && dock?.target) {
    return createPortal(<div className={chrome.palette} onFocusCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) dock.onSearchFocus?.(); }}>{content}</div>, dock.target);
  }
  return content;
}
