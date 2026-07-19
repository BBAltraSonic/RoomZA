import { AlertCircle, Home, RefreshCcw } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { Button } from "@/components/ui/button";
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
        <div className="motion-skeleton size-10 overflow-hidden rounded-md bg-warm-surface" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="motion-skeleton h-3 w-24 overflow-hidden rounded bg-warm-surface" />
          <div className="motion-skeleton h-5 w-2/3 overflow-hidden rounded bg-warm-surface" />
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className={cn(
              "motion-skeleton h-4 overflow-hidden rounded bg-warm-surface",
              index % 3 === 0 ? "w-full" : index % 3 === 1 ? "w-5/6" : "w-2/3",
            )}
          />
        ))}
      </div>
    </section>
  );
}

type EmptyStateProps = {
  title: string;
  description: string;
  action: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Home,
  className,
}: EmptyStateProps) {
  return (
    <section
      className={cn(
        "flex flex-col items-center rounded-lg border border-dashed border-border bg-panel px-5 py-8 text-center shadow-[var(--elevation-1)]",
        className,
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-md border border-border bg-warm-surface text-forest">
        <Icon className="size-5" />
      </div>
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
