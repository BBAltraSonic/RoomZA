import { Search } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";

import { ListingCarouselSkeleton, MapLoadingSkeleton } from "./discovery-loading";

/** Mirrors the discovery workspace: one dark bar, a results card and the map stage. */
export function DiscoveryPageFallback() {
  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-surface-chrome text-ink">
      <h1 className="sr-only" tabIndex={-1}>Homes in view</h1>

      <header className="hidden flex-none items-center gap-4 px-4 py-2.5 text-[var(--brand-panel)] lg:flex">
        <div className="flex shrink-0 items-center gap-3">
          <BrandLogo />
        </div>
        <div className="h-10 w-64 shrink-0 animate-pulse rounded-full bg-[var(--brand-panel)]/10" />
        <div className="flex min-h-11 min-w-0 max-w-[700px] flex-1 items-center gap-3 rounded-full border border-[var(--brand-panel)]/15 bg-[var(--brand-panel)]/5 px-4">
          <Search className="size-4 shrink-0 opacity-60" aria-hidden="true" />
          <div className="h-3 w-56 animate-pulse rounded bg-[var(--brand-panel)]/15" />
        </div>
      </header>

      <div className="relative min-h-0 flex-1 lg:flex">
        <aside className="m-2 hidden w-[380px] shrink-0 flex-col gap-3 overflow-hidden rounded-[var(--radius-panel)] border border-border/70 bg-surface-results pt-4 lg:flex xl:w-[420px] 2xl:w-[460px]">
          <div className="px-4">
            <div className="h-6 w-48 animate-pulse rounded bg-muted" />
            <div className="mt-3 flex gap-2">
              <div className="h-11 w-28 animate-pulse rounded-full bg-muted" />
              <div className="h-11 w-24 animate-pulse rounded-full bg-muted" />
              <div className="h-11 flex-1 animate-pulse rounded-full bg-muted" />
            </div>
          </div>
          <ListingCarouselSkeleton />
        </aside>

        <section className="relative min-h-0 flex-1 bg-muted">
          <MapLoadingSkeleton />
        </section>
      </div>
    </main>
  );
}
