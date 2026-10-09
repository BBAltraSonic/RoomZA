"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import chrome from "./pinpoint-chrome.module.css";
import styles from "./pinpoint-header.module.css";

const DockContext = createContext<{ target: HTMLDivElement | null; setTarget: (node: HTMLDivElement | null) => void; onSearchFocus?: () => void } | null>(null);
const mobileQuery = "(max-width: 1023px)";
function subscribeMobile(callback: () => void) {
  if (!window.matchMedia) return () => {};
  const media = window.matchMedia(mobileQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

/** One search form keeps its category handlers and refs when docked to the sheet. */
export function DiscoverySearchProvider({ children, onSearchFocus }: { children: ReactNode; onSearchFocus?: () => void }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const value = useMemo(() => ({ target, setTarget, onSearchFocus }), [target, onSearchFocus]);
  return <DockContext.Provider value={value}>{children}</DockContext.Provider>;
}

export function DiscoverySearchDock() {
  const { setTarget } = useContext(DockContext) ?? {};
  const attachDock = useCallback((node: HTMLDivElement | null) => setTarget?.(node), [setTarget]);
  if (!setTarget) return null;
  return <div ref={attachDock} data-slot="discovery-search-dock" className="relative z-10 shrink-0 px-4 pb-3 lg:hidden" />;
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
