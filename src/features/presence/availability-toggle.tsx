"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { MotionFeedback } from "@/lib/motion/primitives";

import { setAvailabilityMode } from "./actions";
import type { AvailabilityMode } from "./presence-status";

const OPTIONS: { mode: AvailabilityMode; label: string; hint: string }[] = [
  { mode: "auto", label: "Automatic", hint: "Show as available when you're active on Pinpoint." },
  { mode: "available", label: "Available", hint: "Always show a green badge while you're reachable." },
  { mode: "busy", label: "Busy", hint: "Show as busy so renters know replies may be slower." },
  { mode: "invisible", label: "Invisible", hint: "Hide all live presence signals from renters." },
];

type AvailabilityToggleProps = {
  currentMode: AvailabilityMode;
  className?: string;
};

/**
 * Landlord control for `availability_mode` (design §3.1), placed in profile /
 * settings. Optimistic: reflects the selection immediately and reverts on
 * failure. `invisible` is a first-class privacy opt-out.
 */
export function AvailabilityToggle({ currentMode, className }: AvailabilityToggleProps) {
  const [mode, setMode] = useState<AvailabilityMode>(currentMode);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function choose(next: AvailabilityMode) {
    if (next === mode || isPending) return;
    const previous = mode;
    setMode(next);
    setFeedback(null);

    startTransition(async () => {
      const result = await setAvailabilityMode(next);
      if (!result.success) {
        setMode(previous);
        setFeedback({ ok: false, message: result.error });
        return;
      }
      setFeedback({ ok: true, message: "Availability updated." });
    });
  }

  return (
    <div className={cn("space-y-3", className)}>
      <fieldset className="space-y-2" disabled={isPending}>
        <legend className="text-sm font-medium text-ink">Availability</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {OPTIONS.map((option) => {
            const active = option.mode === mode;
            return (
              <button
                key={option.mode}
                type="button"
                onClick={() => choose(option.mode)}
                aria-pressed={active}
                className={cn(
                  "flex min-h-16 flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                  active
                    ? "border-forest/40 bg-accent text-forest"
                    : "border-border bg-warm-surface text-ink hover:border-forest/30",
                )}
              >
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                  {active ? <Check className="size-3.5 shrink-0" aria-hidden="true" /> : null}
                  {option.label}
                </span>
                <span className="text-xs font-medium text-muted-foreground">{option.hint}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {feedback ? (
        <MotionFeedback
          state={feedback.ok ? "success" : "error"}
          className={cn(
            "rounded-md border p-2 text-xs",
            feedback.ok
              ? "border-forest/20 bg-accent text-forest"
              : "border-destructive/20 bg-destructive/10 text-destructive",
          )}
        >
          {feedback.message}
        </MotionFeedback>
      ) : null}
    </div>
  );
}
