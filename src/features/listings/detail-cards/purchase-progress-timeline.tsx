import { CheckCircle2, Circle, CircleDot } from "lucide-react";

import { PURCHASE_STAGES, purchaseStageLabels, stageState, type PurchaseStage } from "@/features/purchase/progress";
import { cn } from "@/lib/utils";

export function PurchaseProgressTimeline({
  currentStage,
  completedStages,
  compact,
}: {
  currentStage: PurchaseStage;
  completedStages: PurchaseStage[];
  compact?: boolean;
}) {
  return (
    <section className="rounded-xl border border-border bg-warm-surface p-4 sm:rounded-lg">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Purchase progress</h2>
        <span className="rounded-md border border-border bg-panel px-2 py-1 text-xs font-semibold text-muted-foreground shadow-[var(--shadow-hairline)]">
          {completedStages.length}/{PURCHASE_STAGES.length}
        </span>
      </div>
      <ol className={cn("mt-4 grid gap-3", compact ? "" : "sm:grid-cols-2")}>
        {PURCHASE_STAGES.map((stage, index) => {
          const state = stageState(stage, currentStage, completedStages);
          const Icon = state === "complete" ? CheckCircle2 : state === "current" ? CircleDot : Circle;
          return (
            <li key={stage} className="flex items-start gap-3">
              <div
                className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border bg-panel",
                  state === "complete" && "border-forest bg-forest text-primary-foreground",
                  state === "current" && "border-clay text-clay",
                  state === "upcoming" && "border-border text-muted-foreground",
                )}
              >
                <Icon className="size-4" />
              </div>
              <div className="min-w-0">
                <p className={cn("text-sm font-semibold", state === "upcoming" ? "text-muted-foreground" : "text-ink")}>
                  {purchaseStageLabels[stage]}
                </p>
                <p className="text-xs text-muted-foreground">
                  {state === "complete" ? "Completed" : state === "current" ? "Current milestone" : `Step ${index + 1}`}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
