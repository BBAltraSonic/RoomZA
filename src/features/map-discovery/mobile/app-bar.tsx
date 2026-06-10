"use client";

import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type AppBarProps = {
  /**
   * Invoked when the Back_Button is activated by tap, Enter, or Space.
   * The caller decides the destination (e.g. router.back() vs router.push('/')).
   */
  onBack: () => void;
  /** Screen_Title text; defaults to "Listings Near You". */
  screenTitle?: string;
};

/**
 * App_Bar — fixed top bar for Mobile_Map_Discovery.
 *
 * Layout uses a 3-column grid ([44px _ minmax(0,1fr) _ 44px]) so the
 * Screen_Title is truly centered between the Back_Button and a symmetric
 * right spacer. The title truncates with a trailing ellipsis when it
 * exceeds the available horizontal space.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.6, 1.7, 10.5
 */
export function AppBar({ onBack, screenTitle = "Listings Near You" }: AppBarProps) {
  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-[var(--z-chrome)]",
        "grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2",
        "bg-panel/95 px-3 pb-2 backdrop-blur-sm shadow-[var(--elevation-1)]"
      )}
      style={{ paddingTop: "max(env(safe-area-inset-top), 0.5rem)" }}
    >
      {/* Back_Button — native button, ≥44×44 touch target */}
      <button
        type="button"
        onClick={onBack}
        aria-label="Go back"
        className={cn(
          "flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full",
          "text-ink transition-colors duration-150",
          "hover:bg-warm-surface active:scale-[0.96]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
        )}
      >
        <ChevronLeft className="size-6" aria-hidden="true" />
      </button>

      {/* Screen_Title — centered, truncating */}
      <h1 className="truncate text-center text-base font-semibold text-ink">
        {screenTitle}
      </h1>

      {/* Symmetric right spacer keeps the title visually centered */}
      <span aria-hidden="true" className="size-11" />
    </header>
  );
}
