"use client";

import Image from "next/image";
import { useId } from "react";
import { CalendarDays, ChevronRight, Layers } from "lucide-react";

import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Shared bits                                                                */
/* -------------------------------------------------------------------------- */

/** Section header with a title and a chevron "see all" affordance. */
function SectionHeader({
  id,
  title,
  onSeeAll,
}: {
  id: string;
  title: string;
  onSeeAll?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-4 pb-3">
      <h2 id={id} className="text-xl font-extrabold tracking-tight text-ink">
        {title}
      </h2>
      {onSeeAll ? (
        <button
          type="button"
          onClick={onSeeAll}
          className="flex size-11 items-center justify-center rounded-full text-forest transition-colors hover:bg-muted active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`See all ${title.toLowerCase()}`}
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * Brand-aligned gradient palette used as a fallback when a card has no photo.
 * Each pairs a deeper brand tone with a lighter one so the cards read as
 * vibrant tiles rather than flat blocks.
 */
const FALLBACK_GRADIENTS = [
  "linear-gradient(135deg, var(--color-ink), oklch(0.25 0.02 170))",
  "linear-gradient(135deg, oklch(0.25 0.02 170), var(--color-forest))",
  "linear-gradient(135deg, var(--color-forest), var(--color-ink))",
  "linear-gradient(135deg, var(--color-moss), var(--color-ink))",
];

/** Stable, small hash so a given card always picks the same gradient. */
function gradientForSeed(seed?: string) {
  if (!seed) return FALLBACK_GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return FALLBACK_GRADIENTS[Math.abs(hash) % FALLBACK_GRADIENTS.length];
}

/**
 * Image with a graceful, brand-coloured gradient fallback when no `src` is
 * supplied — keeps the cards vibrant and visually distinct (seeded by `seed`)
 * without real photography wired up yet.
 */
function CardImage({
  src,
  alt,
  seed,
}: {
  src?: string | null;
  alt: string;
  seed?: string;
}) {
  if (!src) {
    return (
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ backgroundImage: gradientForSeed(seed) }}
      />
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      sizes="(min-width: 640px) 50vw, 80vw"
      className="object-cover"
    />
  );
}

/* -------------------------------------------------------------------------- */
/* 1. Category strip — "Night clubs"-style horizontal image cards             */
/* -------------------------------------------------------------------------- */

export type LifestyleCategory = {
  id: string;
  /** Label shown over the image (e.g. "Student living"). */
  label: string;
  imageUrl?: string | null;
};

/** RoomZA lifestyle / search-intent collections mirroring the source strip. */
export const DEFAULT_LIFESTYLE_CATEGORIES: LifestyleCategory[] = [
  { id: "student-living", label: "Student living" },
  { id: "pet-friendly", label: "Pet-friendly" },
  { id: "furnished", label: "Furnished" },
  { id: "luxury", label: "Luxury apartments" },
  { id: "near-campus", label: "Near campus" },
];

/**
 * LifestyleStrip — a horizontally scrolling row of compact image cards, each
 * with a dark gradient scrim and a label, adapted from the source's
 * "Night clubs / Late-night dining" strip.
 */
export function LifestyleStrip({
  categories = DEFAULT_LIFESTYLE_CATEGORIES,
  onSelect,
  className,
}: {
  categories?: LifestyleCategory[];
  onSelect?: (id: string) => void;
  className?: string;
}) {
  return (
    <ul
      className={cn(
        "flex gap-3 overflow-x-auto px-4 py-1 snap-x snap-mandatory scrollbar-hide",
        className,
      )}
    >
      {categories.map((category) => (
        <li key={category.id} className="shrink-0 snap-start">
          <button
            type="button"
            onClick={() => onSelect?.(category.id)}
            className="group relative block h-28 w-32 overflow-hidden rounded-2xl text-left shadow-[var(--elevation-1)] transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CardImage src={category.imageUrl} alt={category.label} seed={category.id} />
            <span className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/10 to-transparent" />
            <span className="absolute inset-x-2 bottom-2 text-sm font-bold leading-tight text-white">
              {category.label}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Open houses — "Events"-style featured card + 2-up grid                  */
/* -------------------------------------------------------------------------- */

export type OpenHouse = {
  id: string;
  /** Listing title / building name. */
  title: string;
  /** Secondary line — typically the area or property type. */
  subtitle: string;
  /** Time pill text (e.g. "Sat / 10:00"). */
  when?: string;
  imageUrl?: string | null;
};

/** Time / status pill overlaid on an open-house card. */
function WhenPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex w-fit items-center gap-1 rounded-md bg-ink/55 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
      <CalendarDays className="size-3" aria-hidden="true" />
      {children}
    </span>
  );
}

/**
 * OpenHousesSection — RoomZA adaptation of the source "Events" block: one large
 * featured card on top, then a two-up grid of smaller cards. Each card overlays
 * a title, subtitle, and a time pill on the image.
 */
export function OpenHousesSection({
  title = "Open houses",
  openHouses,
  onSeeAll,
  onSelect,
  className,
}: {
  title?: string;
  openHouses: OpenHouse[];
  onSeeAll?: () => void;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const headingId = useId();
  if (openHouses.length === 0) return null;

  const [featured, ...rest] = openHouses;
  if (!featured) return null;

  return (
    <section aria-labelledby={headingId} className={cn("flex flex-col", className)}>
      <SectionHeader id={headingId} title={title} onSeeAll={onSeeAll} />

      <div className="flex flex-col gap-3 px-4">
        {/* Featured card */}
        <OpenHouseCard openHouse={featured} onSelect={onSelect} className="h-44" />

        {/* Two-up grid */}
        {rest.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {rest.map((openHouse) => (
              <OpenHouseCard
                key={openHouse.id}
                openHouse={openHouse}
                onSelect={onSelect}
                className="h-32"
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function OpenHouseCard({
  openHouse,
  onSelect,
  className,
}: {
  openHouse: OpenHouse;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(openHouse.id)}
      className={cn(
        "group relative block w-full overflow-hidden rounded-2xl text-left shadow-[var(--elevation-1)] transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <CardImage src={openHouse.imageUrl} alt={openHouse.title} seed={openHouse.id} />
      <span className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/15 to-transparent" />
      <div className="absolute inset-x-3 bottom-3 flex flex-col gap-1">
        <span className="truncate text-base font-bold leading-tight text-white">
          {openHouse.title}
        </span>
        <span className="truncate text-xs font-medium text-white/80">
          {openHouse.subtitle}
        </span>
        {openHouse.when ? <WhenPill>{openHouse.when}</WhenPill> : null}
      </div>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Collections — "Lists"-style cards with a badge + count                  */
/* -------------------------------------------------------------------------- */

export type Collection = {
  id: string;
  /** Collection name (e.g. "Move-in ready"). */
  title: string;
  /** How many listings the collection holds. */
  listingCount: number;
  imageUrl?: string | null;
};

/** RoomZA curated collections mirroring the source "Lists" block. */
export const DEFAULT_COLLECTIONS: Collection[] = [
  { id: "move-in-ready", title: "Move-in ready", listingCount: 19 },
  { id: "under-5k", title: "Under R5 000", listingCount: 24 },
];

/**
 * CollectionsSection — RoomZA adaptation of the source "Lists" block: a two-up
 * grid of curated collection cards. Each pairs an image with a brand badge and
 * a listing count, mirroring the original's logo + "19 places".
 */
export function CollectionsSection({
  title = "Collections",
  collections = DEFAULT_COLLECTIONS,
  onSeeAll,
  onSelect,
  className,
}: {
  title?: string;
  collections?: Collection[];
  onSeeAll?: () => void;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const headingId = useId();
  if (collections.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className={cn("flex flex-col", className)}>
      <SectionHeader id={headingId} title={title} onSeeAll={onSeeAll} />

      <div className="grid grid-cols-2 gap-3 px-4">
        {collections.map((collection) => (
          <button
            key={collection.id}
            type="button"
            onClick={() => onSelect?.(collection.id)}
            className="group flex flex-col text-left transition-transform active:scale-[0.99] focus-visible:outline-none"
          >
            <div className="relative h-32 w-full overflow-hidden rounded-2xl shadow-[var(--elevation-1)]">
              <CardImage src={collection.imageUrl} alt={collection.title} seed={collection.id} />
              {/* Brand badge — RoomZA stand-in for the source's logo chip. */}
              <span className="absolute -bottom-4 left-1/2 flex size-9 -translate-x-1/2 items-center justify-center rounded-full bg-panel text-forest shadow-[var(--elevation-2)] ring-2 ring-panel">
                <Layers className="size-4" aria-hidden="true" />
              </span>
            </div>
            <span className="mt-5 text-center text-sm font-bold leading-tight text-ink">
              {collection.title}
            </span>
            <span className="text-center text-xs text-muted-foreground">
              {collection.listingCount} {collection.listingCount === 1 ? "listing" : "listings"}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
