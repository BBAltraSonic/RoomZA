"use client";

import Image from "next/image";
import { useId } from "react";
import {
  ArrowRight,
  CalendarDays,
  GraduationCap,
  Image as ImageIcon,
  Layers,
  MapPin,
  PawPrint,
  Sofa,
  Tag,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Shared bits                                                                */
/* -------------------------------------------------------------------------- */

/** Section header with a title and a "View all" text affordance. */
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
    <div className="flex items-baseline justify-between gap-3 px-4 pb-4">
      <h2
        id={id}
        className="font-heading text-2xl font-semibold tracking-tight text-ink"
      >
        {title}
      </h2>
      {onSeeAll ? (
        <button
          type="button"
          onClick={onSeeAll}
          className="group -my-1 flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-sm font-semibold text-forest transition-colors hover:bg-forest/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`View all ${title.toLowerCase()}`}
        >
          View all
          <ArrowRight
            className="size-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </button>
      ) : null}
    </div>
  );
}

/**
 * Image with a placeholder fallback when no `src` is supplied. Fixed editorial
 * tiles pass an `icon` so the empty state reads as an intentional, branded
 * shortcut; data-driven tiles (e.g. open houses) omit it and get a neutral
 * placeholder with a generic image glyph, matching the listing-card fallback.
 */
function CardImage({
  src,
  alt,
  icon: Icon,
}: {
  src?: string | null;
  alt: string;
  icon?: LucideIcon;
}) {
  if (!src) {
    return (
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 flex items-center justify-center",
          Icon ? "bg-forest/10" : "bg-muted",
        )}
      >
        {Icon ? (
          <Icon className="size-9 text-forest/70" />
        ) : (
          <ImageIcon className="size-7 text-muted-foreground/50" />
        )}
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(min-width: 640px) 50vw, 80vw"
      className="object-cover"
    />
  );
}

/* -------------------------------------------------------------------------- */
/* 1. Category cards — soft 3-up grid of search-intent shortcuts               */
/* -------------------------------------------------------------------------- */

export type LifestyleCategory = {
  id: string;
  /** Label shown on the card (e.g. "Student living"). */
  label: string;
  /** Short tagline beneath the label (e.g. "Study close. Live better."). */
  tagline?: string;
  imageUrl?: string | null;
  /** Icon shown for the tile. */
  icon?: LucideIcon;
};

/** Pinpoints lifestyle / search-intent collections mirroring the source strip. */
export const DEFAULT_LIFESTYLE_CATEGORIES: LifestyleCategory[] = [
  {
    id: "student-living",
    label: "Student living",
    tagline: "Study close. Live better.",
    icon: GraduationCap,
  },
  {
    id: "pet-friendly",
    label: "Pet-friendly",
    tagline: "Homes for every paw.",
    icon: PawPrint,
  },
  {
    id: "furnished",
    label: "Furnished",
    tagline: "Move in, settle in.",
    icon: Sofa,
  },
];

/**
 * LifestyleStrip — a soft 3-up grid of raised category cards. Each pairs an
 * outlined brand icon with a bold label and a short tagline, reading as a set of
 * premium, intentional search shortcuts rather than a dense image strip.
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
    <ul className={cn("grid grid-cols-3 gap-3 px-4", className)}>
      {categories.map((category) => {
        const Icon = category.icon;
        return (
          <li key={category.id} className="min-w-0">
            <button
              type="button"
              onClick={() => onSelect?.(category.id)}
              className="group flex h-full w-full flex-col items-center gap-2.5 rounded-3xl bg-panel px-2.5 py-5 text-center shadow-[var(--elevation-1)] transition-[transform,box-shadow] duration-200 ease-[var(--ease-out-quart)] hover:-translate-y-0.5 hover:shadow-[var(--elevation-2)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {Icon ? (
                <span className="flex size-11 items-center justify-center text-forest transition-transform duration-200 ease-[var(--ease-out-quart)] group-hover:scale-110">
                  <Icon className="size-7" strokeWidth={1.75} aria-hidden="true" />
                </span>
              ) : null}
              <span className="text-sm font-bold leading-tight text-ink">
                {category.label}
              </span>
              {category.tagline ? (
                <span className="text-[11px] leading-snug text-muted-foreground">
                  {category.tagline}
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
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
  /** Secondary line — typically the address or area, shown with a pin. */
  subtitle: string;
  /** Time pill text (e.g. "Sat / 10:00"). */
  when?: string;
  imageUrl?: string | null;
};

/** Solid label pill (e.g. "FEATURED") overlaid on an open-house card. */
function BadgePill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex w-fit items-center rounded-full bg-forest px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
      {children}
    </span>
  );
}

/** Time / status pill (with a calendar glyph) overlaid on an open-house card. */
function WhenPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-forest/90 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm backdrop-blur-sm">
      <CalendarDays className="size-3" aria-hidden="true" />
      {children}
    </span>
  );
}

/**
 * OpenHousesSection — one large featured card on top, then a two-up grid of
 * smaller cards. Each card overlays a badge/time pill, a title, and a pinned
 * location on the image.
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
        <OpenHouseCard
          openHouse={featured}
          onSelect={onSelect}
          variant="featured"
          badge="Featured"
          className="h-56"
        />

        {/* Two-up grid */}
        {rest.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {rest.map((openHouse) => (
              <OpenHouseCard
                key={openHouse.id}
                openHouse={openHouse}
                onSelect={onSelect}
                className="h-36"
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
  variant = "compact",
  badge,
  className,
}: {
  openHouse: OpenHouse;
  onSelect?: (id: string) => void;
  variant?: "featured" | "compact";
  badge?: string;
  className?: string;
}) {
  const isFeatured = variant === "featured";
  return (
    <button
      type="button"
      onClick={() => onSelect?.(openHouse.id)}
      className={cn(
        "group relative block w-full overflow-hidden rounded-3xl text-left shadow-[var(--elevation-1)] transition-[transform,box-shadow] duration-200 ease-[var(--ease-out-quart)] hover:shadow-[var(--elevation-2)] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <CardImage src={openHouse.imageUrl} alt={openHouse.title} />
      {/* Image zoom on hover for a premium, tactile feel. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/25 to-transparent transition-opacity"
      />

      {/* Top-left badge / time pill */}
      {badge || openHouse.when ? (
        <div className="absolute inset-x-3 top-3 flex">
          {badge ? <BadgePill>{badge}</BadgePill> : null}
          {!badge && openHouse.when ? <WhenPill>{openHouse.when}</WhenPill> : null}
        </div>
      ) : null}

      <div className="absolute inset-x-3 bottom-3 flex flex-col gap-1">
        <span
          className={cn(
            "font-bold leading-tight text-white",
            isFeatured ? "text-xl line-clamp-2" : "truncate text-sm",
          )}
        >
          {openHouse.title}
        </span>
        <span
          className={cn(
            "flex items-center gap-1 font-medium text-white/85",
            isFeatured ? "text-sm" : "text-xs",
          )}
        >
          <MapPin
            className={cn("shrink-0", isFeatured ? "size-3.5" : "size-3")}
            aria-hidden="true"
          />
          <span className="truncate">{openHouse.subtitle}</span>
        </span>
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
  /** Icon shown when no `imageUrl` is set (fixed editorial tiles). */
  icon?: LucideIcon;
};

/** Pinpoints curated collections mirroring the source "Lists" block. */
export const DEFAULT_COLLECTIONS: Collection[] = [
  { id: "move-in-ready", title: "Move-in ready", listingCount: 19, icon: Tag },
  { id: "under-5k", title: "Under R5 000", listingCount: 24, icon: Wallet },
];

/**
 * CollectionsSection — Pinpoints adaptation of the source "Lists" block: a two-up
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
              <CardImage src={collection.imageUrl} alt={collection.title} icon={collection.icon} />
              {/* Brand badge — Pinpoints stand-in for the source's logo chip. */}
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
