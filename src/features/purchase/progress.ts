import type { Database } from "@/lib/supabase/types";

export type PurchaseStage = Database["public"]["Enums"]["purchase_stage"];

export const PURCHASE_STAGES: PurchaseStage[] = [
  "property_saved",
  "viewing_scheduled",
  "viewing_completed",
  "contacted_seller",
  "negotiating",
  "sale_agreed",
  "purchase_complete",
];

export const purchaseStageLabels: Record<PurchaseStage, string> = {
  property_saved: "Property Saved",
  viewing_scheduled: "Viewing Scheduled",
  viewing_completed: "Viewing Completed",
  contacted_seller: "Contacted Seller",
  negotiating: "Negotiating",
  sale_agreed: "Sale Agreed",
  purchase_complete: "Purchase Complete",
};

export function normalizeCompletedStages(stages: PurchaseStage[]) {
  const seen = new Set<PurchaseStage>();
  return stages.filter((stage) => {
    if (!PURCHASE_STAGES.includes(stage) || seen.has(stage)) return false;
    seen.add(stage);
    return true;
  });
}

export function mergeProgressStage(completedStages: PurchaseStage[], nextStage: PurchaseStage) {
  const normalized = normalizeCompletedStages(completedStages);
  if (!normalized.includes(nextStage)) {
    normalized.push(nextStage);
  }

  const currentStage = PURCHASE_STAGES.find((stage) => !normalized.includes(stage)) ?? "purchase_complete";
  return {
    completedStages: normalizeCompletedStages(normalized),
    currentStage,
  };
}

export function stageState(stage: PurchaseStage, currentStage: PurchaseStage, completedStages: PurchaseStage[]) {
  if (completedStages.includes(stage)) return "complete" as const;
  if (stage === currentStage) return "current" as const;
  return "upcoming" as const;
}
