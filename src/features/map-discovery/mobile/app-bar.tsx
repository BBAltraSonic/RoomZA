"use client";

import { ChevronLeft, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

type AppBarProps = {
  onBack: () => void;
  screenTitle?: string;
  onMenu?: () => void;
};

export function AppBar({ onBack, screenTitle = "Listings Near You", onMenu }: AppBarProps) {
  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-[var(--z-chrome)]",
        "grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2",
        "bg-background px-3 pb-2"
      )}
      style={{ paddingTop: "max(env(safe-area-inset-top), 0.5rem)" }}
    >
      {/* Back_Button — circular white pill */}
      <button
        type="button"
        onClick={onBack}
        aria-label="Go back"
        className={cn(
          "flex size-10 items-center justify-center rounded-full bg-panel shadow-[var(--elevation-2)]",
          "text-ink transition-all duration-150 active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
        )}
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>

      {/* Screen_Title — centered */}
      <h1 className="truncate text-center text-base font-semibold text-ink">
        {screenTitle}
      </h1>

      {/* Menu button (right side) */}
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open menu"
        className={cn(
          "flex size-10 items-center justify-center rounded-full bg-panel shadow-[var(--elevation-2)]",
          "text-ink transition-all duration-150 active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
        )}
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>
    </header>
  );
}

