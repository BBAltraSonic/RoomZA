import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Loading placeholders. Every block is decorative (aria-hidden) and shimmers
 * through `.motion-skeleton`, which globals.css stills under reduced motion.
 * Wrap a page's blocks in one <SkeletonStatus> so assistive tech hears a
 * single "Loading …" announcement instead of a pile of empty divs.
 */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      data-slot="skeleton"
      // bg-muted, not bg-warm-surface: warm-surface equals --background in both
      // themes, so blocks vanished anywhere outside a panel card.
      className={cn("motion-skeleton overflow-hidden rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export function SkeletonStatus({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

const lineWidths = ["w-full", "w-11/12", "w-4/5", "w-2/3"] as const;

export function SkeletonText({
  lines = 3,
  className,
  lineClassName = "h-4",
}: {
  lines?: number;
  className?: string;
  lineClassName?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={cn(
            lineClassName,
            // The last line of a paragraph is short, the rest run nearly full width.
            index === lines - 1 && lines > 1 ? "w-3/5" : lineWidths[index % lineWidths.length],
          )}
        />
      ))}
    </div>
  );
}

/** Mirrors PageHeader / AdminHeader: eyebrow, title, description and a trailing action. */
export function SkeletonHeader({
  eyebrow = true,
  descriptionLines = 1,
  action = false,
  className,
}: {
  eyebrow?: boolean;
  descriptionLines?: number;
  action?: boolean;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "mb-5 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between sm:gap-4",
        className,
      )}
    >
      <div className="w-full min-w-0 max-w-2xl">
        {eyebrow ? <Skeleton className="mb-2 h-3 w-28" /> : null}
        <Skeleton className="h-7 w-3/5 max-w-sm sm:h-9" />
        {descriptionLines > 0 ? <SkeletonText lines={descriptionLines} className="mt-3" /> : null}
      </div>
      {action ? <Skeleton className="h-10 w-36 shrink-0 rounded-lg" /> : null}
    </header>
  );
}

/** Mirrors the divided link lists used by the review queues and workspaces. */
export function SkeletonList({
  rows = 4,
  metaLines = 1,
  className,
}: {
  rows?: number;
  metaLines?: number;
  className?: string;
}) {
  return (
    <ul className={cn("divide-y divide-border border-y border-border", className)}>
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="space-y-2 py-4">
          <Skeleton className={cn("h-5", index % 2 === 0 ? "w-3/5" : "w-2/5")} />
          {Array.from({ length: metaLines }, (__, metaIndex) => (
            <Skeleton key={metaIndex} className={cn("h-3.5", metaIndex === 0 ? "w-1/2" : "w-1/3")} />
          ))}
        </li>
      ))}
    </ul>
  );
}

export function SkeletonCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-border bg-panel p-5 shadow-[var(--elevation-1)]", className)}>
      {children}
    </div>
  );
}
