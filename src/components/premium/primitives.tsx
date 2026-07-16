import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Home,
  Info,
  LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AnimatedNumber, MotionReveal } from "@/lib/motion/primitives";

export function BackLink({
  href,
  children = "Back",
  className,
}: {
  href: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Button
      render={<Link href={href} />}
      variant="ghost"
      className={cn("mb-6 -ml-2 text-muted-foreground", className)}
    >
      <ArrowLeft className="size-4" />
      {children}
    </Button>
  );
}

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
    <main className="min-h-dvh bg-background px-5 pb-[calc(var(--mobile-bottom-nav-h)+2rem)] pt-4 text-foreground sm:px-6 sm:pb-28 sm:pt-6 lg:px-8">
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
    <MotionReveal className={cn("mb-5 sm:mb-8", className)}>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase text-clay">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 font-heading text-xl font-semibold leading-tight tracking-normal text-ink sm:mt-2 sm:text-[2rem]">
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
    </MotionReveal>
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
    <div className="flex flex-col items-center justify-center rounded-xl bg-panel px-6 py-10 text-center shadow-[var(--neu-inset)] sm:rounded-lg sm:px-6 sm:py-16">
      <div className="motion-empty-icon flex size-11 items-center justify-center rounded-xl bg-warm-surface text-forest shadow-[var(--neu-raised-sm)] sm:size-12 sm:rounded-lg">
        <Icon className="size-5" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-ink sm:mt-5">{title}</h2>
      <p className="mt-1.5 max-w-md text-sm leading-6 text-muted-foreground sm:mt-2">{description}</p>
      {action ? <div className="mt-5 sm:mt-6">{action}</div> : null}
    </div>
  );
}

const statusTone = {
  success: "border-status-success-border bg-status-success-surface text-status-success-text",
  warning: "border-status-warning-border bg-status-warning-surface text-status-warning-text",
  error: "border-status-error-border bg-status-error-surface text-status-error-text",
  info: "border-status-info-border bg-status-info-surface text-status-info-text",
  neutral: "border-border bg-muted text-muted-foreground",
  forest: "border-forest/20 bg-accent text-forest",
  clay: "border-clay/25 bg-clay/10 text-clay",
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
    <div className={cn("grid gap-2.5 rounded-xl bg-panel p-2.5 shadow-[var(--neu-raised)] sm:rounded-lg sm:grid-cols-3", className)}>
      {metrics.map((metric) => (
        <div key={metric.label} className="rounded-md bg-warm-surface px-3 py-2.5 shadow-[var(--neu-inset-sm)]">
          <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
          <p
            className={cn(
              "mt-1 text-xl font-semibold text-ink",
              metric.tone === "clay" && "text-clay",
              metric.tone === "forest" && "text-forest",
            )}
          >
            {typeof metric.value === "number" ? <AnimatedNumber value={metric.value} /> : metric.value}
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
        "sticky bottom-[calc(var(--mobile-bottom-nav-h)+1rem)] z-20 grid grid-cols-1 gap-2 rounded-xl bg-panel p-3 shadow-[var(--neu-raised-lg)] sm:bottom-4 sm:flex sm:flex-row sm:items-center sm:justify-between sm:rounded-lg",
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
