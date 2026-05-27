"use client";

import { ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { useState } from "react";
import { type RadiusScoreResult } from "./hooks/use-essential-radius";
import { StatusBadge } from "@/components/premium/primitives";
import { cn } from "@/lib/utils";

export function EssentialRadiusScore({
  score,
  isLoading
}: {
  score: RadiusScoreResult | null;
  isLoading: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-warm-surface p-4 sm:rounded-lg animate-pulse">
        <div className="h-4 w-1/3 bg-muted rounded mb-4" />
        <div className="h-6 w-2/3 bg-muted rounded mb-6" />
        <div className="space-y-3">
          <div className="h-2 bg-muted rounded-full w-full" />
          <div className="h-2 bg-muted rounded-full w-full" />
          <div className="h-2 bg-muted rounded-full w-full" />
        </div>
      </div>
    );
  }

  if (!score) return null;

  return (
    <section className="rounded-xl border border-border bg-warm-surface p-4 sm:rounded-lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="size-4 text-forest" />
            <h2 className="text-sm font-semibold text-ink">Radius Intelligence</h2>
          </div>
          <p className="mt-2 text-xl font-semibold leading-tight text-ink sm:text-lg">
            {score.overallLabel}
          </p>
        </div>
        <StatusBadge tone={score.walkability >= 75 ? "forest" : score.overallScore >= 50 ? "neutral" : "error"}>
          {score.overallScore}/100
        </StatusBadge>
      </div>

      <div className="mt-5 space-y-4">
        <ScoreBar label="Walkability" score={score.walkability} />
        <ScoreBar label="Convenience" score={score.convenience} />
        <ScoreBar label="Student Fit" score={score.student} />
        <ScoreBar label="Family Fit" score={score.family} />
        <ScoreBar label="Commuter Fit" score={score.commuter} />
      </div>

      {score.breakdown.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex w-full items-center justify-between text-sm font-medium text-ink hover:text-forest"
          >
            Nearest Essentials
            {isExpanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
          </button>
          
          {isExpanded && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {score.breakdown.map((item, i) => (
                <div key={i} className="flex justify-between items-center rounded-md bg-panel p-2.5 border border-border text-sm">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">{item.category}</p>
                    <p className="truncate font-medium text-ink mt-0.5">{item.name}</p>
                  </div>
                  <div className={cn(
                    "shrink-0 font-bold",
                    item.distanceMeters <= 800 ? "text-[var(--zone-green)]" : item.distanceMeters <= 1500 ? "text-[var(--zone-orange)]" : "text-[var(--zone-red)]"
                  )}>
                    {item.distanceMeters < 1000 ? `${item.distanceMeters}m` : `${(item.distanceMeters/1000).toFixed(1)}km`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const width = `${Math.max(0, Math.min(100, score))}%`;
  const color = score >= 75 ? "var(--zone-green)" : score >= 50 ? "var(--zone-orange)" : "var(--zone-red)";
  
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-sm text-muted-foreground font-medium">{label}</span>
      <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-border">
        <div 
          className="h-full rounded-full transition-all duration-1000 ease-out" 
          style={{ width, backgroundColor: color }} 
        />
      </div>
      <span className="w-8 shrink-0 text-right text-xs font-bold text-ink">{score}</span>
    </div>
  );
}
