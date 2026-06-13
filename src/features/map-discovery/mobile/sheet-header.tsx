"use client";

import { cn } from "@/lib/utils";

type SheetHeaderProps = {
  /** Invoked when the See_All_Link is activated; expands to the full nearby-listings list. */
  onSeeAll: () => void;
  /** Sheet_Title text; defaults to "Nearby Listings". */
  title?: string;
};

/**
 * SheetHeader — header row of the Bottom_Sheet for Mobile_Map_Discovery.
 *
 * Presentational only: renders the Sheet_Title on the left and the
 * See_All_Link on the right. The Sheet_Title is a heading (<h2>) using the
 * `ink` brand token; the See_All_Link is a native <button> styled with the
 * Housi `orange` brand accent and a visible focus ring.
 *
 * Requirements: 4.2, 4.10
 */
export function SheetHeader({ onSeeAll, title = "Nearby Listings" }: SheetHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      {/* Sheet_Title */}
      <h2 className="truncate text-[18px] font-semibold text-ink tracking-tight">{title}</h2>

      {/* See_All_Link — native button styled as a link */}
      <button
        type="button"
        onClick={onSeeAll}
        aria-label="See all nearby listings"
        className={cn(
          "shrink-0 rounded-md px-1 py-0.5 text-[13px] font-semibold text-forest",
          "transition-colors duration-150 hover:text-forest/80 active:opacity-80",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        See all
      </button>
    </div>
  );
}
