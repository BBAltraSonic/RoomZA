import { Search } from "lucide-react";

import { ListingCarouselSkeleton, MapLoadingSkeleton } from "./discovery-loading";

export function DiscoveryPageFallback() {
  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-warm-surface text-ink">
      <h1 className="sr-only">Homes in view</h1>

      <header className="hidden flex-none items-center gap-5 border-b border-border/40 bg-panel py-3 pl-9 pr-28 shadow-sm lg:flex">
        <div className="flex shrink-0 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Pinpoints" className="h-8 w-auto" />
        </div>
        <div className="flex min-h-10 min-w-0 flex-1 items-center gap-3 rounded-full border border-border/60 bg-warm-surface px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <div className="h-3 w-56 animate-pulse rounded bg-muted" />
        </div>
      </header>

      <div className="relative min-h-0 flex-1 lg:flex">
        <aside className="hidden w-[37%] max-w-[560px] flex-col gap-4 border-r border-border/40 bg-warm-surface p-5 lg:flex">
          <div>
            <div className="h-7 w-48 animate-pulse rounded bg-muted" />
            <div className="mt-3 flex gap-2">
              <div className="h-8 w-24 animate-pulse rounded-full bg-muted" />
              <div className="h-8 w-20 animate-pulse rounded-full bg-muted" />
              <div className="h-8 w-28 animate-pulse rounded-full bg-muted" />
            </div>
          </div>
          <ListingCarouselSkeleton className="-mx-4" />
        </aside>

        <section className="relative min-h-0 flex-1 bg-muted">
          <MapLoadingSkeleton />
        </section>
      </div>
    </main>
  );
}
