import { AlertCircle, Home, RefreshCcw } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import type { PikoMood } from "@/features/piko/art";
import { Piko } from "@/features/piko/piko";
import { cn } from "@/lib/utils";

type LoadingSkeletonProps = {
  title?: string;
  rows?: number;
  className?: string;
};

export function LoadingSkeleton({
  title = "Loading",
  rows = 4,
  className,
}: LoadingSkeletonProps) {
  return (
    <section
      aria-label={title}
      aria-busy="true"
      className={cn(
        "w-full rounded-lg border border-border bg-panel p-4 shadow-[var(--elevation-1)]",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Skeleton className="size-10" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-5 w-2/3 rounded" />
        </div>
      </div>
      <SkeletonText lines={rows} className="mt-5 space-y-3" lineClassName="h-4 rounded" />
    </section>
  );
}

type EmptyStateProps = {
  title: string;
  description: string;
  action: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  /** Shows Piko for this moment instead of the icon (docs/piko-character-bible.md). */
  mood?: PikoMood;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Home,
  mood,
  className,
}: EmptyStateProps) {
  return (
    <section
      className={cn(
        "flex flex-col items-center rounded-lg border border-dashed border-border bg-panel px-5 py-8 text-center shadow-[var(--elevation-1)]",
        className,
      )}
    >
      {mood ? (
        <Piko mood={mood} height={140} animate="bob" />
      ) : (
        <div className="flex size-11 items-center justify-center rounded-md border border-border bg-warm-surface text-forest">
          <Icon className="size-5" />
        </div>
      )}
      <h2 className="mt-4 text-lg font-semibold leading-snug text-ink">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      <div className="mt-5 flex min-h-11 items-center justify-center">{action}</div>
    </section>
  );
}

type ErrorStateProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  priorData?: ReactNode;
  className?: string;
};

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Try again",
  priorData,
  className,
}: ErrorStateProps) {
  return (
    <section className={cn("w-full", className)}>
      {priorData ? <div className="mb-3">{priorData}</div> : null}
      <div
        role="alert"
        className="rounded-lg border border-status-error-border bg-status-error-surface p-4 text-status-error-text shadow-[var(--elevation-1)]"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold leading-snug">{title}</h2>
            <p className="mt-1 text-sm leading-6">{message}</p>
          </div>
        </div>
        {onRetry ? (
          <Button
            type="button"
            onClick={onRetry}
            className="mt-4 h-11 bg-forest text-primary-foreground hover:bg-forest/90"
          >
            <RefreshCcw className="size-4" />
            {retryLabel}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
