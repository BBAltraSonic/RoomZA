"use client";

import { cn } from "@/lib/utils";

type SortLabelProps = {
  /**
   * Number of Listing_Cards currently in the Listing_Carousel. The Sort_Label
   * renders only when at least one card exists (cardCount > 0); otherwise the
   * component renders nothing.
   */
  cardCount: number;
  /** Optional extra classes for layout/spacing within the host. */
  className?: string;
};

/**
 * Sort_Label — presentational section heading for Mobile_Map_Discovery.
 *
 * Displays the exact text "Most Nearest" directly below the Listing_Carousel
 * to indicate the active ascending-distance sort order. It is shown only while
 * the carousel holds at least one card and is hidden when the carousel is empty.
 *
 * Requirements: 6.1, 6.2, 6.6
 */
export function SortLabel({ cardCount, className }: SortLabelProps) {
  if (cardCount <= 0) {
    return null;
  }

  return (
    <p
      className={cn(
        "px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground",
        className
      )}
    >
      Most Nearest
    </p>
  );
}
