import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Home,
  Info,
  LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

type ShellProps = {
  children: ReactNode;
  className?: string;
  width?: "sm" | "md" | "lg" | "xl";
};

const widths = {
  sm: "max-w-3xl",
  md: "max-w-5xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
};

export function AppShell({ children, className, width = "lg" }: ShellProps) {
  return (
    <main className="min-h-screen bg-background px-5 pb-[calc(var(--mobile-bottom-nav-h)+2rem)] pt-4 text-foreground sm:px-6 sm:pb-28 sm:pt-6 lg:px-8">
      <div className={cn("mx-auto w-full", widths[width], className)}>
        {children}
      </div>
    </main>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  meta,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-5 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between sm:gap-4", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase text-clay">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 text-xl font-semibold leading-tight tracking-normal text-ink sm:mt-2 sm:text-[2rem]">
          {title}
        </h1>
        {description ? (
          <div className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground sm:mt-2">
            {description}
          </div>
        ) : null}
        {meta ? <div className="mt-3 sm:mt-4">{meta}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function EmptyState({
  icon: Icon = Home,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-panel px-6 py-10 text-center shadow-[var(--elevation-1)] sm:rounded-lg sm:px-6 sm:py-16">
      <div className="flex size-11 items-center justify-center rounded-xl border border-border bg-warm-surface text-forest sm:size-12 sm:rounded-lg">
        <Icon className="size-5" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-ink sm:mt-5">{title}</h2>
      <p className="mt-1.5 max-w-md text-sm leading-6 text-muted-foreground sm:mt-2">{description}</p>
      {action ? <div className="mt-5 sm:mt-6">{action}</div> : null}
    </div>
  );
}

const statusTone = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  error: "border-rose-200 bg-rose-50 text-rose-800",
  info: "border-sky-200 bg-sky-50 text-sky-800",
  neutral: "border-border bg-muted text-muted-foreground",
  forest: "border-forest/20 bg-accent text-forest",
  clay: "border-clay/25 bg-orange-50 text-clay",
};

const statusIcon = {
  success: CheckCircle2,
  warning: AlertCircle,
  error: AlertCircle,
  info: Info,
  neutral: Circle,
  forest: CheckCircle2,
  clay: Circle,
};

export function StatusBadge({
  children,
  tone = "neutral",
  icon = false,
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof statusTone;
  icon?: boolean;
  className?: string;
}) {
  const Icon = statusIcon[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold leading-none",
        statusTone[tone],
        className,
      )}
    >
      {icon ? <Icon className="size-3.5" /> : null}
      {children}
    </span>
  );
}

export function MetricStrip({
  metrics,
  className,
}: {
  metrics: { label: string; value: ReactNode; tone?: "default" | "clay" | "forest" }[];
  className?: string;
}) {
  return (
    <div className={cn("grid gap-2 rounded-xl border border-border bg-panel p-2 shadow-[var(--elevation-1)] sm:rounded-lg sm:grid-cols-3", className)}>
      {metrics.map((metric) => (
        <div key={metric.label} className="rounded-md bg-warm-surface px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
          <p
            className={cn(
              "mt-1 text-xl font-semibold text-ink",
              metric.tone === "clay" && "text-clay",
              metric.tone === "forest" && "text-forest",
            )}
          >
            {metric.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function ActionBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-[calc(var(--mobile-bottom-nav-h)+1rem)] z-20 grid grid-cols-1 gap-2 rounded-xl border border-border bg-panel p-3 shadow-[var(--elevation-3)] sm:bottom-4 sm:flex sm:flex-row sm:items-center sm:justify-between sm:rounded-lg",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function InlineLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("font-medium text-forest underline-offset-4 hover:underline", className)}>
      {children}
    </Link>
  );
}
