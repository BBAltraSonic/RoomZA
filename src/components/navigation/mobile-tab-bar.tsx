import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function MobileTabBar({
  label,
  itemCount,
  children,
  dataMobileNavigation = false,
}: {
  label: string;
  itemCount: number;
  children: React.ReactNode;
  dataMobileNavigation?: boolean;
}) {
  return (
    <nav
      aria-label={label}
      data-mobile-navigation={dataMobileNavigation ? "" : undefined}
      className="fixed inset-x-0 bottom-0 z-[var(--z-nav-menu)] border-t border-border bg-panel transition-[transform,opacity] duration-200 motion-reduce:transition-none md:hidden"
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
    active ? "text-forest" : "text-muted-foreground hover:text-ink",
    className,
  );
}

export function MobileTabContent({
  active,
  icon: Icon,
  label,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <>
      {active ? (
        <span
          data-mobile-tab-indicator
          aria-hidden="true"
          className="absolute inset-x-0 top-0 mx-auto h-0.5 w-7 rounded-b-full bg-forest"
        />
      ) : null}
      <span className="flex size-7 items-center justify-center" aria-hidden="true">
        <Icon className="size-5" strokeWidth={active ? 2.35 : 1.9} />
      </span>
      <span className={cn("max-w-full whitespace-nowrap", active && "font-semibold")}>{label}</span>
    </>
  );
}
