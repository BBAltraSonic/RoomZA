"use client";

import type { ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";

import { DiscoverySheetPanel } from "@/components/navigation/discovery-search-dock";
import { cn } from "@/lib/utils";

export const SECTION_FILTERS_PANEL_ID = "section-filters";

/** The header's Filters button for Specials. Matches Property's: icon-only on phones, labelled on desktop. */
export function SectionFiltersButton({ open, activeCount, onToggle }: { open: boolean; activeCount: number; onToggle: () => void }) {
  return <button type="button" aria-expanded={open} aria-controls={SECTION_FILTERS_PANEL_ID} onClick={onToggle}
    className={cn(
      "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-full border bg-panel px-3 text-sm font-semibold text-ink transition-colors hover:border-forest/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:px-3.5",
      open ? "border-forest" : "border-border",
    )}>
    <SlidersHorizontal className="size-4 shrink-0" aria-hidden="true" />
    <span className="sr-only lg:not-sr-only">Filters</span>
    {activeCount ? <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-selection px-1.5 text-[11px] font-bold tabular-nums text-selection-foreground"><span className="sr-only"> · </span>{activeCount}</span> : null}
  </button>;
}

/**
 * What the Filters button opens: the special type and quick filters. On phones it opens
 * inside the bottom sheet; on desktop it sits at the top of the results panel.
 */
export function SectionFiltersPanel({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return <DiscoverySheetPanel>
    <section id={SECTION_FILTERS_PANEL_ID} aria-label="Filters" className="space-y-3 rounded-2xl border border-border/70 bg-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Filters</h2>
        <button type="button" onClick={onClose} aria-label="Close filters"
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-warm-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      {children}
    </section>
  </DiscoverySheetPanel>;
}
