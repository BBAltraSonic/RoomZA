import { Home, MapPin, Search } from "lucide-react";

import { LoadingSkeleton } from "@/components/ui/route-state";

export function DiscoveryPageFallback() {
  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-warm-surface text-ink">
      <h1 className="sr-only">Homes in view</h1>

      <header className="hidden flex-none items-center gap-5 border-b border-border/40 bg-panel py-3 pl-9 pr-28 shadow-sm lg:flex">
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded bg-forest text-primary-foreground">
            <Home className="size-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-forest">RoomZA</span>
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
          <LoadingSkeleton title="Loading listings" rows={6} className="shadow-none" />
        </aside>

        <section className="relative flex min-h-0 flex-1 items-center justify-center bg-muted">
          <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:56px_56px]" />
          <div className="relative flex flex-col items-center rounded-lg border border-border bg-panel p-5 text-center shadow-[var(--elevation-2)]">
            <div className="flex size-11 items-center justify-center rounded-md bg-warm-surface text-forest">
              <MapPin className="size-5" />
            </div>
            <p className="mt-3 text-sm font-semibold text-ink">Loading map</p>
            <p className="mt-1 text-sm text-muted-foreground">Listings will stream in as soon as the map is ready.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
