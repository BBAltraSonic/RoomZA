"use client";

import { useId } from "react";
import {
  Building,
  Building2,
  ChevronRight,
  GraduationCap,
  Home,
  MapPin,
  Mic,
  MoreHorizontal,
  Search,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A single quick-action chip in the "Explore nearby" category row. Adapted for
 * Pinpoints — instead of Maps-style "Restaurants / Hotels / Coffee", these surface
 * the property types renters browse most.
 */
export type ExploreCategory = {
  /** Stable id used for keys and as the value passed to `onSelectCategory`. */
  id: string;
  /** Short label shown beneath the icon (e.g. "Apartments"). */
  label: string;
  /** Lucide icon rendered in the rounded tile. */
  icon: LucideIcon;
  /** Optional tint for the icon; defaults to the forest brand colour. */
  iconClassName?: string;
};

/**
 * Pinpoints-flavoured defaults — a six-up row of the property types renters browse
 * most, ending in a "More" affordance.
 */
export const DEFAULT_EXPLORE_CATEGORIES: ExploreCategory[] = [
  { id: "apartments", label: "Apartments", icon: Building2 },
  { id: "houses", label: "Houses", icon: Home, iconClassName: "text-gold" },
  { id: "rooms", label: "Rooms", icon: Users, iconClassName: "text-mint" },
  { id: "townhouses", label: "Townhouses", icon: Building, iconClassName: "text-moss" },
  { id: "student", label: "Student", icon: GraduationCap, iconClassName: "text-clay" },
  { id: "more", label: "More", icon: MoreHorizontal, iconClassName: "text-muted-foreground" },
];

type ExploreNearbyProps = {
  /**
   * Map content rendered behind the floating search pill. Pass your existing
   * `MapView` here; when omitted a static placeholder fills the area so the
   * layout is usable without a maps key.
   */
  map?: React.ReactNode;
  /** Category chips for the quick-actions row. Defaults to Pinpoints property types. */
  categories?: ExploreCategory[];
  /** Placeholder text inside the search pill. */
  searchPlaceholder?: string;
  /** Tapping the search pill (e.g. to open the full search sheet). */
  onSearchClick?: () => void;
  /** Tapping the mic affordance inside the search pill. */
  onVoiceSearch?: () => void;
  /** Tapping the "Explore nearby" header chevron / "see all" affordance. */
  onExploreAll?: () => void;
  /** Tapping a category chip; receives the category id. */
  onSelectCategory?: (id: string) => void;
  className?: string;
};

/**
 * ExploreNearby — Pinpoints adaptation of the Google-Maps "Explore nearby"
 * discovery header.
 *
 * Layout (top → bottom):
 * 1. A map filling the top, with a floating "Search here" pill (search + mic)
 *    overlapping its lower edge.
 * 2. An "Explore nearby" section header with a chevron affordance.
 * 3. A row of category quick-actions (icon tiles with labels).
 */
export function ExploreNearby({
  map,
  categories = DEFAULT_EXPLORE_CATEGORIES,
  searchPlaceholder = "Search here",
  onSearchClick,
  onVoiceSearch,
  onExploreAll,
  onSelectCategory,
  className,
}: ExploreNearbyProps) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className={cn("flex w-full flex-col bg-background", className)}
    >
      {/*
       * 1. Map + floating pill.
       *
       * Mobile: a 4:3 map fills the top with the "Search here" pill floating
       * over its lower edge.
       *
       * Desktop (lg+): when docked into the discovery page, that page already
       * renders a full-bleed map, so the embedded map here is redundant — we
       * hide it and let the pill sit static at the top of the panel.
       */}
      <div className="relative">
        <div className="relative aspect-[4/3] w-full overflow-hidden lg:hidden">
          {map ?? <MapPlaceholder />}
        </div>

        <div className="absolute inset-x-4 -bottom-6 z-10 lg:static lg:inset-x-0 lg:bottom-auto lg:px-4 lg:pt-4">
          <div className="flex items-center gap-3 rounded-full bg-panel px-4 py-3 shadow-[var(--elevation-2)] lg:shadow-[var(--elevation-1)]">
            <button
              type="button"
              onClick={onSearchClick}
              className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none"
              aria-label={searchPlaceholder}
            >
              <Search className="size-5 shrink-0 text-forest" aria-hidden="true" />
              <span className="truncate text-base font-semibold text-ink">
                {searchPlaceholder}
              </span>
            </button>
            <button
              type="button"
              onClick={onVoiceSearch}
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-forest transition-transform hover:bg-muted active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Search by voice"
            >
              <Mic className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. "Explore nearby" header. pt-10 clears the floating pill on mobile;
          on desktop the pill is in-flow so the gap collapses. */}
      <div className="flex items-center gap-2 px-4 pb-3 pt-10 lg:pt-4">
        <h2 id={headingId} className="text-xl font-extrabold tracking-tight text-ink">
          Explore nearby
        </h2>
        <button
          type="button"
          onClick={onExploreAll}
          className="flex size-7 items-center justify-center rounded-full text-forest transition-colors hover:bg-muted active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="See all nearby"
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </div>

      {/* 3. Category quick-actions row (horizontally scrollable for 6+ items). */}
      <ul className="flex items-start gap-1 overflow-x-auto px-3 pb-2 scrollbar-hide">
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <li key={category.id} className="min-w-0 flex-1 basis-16 shrink-0">
              <button
                type="button"
                onClick={() => onSelectCategory?.(category.id)}
                className="flex w-full flex-col items-center gap-2 rounded-2xl px-1 py-2 text-center transition-colors hover:bg-muted active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex size-12 items-center justify-center rounded-2xl bg-warm-surface">
                  <Icon
                    className={cn("size-6", category.iconClassName ?? "text-forest")}
                    aria-hidden="true"
                  />
                </span>
                <span className="w-full truncate text-xs font-medium text-muted-foreground">
                  {category.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Lightweight static stand-in for the map so the layout renders without a maps
 * provider. Replace by passing a `map` node (e.g. your `MapView`).
 */
function MapPlaceholder() {
  return (
    <div
      aria-hidden="true"
      className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,var(--color-warm-surface),var(--color-accent))]"
    >
      <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <MapPin className="size-4" />
        Map
      </span>
    </div>
  );
}
