"use client";

import {
  Calendar,
  Check,
  Eye,
  FileText,
  Handshake,
  Home,
  PartyPopper,
  Send,
  Star,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { JourneyStep } from "../journey";

const STEP_ICONS: Record<string, LucideIcon> = {
  send: Send,
  file: FileText,
  eye: Eye,
  star: Star,
  calendar: Calendar,
  home: Home,
  handshake: Handshake,
  party: PartyPopper,
};

function formatWhen(at: string | null): string | null {
  if (!at) return null;
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * The full vertical journey timeline. Each step is a soft neumorphic marker:
 * completed steps carve inward (inset), the current step gently breathes with a
 * forest-green glow, and future steps sit flat and quiet.
 */
export function JourneyTimeline({ steps }: { steps: JourneyStep[] }) {
  return (
    <ol className="relative mt-2 space-y-1">
      {steps.map((step, index) => {
        const Icon = STEP_ICONS[step.icon] ?? Home;
        const isComplete = step.state === "complete";
        const isCurrent = step.state === "current";
        const isBlocked = step.state === "blocked";
        const when = formatWhen(step.at);
        const isLast = index === steps.length - 1;

        return (
          <li
            key={step.id}
            className="journey-row-reveal relative flex gap-3.5 pb-1"
            style={{ ["--stagger-index" as string]: index }}
          >
            {/* Connector rail */}
            {!isLast ? (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[21px] top-11 h-[calc(100%-1rem)] w-0.5 rounded-full",
                  isComplete ? "bg-forest/40" : "bg-border",
                )}
              />
            ) : null}

            {/* Marker */}
            <div
              className={cn(
                "relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full bg-background transition-shadow",
                isComplete && "text-forest",
                isCurrent && "journey-breathe text-forest",
                (step.state === "upcoming" || isBlocked) && "text-muted-foreground/60",
              )}
              style={{
                boxShadow: isComplete
                  ? "var(--neu-inset-sm)"
                  : isCurrent
                    ? "var(--neu-raised)"
                    : "var(--neu-raised-sm)",
              }}
            >
              {isComplete ? (
                <Check className="journey-check-in size-5" strokeWidth={3} />
              ) : (
                <Icon
                  className={cn("size-[1.15rem]", isCurrent && "opacity-100")}
                  strokeWidth={isCurrent ? 2.4 : 2}
                />
              )}
            </div>

            {/* Copy */}
            <div className="min-w-0 pt-1.5 pb-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    isComplete && "text-ink",
                    isCurrent && "text-forest",
                    (step.state === "upcoming" || isBlocked) && "text-muted-foreground",
                  )}
                >
                  {step.label}
                </p>
                {isCurrent ? (
                  <span className="rounded-full bg-forest/10 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-forest">
                    Now
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                {isComplete ? step.doneCaption : step.pendingCaption}
              </p>
              {when && isComplete ? (
                <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground/70">
                  {when}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
