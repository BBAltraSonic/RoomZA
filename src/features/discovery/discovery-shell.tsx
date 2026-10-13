"use client";
import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { DiscoverySearchProvider, DiscoverySearchDock } from "@/components/navigation/discovery-search-dock";
import { cn } from "@/lib/utils";

/** Map discovery with a desktop results rail and mobile results sheet. */
export function DiscoveryShell({
  header,
  results,
  map,
  resultsLabel,
  onboarding = false,
  compactResults = false,
  detail,
  detailLabel = "Special details",
}: {
  detail?: ReactNode;
  detailLabel?: string;
  header: ReactNode;
  results: ReactNode;
  map: ReactNode;
  view?: "feed" | "map";
  resultsLabel: string;
  onboarding?: boolean;
  compactResults?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <DiscoverySearchProvider onSearchFocus={() => setExpanded(true)}><main
      className="flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-surface-results text-ink"
      data-slot="discovery-shell"
    >
      <div className={cn("contents", detail && "hidden lg:contents")}>{header}</div>
        <div
          className="relative flex min-h-0 flex-1 overflow-hidden lg:flex-row"
          data-discovery-map-body
        >
          <aside
            aria-label={detail ? detailLabel : resultsLabel}
            className={cn(
              "absolute inset-x-0 bottom-0 z-20 flex max-h-[45%] flex-col overflow-hidden rounded-t-2xl border-t border-border bg-surface-results lg:relative lg:inset-auto lg:order-first lg:max-h-none lg:w-[440px] lg:shrink-0 lg:rounded-none lg:border-r lg:border-t-0 xl:w-[465px]",
              detail && "hidden lg:flex",
              compactResults && "lg:w-[420px] xl:w-[420px]",
              onboarding && expanded && "max-h-[85%]",
              !expanded && "max-h-40",
            )}
          >
            <div className={cn("flex min-h-0 flex-1 flex-col", detail && "hidden")}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
              className="flex min-h-12 shrink-0 items-center justify-between px-5 text-sm font-semibold text-forest lg:hidden"
            >
              {resultsLabel}
              {expanded ? (
                <ChevronDown size={18} aria-hidden="true" />
              ) : (
                <ChevronUp size={18} aria-hidden="true" />
              )}
            </button>
            <DiscoverySearchDock />
            <div
              className={cn(
                "min-h-0 flex-1 overflow-y-auto",
                !expanded && "hidden lg:block",
              )}
            >
              {results}
            </div>
            </div>
            {detail ? <div className="h-full min-h-0 flex-1">{detail}</div> : null}
          </aside>
          <section
            aria-label="Discovery map"
            className="relative h-full min-w-0 flex-1"
          >
            {map}
          </section>
        </div>
    </main></DiscoverySearchProvider>
  );
}
