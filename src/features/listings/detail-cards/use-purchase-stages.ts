"use client";

import { useCallback, useMemo, useState } from "react";

import { PURCHASE_STAGES, type PurchaseStage } from "@/features/purchase/progress";
import { usePurchaseProgress } from "@/features/purchase/use-purchase-progress";

/**
 * A buyer's purchase milestones: what the server recorded, plus what this visit
 * just reached (saving, contacting the seller) before the server catches up.
 */
export function usePurchaseStages({ listingId, isSale, authenticated, favorited }: {
  listingId: string; isSale: boolean; authenticated: boolean; favorited: boolean;
}) {
  const persisted = usePurchaseProgress(listingId, Boolean(isSale && authenticated));
  const [recorded, setRecorded] = useState<{ id: string; stages: PurchaseStage[] }>({ id: listingId, stages: [] });

  const completed = useMemo(() => {
    const recordedStages = recorded.id === listingId ? recorded.stages : [];
    return [...new Set([
      ...persisted, ...recordedStages,
      ...(isSale && favorited ? ["property_saved" as PurchaseStage] : []),
    ])];
  }, [favorited, isSale, recorded, listingId, persisted]);

  const current = PURCHASE_STAGES.find((stage) => !completed.includes(stage)) ?? "purchase_complete";

  const mark = useCallback((stage: PurchaseStage) => {
    setRecorded((value) => {
      const stages = value.id === listingId ? value.stages : [];
      return { id: listingId, stages: stages.includes(stage) ? stages : [...stages, stage] };
    });
  }, [listingId]);

  return { completed, current, mark };
}
