"use client";

import { useEffect, useMemo, useState } from "react";

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
  if ("entryId" in item) {
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
  return { kind: "service", id: item.id };
}

export type OpenNowStatus = "idle" | "loading" | "ready" | "error";

/**
 * Applies the section's quick filters (the `quick` address parameter) to the map area's feed.
 * "Open now" asks the server which visible services are inside their booking hours.
 */
export function useSectionQuick({
  category,
  quickParam,
  items,
  belowNearbyIds,
  serverNow,
}: {
  category: ViewportCategory;
  quickParam: string | null;
  items: readonly FeedItem[] | undefined;
  belowNearbyIds: ReadonlySet<string>;
  serverNow: string;
}) {
  const active = useMemo(() => parseSectionQuick(quickParam, category), [category, quickParam]);
  const wantsOpenNow = active.includes("open-now");
  const serviceIds = useMemo(
    () => (wantsOpenNow ? (items ?? []).flatMap((item) => ("offerId" in item || "entryId" in item ? [] : [item.id])).sort().join(",") : ""),
    [items, wantsOpenNow],
  );
  const [openNow, setOpenNow] = useState<{ key: string; ids: ReadonlySet<string> | null; failed: boolean } | null>(null);

  useEffect(() => {
    if (!serviceIds) return;
    const controller = new AbortController();
    fetch(`/api/services/open-now?ids=${serviceIds}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]), cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as { openIds?: unknown } | null;
        if (!response.ok || !Array.isArray(payload?.openIds)) throw new Error("Open now unavailable");
        if (!controller.signal.aborted) setOpenNow({ key: serviceIds, ids: new Set(payload.openIds as string[]), failed: false });
      })
      .catch(() => {
        if (!controller.signal.aborted) setOpenNow({ key: serviceIds, ids: null, failed: true });
      });
    return () => controller.abort();
  }, [serviceIds]);

  const current = openNow?.key === serviceIds ? openNow : null;
  const openNowStatus: OpenNowStatus = !wantsOpenNow || !serviceIds ? "idle" : !current ? "loading" : current.failed ? "error" : "ready";
  const filtered = useMemo(() => {
    if (!items) return undefined;
    const now = new Date(serverNow);
    return applySectionQuick(items, active, feedQuickItem, {
      now: Number.isFinite(now.getTime()) ? now : new Date(),
      openNowIds: current?.ids ?? null,
      belowNearbyIds,
    });
  }, [active, belowNearbyIds, current, items, serverNow]);

  function toggle(key: SectionQuickKey) {
    const next = toggleSectionQuick(active, key);
    const url = new URL(window.location.href);
    if (next.length) url.searchParams.set("quick", next.join(","));
    else url.searchParams.delete("quick");
    url.searchParams.delete("detailId");
    window.history.pushState(null, "", url);
  }

  return { active, filtered, toggle, openNowStatus };
}

const chip = "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function SectionQuickChips({
  category,
  active,
  onToggle,
  openNowStatus,
  serviceTypes,
  serviceType,
  onServiceType,
}: {
  category: ViewportCategory;
  active: readonly SectionQuickKey[];
  onToggle: (key: SectionQuickKey) => void;
  openNowStatus: OpenNowStatus;
  serviceTypes?: readonly string[];
  serviceType?: string;
  onServiceType?: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      {serviceTypes && onServiceType ? (
        <ul aria-label="Service types" className="flex flex-wrap gap-2">
          {serviceTypes.map((type) => {
            const on = serviceType === type;
            return (
              <li key={type}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onServiceType(on ? "All services" : type)}
                  className={cn(chip, on ? "border-transparent bg-selection text-selection-foreground" : "border-border bg-panel text-ink hover:border-forest/40")}
                >
                  {type}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
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
      {openNowStatus === "loading" ? <p role="status" className="text-xs text-muted-foreground">Checking which services are open now…</p> : null}
      {openNowStatus === "error" ? (
        <p role="alert" className="text-xs text-status-warning-text">Opening hours couldn&apos;t be checked, so every service is still shown. Try again.</p>
      ) : null}
    </div>
  );
}
