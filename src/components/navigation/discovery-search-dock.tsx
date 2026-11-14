"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import chrome from "./pinpoint-chrome.module.css";
import styles from "./pinpoint-header.module.css";

type Dock = {
  target: HTMLDivElement | null;
  setTarget: (node: HTMLDivElement | null) => void;
  toolbarTarget: HTMLDivElement | null;
  setToolbarTarget: (node: HTMLDivElement | null) => void;
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
  const value = useMemo(() => ({ target, setTarget, toolbarTarget, setToolbarTarget, panel, onSearchFocus }), [target, toolbarTarget, panel, onSearchFocus]);
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
 * "docked" puts the controls in the results panel, "pending" waits a frame for
 * that panel to mount, and "header" keeps them in the header.
 */
export function useDiscoveryToolbarDock(): { place: "header"; managed: boolean } | { place: "pending" } | { place: "docked"; target: HTMLDivElement } {
  const dock = useContext(DockContext);
  if (!dock?.panel) return { place: "header", managed: Boolean(dock) };
  return dock.toolbarTarget ? { place: "docked", target: dock.toolbarTarget } : { place: "pending" };
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
