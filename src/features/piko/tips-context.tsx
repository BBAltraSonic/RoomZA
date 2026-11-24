"use client";

import { createContext, useContext, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { PikoFace } from "./piko";

const PikoTipContext = createContext<string | null>(null);

/** The tip for the item open on the page (see tips.ts), for "Ask Piko" to show beside it. */
export function PikoTipProvider({ tip, children }: { tip: string | null | undefined; children: ReactNode }) {
  return <PikoTipContext.Provider value={tip ?? null}>{children}</PikoTipContext.Provider>;
}

export function usePikoTip() {
  return useContext(PikoTipContext);
}

/** One line from Piko about the open item: "Ends today at 17:00". */
export function PikoTipNote({ tip, className }: { tip: string; className?: string }) {
  return (
    <p
      role="note"
      aria-label="Piko's tip"
      className={cn("inline-flex max-w-full items-center gap-2 rounded-full border border-border/70 bg-panel py-1 pl-1 pr-3 text-xs font-semibold text-ink shadow-[var(--elevation-1)]", className)}
    >
      <PikoFace mood="idea" size={24} />
      <span className="min-w-0">{tip}</span>
    </p>
  );
}
