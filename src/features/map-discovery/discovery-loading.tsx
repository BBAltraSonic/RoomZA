import { MapPin } from "lucide-react";

import { cn } from "@/lib/utils";

const MAP_PINS = [
  { left: "18%", top: "28%", size: "size-8" },
  { left: "42%", top: "18%", size: "size-10" },
  { left: "64%", top: "42%", size: "size-8" },
  { left: "78%", top: "24%", size: "size-9" },
  { left: "34%", top: "62%", size: "size-8" },
];

export function MapLoadingSkeleton({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading map"
      className={cn("relative h-full min-h-[520px] overflow-hidden bg-muted", className)}
    >
      <div className="absolute inset-0 bg-accent/35" aria-hidden="true" />

      <div className="absolute -left-[10%] top-[18%] h-3 w-[120%] rotate-[7deg] rounded-full bg-panel/90 shadow-sm" aria-hidden="true" />
      <div className="absolute -left-[8%] top-[54%] h-2.5 w-[116%] -rotate-[11deg] rounded-full bg-panel/90 shadow-sm" aria-hidden="true" />
      <div className="absolute left-[28%] top-[-10%] h-[120%] w-2 rotate-[16deg] rounded-full bg-panel/80" aria-hidden="true" />
      <div className="absolute right-[22%] top-[-10%] h-[120%] w-2 -rotate-[8deg] rounded-full bg-panel/80" aria-hidden="true" />

      <div className="absolute left-[5%] top-[8%] h-24 w-40 rounded-3xl bg-forest/8" aria-hidden="true" />
      <div className="absolute bottom-[8%] right-[7%] h-32 w-52 rounded-[2.5rem] bg-forest/8" aria-hidden="true" />

      {MAP_PINS.map((pin, index) => (
        <span
          key={`${pin.left}-${pin.top}`}
          className={cn(
            "motion-skeleton absolute flex items-center justify-center rounded-full border-2 border-panel bg-forest/25 shadow-sm",
            pin.size,
          )}
          style={{ left: pin.left, top: pin.top, animationDelay: `${index * 90}ms` }}
          aria-hidden="true"
        />
      ))}

      <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-border/60 bg-panel px-3 py-2 text-xs font-semibold text-ink shadow-[var(--elevation-1)]">
        <MapPin className="size-3.5 text-forest" aria-hidden="true" />
        <span>Loading map...</span>
      </div>

      <div className="absolute right-4 top-4 flex flex-col gap-2" aria-hidden="true">
        <span className="size-10 rounded-lg border border-border/60 bg-panel shadow-[var(--elevation-1)]" />
        <span className="size-10 rounded-lg border border-border/60 bg-panel shadow-[var(--elevation-1)]" />
      </div>
    </div>
  );
}

const LISTING_SKELETON_KEYS = ["listing-1", "listing-2", "listing-3"];

export function ListingCarouselSkeleton({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading listings"
      className={cn("flex flex-col gap-2", className)}
    >
      <span className="sr-only">Loading homes in this area</span>
      <div className="scroll-contained flex gap-3 overflow-hidden px-4 pb-1 lg:px-5" aria-hidden="true">
        {LISTING_SKELETON_KEYS.map((key) => (
          <div
            key={key}
            className="w-[88vw] max-w-[390px] shrink-0 overflow-hidden rounded-2xl border border-border/55 bg-card shadow-[var(--property-card-shadow)]"
          >
            <div className="aspect-[2/1] w-full bg-muted" />
            <div className="relative -mt-5 flex justify-center px-5">
              <div className="h-10 w-36 rounded-full border border-border/55 bg-card p-3 shadow-[var(--property-card-shadow)]">
                <div className="motion-skeleton h-full w-full rounded bg-muted" />
              </div>
            </div>
            <div className="space-y-2 px-4 pb-3 pt-2">
              <div className="motion-skeleton h-3 w-1/3 rounded bg-muted" />
              <div className="motion-skeleton h-4 w-3/4 rounded bg-muted" />
              <div className="motion-skeleton h-3 w-1/2 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
      <div className="mx-auto flex gap-1" aria-hidden="true">
        <span className="h-1.5 w-3 rounded-full bg-forest/35" />
        <span className="size-1.5 rounded-full bg-forest/15" />
        <span className="size-1.5 rounded-full bg-forest/15" />
      </div>
    </div>
  );
}
