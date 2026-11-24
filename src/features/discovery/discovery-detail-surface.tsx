"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

import { AskPikoButton } from "@/features/piko/ask-piko-button";

/**
 * The shell positions this surface in a desktop rail or a contained mobile sheet. "Ask Piko"
 * floats over its lower corner and comes after the content, so focus still lands on the content.
 */
export function DiscoveryDetailSurface({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    (panel.current?.querySelector<HTMLButtonElement>("button") ?? panel.current)?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && !document.querySelector('[role="dialog"]')) onClose();
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [onClose]);
  return <div ref={panel} role="group" aria-label={label} tabIndex={-1} className="relative h-full min-h-0 outline-none">
    {children}
    <AskPikoButton align="end" className="absolute bottom-4 right-4 z-10 max-w-[calc(100%-2rem)]" />
  </div>;
}
