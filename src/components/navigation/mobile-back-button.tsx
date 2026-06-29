"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

type MobileBackButtonProps = {
  /** Where to navigate when there is no browser history to go back to. */
  fallbackHref: string;
  className?: string;
};

/**
 * Fixed-position back button visible only on mobile (< md).
 *
 * Uses `router.back()` when browser history exists, otherwise navigates
 * to `fallbackHref`. Styled as a floating pill matching the app's FAB
 * aesthetic.
 */
export function MobileBackButton({ fallbackHref, className }: MobileBackButtonProps) {
  const router = useRouter();

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label="Go back"
      className={cn(
        "fixed left-4 z-[9999] flex size-10 items-center justify-center rounded-full border border-border bg-panel text-ink shadow-[var(--elevation-2)] transition-all active:scale-90 md:hidden",
        className,
      )}
      style={{ top: "max(env(safe-area-inset-top), 0.75rem)" }}
    >
      <ArrowLeft className="size-[1.125rem]" />
    </button>
  );
}
