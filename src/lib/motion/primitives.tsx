"use client";

import Image, { type ImageProps } from "next/image";
import { Check, X } from "lucide-react";
import { AnimatePresence, useMotionValue, useMotionValueEvent, useReducedMotion, useSpring } from "motion/react";
import * as m from "motion/react-m";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { feedbackTransition, listItemVariants, listVariants, revealVariants } from "./presets";
import { MOTION_CELEBRATION_MS, MOTION_DURATION, MOTION_PARTICLE_STAGGER_SECONDS, MOTION_SCALE, MOTION_SPRING, staggerDelay } from "./tokens";

export function MotionReveal({
  children,
  className,
  delay = 0,
  once = true,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  once?: boolean;
}) {
  return (
    <m.div
      className={className}
      variants={revealVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount: 0.18 }}
      transition={{ delay }}
    >
      {children}
    </m.div>
  );
}

export function MotionList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <m.div className={className} variants={listVariants} initial="hidden" animate="visible">
      {children}
    </m.div>
  );
}

export function MotionListItem({
  children,
  className,
  index = 0,
  layoutId,
}: {
  children: React.ReactNode;
  className?: string;
  index?: number;
  layoutId?: string;
}) {
  return (
    <m.div
      className={className}
      layout
      layoutId={layoutId}
      variants={listItemVariants}
      transition={{ delay: staggerDelay(index) }}
      exit="exit"
    >
      {children}
    </m.div>
  );
}

export function MotionFeedback({
  children,
  state = "idle",
  className,
}: {
  children: React.ReactNode;
  state?: "idle" | "success" | "error";
  className?: string;
}) {
  return (
    <m.div
      className={className}
      data-feedback={state}
      animate={
        state === "error"
          ? { x: [0, -4, 4, -2, 2, 0] }
          : state === "success"
            ? { scale: [1, MOTION_SCALE.hover, 1] }
            : { x: 0, scale: 1 }
      }
      transition={state === "idle" ? { duration: 0 } : feedbackTransition}
    >
      {children}
    </m.div>
  );
}

const PARTICLES = [
  [-32, -24, -18],
  [-18, -36, -8],
  [0, -42, 4],
  [20, -34, 12],
  [34, -20, 18],
  [-28, 18, -14],
  [28, 20, 16],
] as const;

export function SuccessFeedback({
  eventKey,
  title,
  description,
  className,
  compact = false,
  icon,
}: {
  eventKey: string;
  title: string;
  description?: string;
  className?: string;
  compact?: boolean;
  icon?: React.ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  const lastEventRef = useRef<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    if (lastEventRef.current === eventKey) return;
    lastEventRef.current = eventKey;
    setCelebrate(true);
    const timeout = window.setTimeout(() => setCelebrate(false), MOTION_CELEBRATION_MS);
    return () => window.clearTimeout(timeout);
  }, [eventKey]);

  return (
    <div className={cn("relative flex flex-col items-center text-center", compact && "inline-flex", className)} data-success-event={eventKey}>
      <m.div
        className={cn(
          "relative flex items-center justify-center rounded-full border border-status-success-border bg-status-success-surface text-status-success-text",
          compact ? "size-8" : "size-14",
        )}
        initial={reducedMotion ? false : { opacity: 0, scale: 0.72 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={feedbackTransition}
      >
        {icon ?? <Check className={compact ? "size-4" : "size-7"} strokeWidth={2.5} aria-hidden="true" />}
        <AnimatePresence>
          {celebrate && !reducedMotion
            ? PARTICLES.map(([x, y, rotate], index) => (
                <m.span
                  key={`${eventKey}-${index}`}
                  className="pointer-events-none absolute size-1.5 rounded-full bg-mint"
                  initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                  animate={{ opacity: 0, x, y, rotate, scale: 0.5 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: MOTION_DURATION.slow, delay: index * MOTION_PARTICLE_STAGGER_SECONDS }}
                />
              ))
            : null}
        </AnimatePresence>
      </m.div>
      <h3 className={compact ? "sr-only" : "mt-4 text-xl font-semibold text-ink"}>{title}</h3>
      {description ? <p className={compact ? "sr-only" : "mt-2 text-sm text-muted-foreground"}>{description}</p> : null}
    </div>
  );
}

export type SkeletonVariant = "card" | "map" | "profile" | "gallery" | "form" | "list" | "text";

export function Skeleton({ variant = "text", className }: { variant?: SkeletonVariant; className?: string }) {
  return (
    <div
      aria-hidden="true"
      data-skeleton={variant}
      className={cn(
        "motion-skeleton overflow-hidden rounded-md bg-muted",
        variant === "card" && "aspect-[4/3] w-full rounded-xl",
        variant === "map" && "min-h-72 w-full rounded-none",
        variant === "profile" && "size-12 rounded-full",
        variant === "gallery" && "aspect-[16/10] w-full rounded-xl",
        variant === "form" && "h-11 w-full rounded-lg",
        variant === "list" && "h-20 w-full rounded-xl",
        variant === "text" && "h-4 w-full",
        className,
      )}
    />
  );
}

export function PendingGlyph({ className, label = "Working" }: { className?: string; label?: string }) {
  return (
    <span className={cn("motion-pending-glyph inline-flex h-4 w-5 items-end justify-center gap-0.5", className)} role="status" aria-label={label}>
      <span />
      <span />
      <span />
    </span>
  );
}

export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const reducedMotion = useReducedMotion();
  const raw = useMotionValue(reducedMotion ? value : 0);
  const spring = useSpring(raw, MOTION_SPRING.soft);
  const [display, setDisplay] = useState(reducedMotion ? value : 0);

  useMotionValueEvent(spring, "change", (latest) => setDisplay(Math.round(latest)));

  useEffect(() => {
    raw.set(value);
  }, [raw, value]);

  const renderedValue = reducedMotion ? value : display;
  return <span className={cn("tabular-nums", className)}>{renderedValue.toLocaleString("en-ZA")}</span>;
}

type BlurImageProps = ImageProps & {
  wrapperClassName?: string;
  fallback?: React.ReactNode;
  loadingTestId?: string;
};

export function BlurImage({ className, wrapperClassName, fallback, loadingTestId, onLoad, onError, alt, ...props }: BlurImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <span className={cn("relative block overflow-hidden", wrapperClassName)} data-image-loaded={loaded}>
      {!loaded && !failed ? (
        <span data-testid={loadingTestId} className="absolute inset-0">
          <Skeleton variant="gallery" className="size-full" />
        </span>
      ) : null}
      {failed ? (
        fallback ?? (
          <span className="flex size-full items-center justify-center bg-muted text-muted-foreground">
            <X className="size-5" aria-hidden="true" />
            <span className="sr-only">Image unavailable</span>
          </span>
        )
      ) : (
        <Image
          {...props}
          alt={alt}
          className={cn(
            "transition-[filter,opacity,transform] duration-[var(--motion-slow)] ease-[var(--ease-out-expo)]",
            loaded ? "scale-100 blur-0 opacity-100" : "scale-[1.03] blur-md opacity-60",
            className,
          )}
          onLoad={(event) => {
            setLoaded(true);
            onLoad?.(event);
          }}
          onError={(event) => {
            setFailed(true);
            onError?.(event);
          }}
        />
      )}
    </span>
  );
}

export { AnimatePresence };
