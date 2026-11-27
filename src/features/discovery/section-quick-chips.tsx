"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";

import {
  applySectionQuick,
  parseSectionQuick,
  sectionQuickLabel,
  SECTION_QUICK_FILTERS,
  toggleSectionQuick,
  type SectionQuickItem,
  type SectionQuickKey,
} from "./section-quick-filters";
import type { ViewportCategory, ViewportResponse } from "./viewport-contract";

type FeedItem = ViewportResponse["items"][number];

export function feedQuickItem(item: FeedItem): SectionQuickItem {
  if ("offerId" in item) return { kind: "offer", id: item.offerId, startsAt: item.startsAt, endsAt: item.endsAt, publishedAt: item.confirmedAt };
  return {
    kind: "entry",
    id: item.entryId,
    startsAt: item.content.startsAt,
    endsAt: item.content.endsAt,
    publishedAt: item.approvedAt,
    live: item.state === "live",
    priceCents: item.content.priceCents,
  };
}

/** Applies the section's quick filters (the `quick` address parameter) to the map area's feed. */
export function useSectionQuick({
  category,
  quickParam,
  items,
  serverNow,
}: {
  category: ViewportCategory;
  quickParam: string | null;
  items: readonly FeedItem[] | undefined;
  serverNow: string;
}) {
  const active = useMemo(() => parseSectionQuick(quickParam, category), [category, quickParam]);
  const filtered = useMemo(() => {
    if (!items) return undefined;
    const now = new Date(serverNow);
    return applySectionQuick(items, active, feedQuickItem, { now: Number.isFinite(now.getTime()) ? now : new Date() });
  }, [active, items, serverNow]);

  function toggle(key: SectionQuickKey) {
    const next = toggleSectionQuick(active, key);
    const url = new URL(window.location.href);
    if (next.length) url.searchParams.set("quick", next.join(","));
    else url.searchParams.delete("quick");
    url.searchParams.delete("detailId");
    window.history.pushState(null, "", url);
  }

  return { active, filtered, toggle };
}

const chip = "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function SectionQuickChips({
  category,
  active,
  onToggle,
}: {
  category: ViewportCategory;
  active: readonly SectionQuickKey[];
  onToggle: (key: SectionQuickKey) => void;
}) {
  return (
    <ul aria-label="Quick filters" className="flex flex-wrap gap-2">
      {SECTION_QUICK_FILTERS[category].map((key) => {
        const on = active.includes(key);
        return (
          <li key={key}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(key)}
              className={cn(chip, on ? "border-transparent bg-selection text-selection-foreground" : "border-border bg-panel text-ink hover:border-forest/40")}
            >
              {sectionQuickLabel(key)}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
