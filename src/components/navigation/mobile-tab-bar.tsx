import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function MobileTabBar({
  label,
  itemCount,
  children,
  dataMobileNavigation = false,
  desktopBreakpoint = "md",
}: {
  label: string;
  itemCount: number;
  children: React.ReactNode;
  dataMobileNavigation?: boolean;
  desktopBreakpoint?: "md" | "lg";
}) {
  return (
    <nav
      aria-label={label}
      data-mobile-navigation={dataMobileNavigation ? "" : undefined}
      className={cn("fixed inset-x-0 bottom-0 z-[var(--z-nav-menu)] border-t border-border bg-panel text-ink shadow-[0_-4px_20px_oklch(0.2_0.02_265/5%)] transition-[transform,opacity] duration-200 motion-reduce:transition-none", desktopBreakpoint === "lg" ? "lg:hidden" : "md:hidden")}
      style={{ paddingBottom: "var(--mobile-safe-bottom)" }}
    >
      <div
        className="mx-auto grid min-h-[var(--mobile-bottom-nav-h)] w-full max-w-lg"
        style={{ gridTemplateColumns: `repeat(${itemCount}, minmax(0, 1fr))` }}
      >
        {children}
      </div>
    </nav>
  );
}

export function mobileTabClassName(active: boolean, className?: string) {
  return cn(
    "relative flex min-h-[var(--mobile-bottom-nav-h)] min-w-0 touch-manipulation flex-col items-center justify-center gap-0.5 px-0.5 pb-1 pt-1.5 text-[0.625rem] font-medium leading-none tracking-[-0.01em] outline-none transition-[background-color,color] duration-150 min-[360px]:text-[0.6875rem] focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:bg-muted",
    active ? "text-brand-ink" : "text-muted-foreground hover:text-ink",
    className,
  );
}

export function MobileTabContent({
  active,
  icon: Icon,
  label,
  prominent = false,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  prominent?: boolean;
}) {
  return (
    <>
      {active ? (
        <span
          data-mobile-tab-indicator
          aria-hidden="true"
          className="absolute inset-x-0 top-0 mx-auto h-0.5 w-7 rounded-b-full bg-selection"
        />
      ) : null}
      <span className={cn("flex size-7 items-center justify-center", prominent && "rounded-full bg-selection text-selection-foreground transition-transform group-active:scale-95 motion-reduce:transform-none")} aria-hidden="true">
        <Icon className="size-5" strokeWidth={active ? 2.35 : 1.9} />
      </span>
      <span className={cn("max-w-full whitespace-nowrap", active && "font-semibold")}>{label}</span>
    </>
  );
}
