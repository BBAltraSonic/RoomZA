"use client";

import { Popover } from "@base-ui/react/popover";
import { BadgeCheck, Zap } from "lucide-react";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";

import { cn } from "@/lib/utils";
import { MOTION_DURATION, MOTION_EASING, MOTION_STAGGER_SECONDS } from "@/lib/motion/tokens";

import { selectLandlordTrustSignals, type LandlordTrustSummary } from "../landlord-signals";

export function LandlordTrustSignals({
  summary,
  compact = false,
  showEmpty = false,
  className,
}: {
  summary?: LandlordTrustSummary | null;
  compact?: boolean;
  showEmpty?: boolean;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const signals = selectLandlordTrustSignals(summary);

  if (signals.length === 0) {
    return showEmpty ? (
      <p className={cn("text-sm text-muted-foreground", className)}>No published trust signals yet</p>
    ) : null;
  }

  return (
    <ul
      data-slot="landlord-trust-signals"
      className={cn("flex flex-wrap items-center gap-1.5", className)}
      aria-label="Landlord trust signals"
    >
      {signals.map((signal, index) => {
        const Icon = signal.kind === "response_time" ? Zap : BadgeCheck;
        return (
          <m.li
            key={signal.kind}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
              duration: reduceMotion ? 0 : MOTION_DURATION.normal,
              delay: reduceMotion ? 0 : index * MOTION_STAGGER_SECONDS,
              ease: MOTION_EASING.easeOut,
            }}
          >
            <Popover.Root>
              <Popover.Trigger
                openOnHover
                delay={250}
                aria-label={`${signal.label}. ${signal.description}`}
                onClick={(event) => event.stopPropagation()}
                className={cn(
                  "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  signal.tone === "response"
                    ? "border-gold/35 bg-gold/10 text-clay hover:bg-gold/15"
                    : "border-forest/20 bg-accent text-forest hover:bg-forest/10",
                  compact && "px-2.5 text-[11px]",
                )}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                <span>{compact ? signal.compactLabel : signal.label}</span>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner sideOffset={8} className="z-[100]">
                  <Popover.Popup
                    initialFocus={false}
                    className="max-w-64 rounded-lg border border-border bg-popover px-3 py-2 text-xs leading-5 text-popover-foreground shadow-[var(--elevation-2)] outline-none transition-[opacity,transform] duration-[var(--motion-normal)] ease-[var(--ease-out-expo)] data-starting-style:translate-y-1 data-starting-style:opacity-0 data-ending-style:translate-y-1 data-ending-style:opacity-0 motion-reduce:transition-none"
                  >
                    <Popover.Title className="font-semibold text-ink">{signal.label}</Popover.Title>
                    <Popover.Description className="mt-0.5 text-muted-foreground">{signal.description}</Popover.Description>
                    <Popover.Arrow className="size-2 rotate-45 border-b border-r border-border bg-popover" />
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          </m.li>
        );
      })}
    </ul>
  );
}
