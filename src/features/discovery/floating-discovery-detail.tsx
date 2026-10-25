"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { Maximize2, Minimize2, X } from "lucide-react";

/** Contained by the map pane so the results rail stays available. */
export function FloatingDiscoveryDetail({ label, expanded, onToggleExpanded, onClose, children }: {
  label: string; expanded: boolean; onToggleExpanded: () => void; onClose?: () => void; children: ReactNode;
}) {
  const close = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    if (!close.current) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    close.current.focus({ preventScroll: true });
    return () => { if (opener?.isConnected) opener.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    if (!onClose) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && !document.querySelector('[role="dialog"]')) {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [onClose]);
  return <aside aria-label={label} data-slot="desktop-floating-details" data-expanded={expanded}
    className="absolute bottom-4 right-4 top-4 z-[var(--z-spotlight)] hidden overflow-hidden rounded-[var(--radius-panel)] border border-border bg-panel text-ink shadow-[var(--elevation-3)] animate-in fade-in slide-in-from-right-4 duration-300 ease-[var(--ease-out-expo)] motion-reduce:animate-none lg:flex"
    style={{ width: `min(${expanded ? 600 : 400}px, calc(100% - 6rem))` }}>
    <div className="h-full min-h-0 w-full" data-slot="desktop-detail-content">{children}</div>
    {onClose ? <button ref={close} type="button" onClick={onClose} aria-label={`Close ${label.toLowerCase()}`}
      className="absolute right-3 top-3 z-20 flex size-11 items-center justify-center rounded-full border border-border bg-panel text-ink shadow-[var(--elevation-1)] hover:bg-accent"><X className="size-4" aria-hidden="true" /></button> : null}
    <button type="button" aria-expanded={expanded} aria-label={`${expanded ? "Collapse" : "Expand"} ${label.toLowerCase()}`}
      onClick={onToggleExpanded}
      className="absolute right-16 top-3 z-20 flex size-11 items-center justify-center rounded-full border border-border bg-panel text-ink shadow-[var(--elevation-1)] transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
      {expanded ? <Minimize2 className="size-4" aria-hidden="true" /> : <Maximize2 className="size-4" aria-hidden="true" />}
    </button>
  </aside>;
}
