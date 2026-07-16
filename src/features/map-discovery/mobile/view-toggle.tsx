"use client";

// ViewToggle — mobile Map/List segmented control for the Mobile_Map_Discovery
// feature. Rendered as a vertical pill on the right-edge control strip so it
// visually matches the map's locate/zoom/layers buttons (same size, border,
// shadow, and divider). "Map" shows the interactive map + listings carousel; "List" shows the full-screen listings sheet.

import { List, Map as MapIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type ViewToggleProps = {
  /** True when the List view is active; false for the Map view. */
  isGridView: boolean;
  /** Invoked with the requested view when a segment is activated. */
  onChange: (isGridView: boolean) => void;
  className?: string;
};

export function ViewToggle({ isGridView, onChange, className }: ViewToggleProps) {
  return (
    <div
      role="group"
      aria-label="Switch between map and list view"
      className={cn(
        "pointer-events-auto flex flex-col overflow-hidden rounded-full border border-border bg-panel shadow-[var(--elevation-2)] md:rounded-md",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange(false)}
        aria-pressed={!isGridView}
        aria-label="Map view"
        title="Map view"
        className={cn(
          "flex size-11 items-center justify-center transition-colors md:size-10",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          !isGridView
            ? "bg-forest text-primary-foreground"
            : "text-ink hover:bg-warm-surface hover:text-forest",
        )}
      >
        <MapIcon className="size-4" aria-hidden="true" />
      </button>
      <div className="h-px bg-border" />
      <button
        type="button"
        onClick={() => onChange(true)}
        aria-pressed={isGridView}
        aria-label="List view"
        title="List view"
        className={cn(
          "flex size-11 items-center justify-center transition-colors md:size-10",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isGridView
            ? "bg-forest text-primary-foreground"
            : "text-ink hover:bg-warm-surface hover:text-forest",
        )}
      >
        <List className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
