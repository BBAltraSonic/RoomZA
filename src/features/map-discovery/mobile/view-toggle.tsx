"use client";

// ViewToggle — mobile Map/Grid segmented control for the Mobile_Map_Discovery
// feature. Mirrors the desktop sub-app-bar Map/Grid toggle so the two surfaces
// stay consistent: "Map" shows the interactive map + bottom-sheet carousel,
// "Grid" shows the full vertical list of listing cards.

import { LayoutGrid, Map as MapIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type ViewToggleProps = {
  /** True when the Grid_View is active; false for the Map view. */
  isGridView: boolean;
  /** Invoked with the requested view when a segment is activated. */
  onChange: (isGridView: boolean) => void;
  className?: string;
};

export function ViewToggle({ isGridView, onChange, className }: ViewToggleProps) {
  return (
    <div
      role="group"
      aria-label="Switch between map and grid view"
      className={cn(
        "pointer-events-auto inline-flex items-center gap-1 rounded-full bg-panel p-1 shadow-sm",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange(false)}
        aria-pressed={!isGridView}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          !isGridView ? "bg-forest text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-ink",
        )}
      >
        <MapIcon className="size-4" aria-hidden="true" />
        Map
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        aria-pressed={isGridView}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isGridView ? "bg-forest text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-ink",
        )}
      >
        <LayoutGrid className="size-4" aria-hidden="true" />
        Grid
      </button>
    </div>
  );
}
