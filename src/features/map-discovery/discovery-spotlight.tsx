"use client";

import { useCallback, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type DiscoverySpotlightProps = {
  onDismiss: () => void;
  onSearchFocus: () => void;
  locationName: string;
  homesCount: number;
  isLoading: boolean;
};

export function DiscoverySpotlight({
  onDismiss,
  onSearchFocus,
  locationName,
  homesCount,
  isLoading,
}: DiscoverySpotlightProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const dismissRef = useRef<HTMLButtonElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);

  // Focus the dialog on mount
  useEffect(() => {
    const timer = requestAnimationFrame(() => {
      ctaRef.current?.focus();
    });
    return () => cancelAnimationFrame(timer);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onDismiss();
      }

      // Trap focus within the dialog
      if (e.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onDismiss]
  );

  const handleCtaClick = useCallback(() => {
    onSearchFocus();
    onDismiss();
  }, [onSearchFocus, onDismiss]);

  const orientationText = locationName || "South Africa";
  const countText = isLoading
    ? "Loading homes…"
    : `${homesCount} ${homesCount === 1 ? "home" : "homes"} in view`;

  return (
    <div
      className="fixed inset-0 z-[var(--z-spotlight)] flex items-end justify-center lg:items-center lg:justify-center"
      style={{ right: undefined }}
      aria-hidden="false"
    >
      {/* Scrim — covers the map area only on desktop, full screen on mobile */}
      <div
        className={cn(
          "absolute inset-0 bg-ink/20 backdrop-blur-[2px]",
          "lg:right-[var(--sidebar-w-lg)] xl:right-[var(--sidebar-w-xl)]",
          "animate-in fade-in duration-300 ease-[var(--ease-out-quart)]",
          "motion-reduce:animate-none"
        )}
        onClick={onDismiss}
        aria-hidden="true"
      />

      {/* Dialog panel — aligned within the map area */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="spotlight-heading"
        aria-describedby="spotlight-body"
        onKeyDown={handleKeyDown}
        className={cn(
          // Base
          "relative flex flex-col overflow-hidden bg-panel outline-none",
          // Mobile: full-width bottom sheet
          "w-full rounded-t-[28px] shadow-[var(--elevation-3)]",
          // Desktop: centered within the map area (offset from sidebar)
          "lg:mr-[var(--sidebar-w-lg)] lg:w-[560px] lg:rounded-[32px]",
          "xl:mr-[var(--sidebar-w-xl)]",
          // Entrance
          "animate-in fade-in duration-500 ease-[var(--ease-out-quart)]",
          "slide-in-from-bottom-12 lg:slide-in-from-bottom-8 lg:zoom-in-[0.97]",
          "motion-reduce:animate-none motion-reduce:transition-none"
        )}
      >
        {/* Dismiss button */}
        <button
          ref={dismissRef}
          type="button"
          onClick={onDismiss}
          className={cn(
            "absolute right-4 top-4 z-10 flex size-9 items-center justify-center rounded-full",
            "text-muted-foreground transition-colors duration-150",
            "hover:bg-muted hover:text-ink",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
          )}
          aria-label="Dismiss welcome message"
        >
          <X className="size-4" />
        </button>

        {/* Content */}
        <div className="flex flex-col px-6 pb-8 pt-10 sm:px-8 sm:pb-10 sm:pt-12 lg:px-12 lg:pb-12 lg:pt-14"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 2rem)" }}
        >
          {/* Eyebrow */}
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-forest lg:mb-5 lg:text-sm">
            RoomZA Discovery
          </p>

          {/* Headline — value proposition */}
          <h2
            id="spotlight-heading"
            className="mb-3 text-[1.75rem] font-extrabold leading-[1.15] tracking-tight text-ink sm:text-[2rem] lg:mb-4 lg:text-[2.5rem]"
          >
            Find your next
            <br />
            home on the map.
          </h2>

          {/* Supporting text */}
          <p
            id="spotlight-body"
            className="mb-2 max-w-[42ch] text-base leading-relaxed text-muted-foreground lg:mb-3 lg:text-lg"
          >
            Search a neighbourhood or explore directly. Every listing is pinned
            where it actually is.
          </p>

          {/* Orientation summary */}
          <p className="mb-8 text-sm font-medium text-ink/70 lg:mb-10 lg:text-base">
            <span>{orientationText}</span>
            <span className="mx-1.5 text-border">·</span>
            <span className={cn(isLoading && "animate-pulse")}>{countText}</span>
          </p>

          {/* Actions */}
          <div className="flex flex-col gap-3 sm:flex-row lg:gap-4">
            <button
              ref={ctaRef}
              type="button"
              onClick={handleCtaClick}
              className={cn(
                "flex h-14 flex-1 items-center justify-center gap-2.5 rounded-2xl",
                "bg-forest px-6 text-base font-semibold text-primary-foreground",
                "shadow-sm transition-all duration-150",
                "hover:bg-forest/90 active:scale-[0.98]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
              )}
            >
              <Search className="size-5" />
              Search locations
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className={cn(
                "flex h-14 flex-1 items-center justify-center rounded-2xl",
                "border border-border bg-transparent px-6 text-base font-semibold text-ink",
                "transition-all duration-150",
                "hover:bg-warm-surface active:scale-[0.98]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
              )}
            >
              Explore the map
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
