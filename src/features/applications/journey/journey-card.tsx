"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import {
  ArrowRight,
  ChevronDown,
  Clock,
  MapPin,
  Sparkles,
  Trophy,
  UserCheck,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MOTION_SPRING } from "@/lib/motion/tokens";
import type { DerivedJourney } from "../journey";
import { Confetti } from "./confetti";
import { JourneyTimeline } from "./journey-timeline";
import { ProgressRing } from "./progress-ring";

function waitingBadge(waitingOn: DerivedJourney["nextAction"]["waitingOn"]) {
  if (waitingOn === "renter") {
    return { label: "Your move", tone: "text-forest bg-forest/10", icon: UserCheck };
  }
  if (waitingOn === "landlord") {
    return { label: "With the landlord", tone: "text-clay bg-clay/10", icon: Clock };
  }
  return null;
}

export function JourneyCard({ journey }: { journey: DerivedJourney }) {
  const [expanded, setExpanded] = useState(journey.outcome === "active" && journey.percent < 30);

  const isClosed = journey.outcome === "rejected" || journey.outcome === "withdrawn";
  const isApproved = journey.outcome === "approved";
  const ringTone = isClosed ? "muted" : isApproved ? "forest" : "forest";
  const badge = waitingBadge(journey.nextAction.waitingOn);
  const BadgeIcon = badge?.icon;
  const currentStep =
    journey.currentStepIndex >= 0 ? journey.steps[journey.currentStepIndex] : null;

  return (
    <m.article layout transition={MOTION_SPRING.soft} className="relative overflow-hidden rounded-[var(--radius-card)_var(--radius-cut)_var(--radius-card)_var(--radius-card)] border border-border bg-panel p-5 shadow-[var(--shadow-card)] sm:p-6">
      {isApproved ? <Confetti /> : null}

      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex items-center gap-5 sm:flex-col sm:items-center sm:gap-3">
          <ProgressRing
            value={journey.percent}
            tone={ringTone}
            size={112}
            label={isApproved ? "Home!" : "Journey"}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold tracking-tight text-ink">
                <Link href={`/listing/${journey.listingId}`} className="hover:underline">
                  {journey.listingTitle}
                </Link>
              </h2>
              {journey.listingAddress ? (
                <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <MapPin className="size-3.5 shrink-0 text-clay" />
                  <span className="truncate">{journey.listingAddress}</span>
                </p>
              ) : null}
            </div>
            {journey.listingPrice > 0 ? (
              <span className="shrink-0 text-sm font-bold text-forest">
                R {new Intl.NumberFormat("en-ZA").format(journey.listingPrice)}
              </span>
            ) : null}
          </div>

          {/* Next-actionable step — the default focus per the "show only the
              next step" principle. */}
          <div className="mt-4 rounded-lg border border-border bg-background p-4 shadow-[var(--shadow-hairline)]">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                {isApproved ? (
                  <Sparkles className="size-4 text-forest" />
                ) : isClosed ? (
                  <XCircle className="size-4 text-muted-foreground" />
                ) : (
                  <ArrowRight className="size-4 text-forest" />
                )}
                {journey.nextAction.label}
              </p>
              {badge && BadgeIcon ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide",
                    badge.tone,
                  )}
                >
                  <BadgeIcon className="size-3" />
                  {badge.label}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{journey.nextAction.detail}</p>

            {journey.nextAction.href && journey.nextAction.cta ? (
              <Button
                render={<Link href={journey.nextAction.href} />}
                className="mt-3 h-10 w-full bg-forest text-primary-foreground hover:bg-forest/90 sm:w-auto"
              >
                {journey.nextAction.cta}
                <ArrowRight className="size-4" />
              </Button>
            ) : null}
          </div>

          {journey.achievements.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {journey.achievements.map((achievement) => (
                <span
                  key={achievement.id}
                  className="inline-flex items-center gap-1 rounded-full border border-forest/15 bg-background px-2.5 py-1 text-[0.65rem] font-semibold text-forest shadow-[var(--shadow-control)]"
                >
                  <Trophy className="size-3 text-gold" />
                  {achievement.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Expand / collapse the full timeline */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-md py-2 text-xs font-semibold text-muted-foreground transition-shadow hover:text-ink hover:shadow-[var(--shadow-control)]"
      >
        {expanded ? "Hide full journey" : "See full journey"}
        {currentStep && !expanded ? (
          <span className="text-muted-foreground/70">· {currentStep.label}</span>
        ) : null}
        <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <m.div
            key="journey-timeline"
            layout
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={MOTION_SPRING.soft}
            className="mt-2 border-t border-border pt-4"
          >
            <JourneyTimeline steps={journey.steps} />
          </m.div>
        ) : null}
      </AnimatePresence>
    </m.article>
  );
}
