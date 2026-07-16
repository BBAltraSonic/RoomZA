"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  GraduationCap,
  Image as ImageIcon,
  Layers,
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
  seeAllHref,
}: {
  id: string;
  title: string;
  onSeeAll?: () => void;
  seeAllHref?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 pb-4">
      <h2
        id={id}
        className="font-heading text-2xl font-semibold tracking-tight text-ink"
      >
        {title}
      </h2>
      {seeAllHref ? (
        <Link
          href={seeAllHref}
          className="group -my-1 flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-sm font-semibold text-forest transition-colors hover:bg-forest/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View all
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      ) : onSeeAll ? (
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
  /** Approximate number of matching homes, shown as "{count} homes". */
  count?: number;
};

/** Pinpoints lifestyle / search-intent collections mirroring the source strip. */
export const DEFAULT_LIFESTYLE_CATEGORIES: LifestyleCategory[] = [
  {
    id: "student-living",
    label: "Student living",
    tagline: "Study close. Live better.",
    icon: GraduationCap,
    count: 324,
  },
  {
    id: "pet-friendly",
    label: "Pet-friendly",
    tagline: "Homes for every paw.",
    icon: PawPrint,
    count: 186,
  },
  {
    id: "furnished",
    label: "Furnished",
    tagline: "Move in, settle in.",
    icon: Sofa,
    count: 92,
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
    <ul className={cn("flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide", className)}>
      {categories.map((category) => {
        const Icon = category.icon;
        return (
          <li key={category.id} className="w-[calc((100%_-_1rem)/3)] min-w-0 shrink-0 snap-start">
            <button
              type="button"
              onClick={() => onSelect?.(category.id)}
              className="group flex min-h-32 w-full flex-col items-center gap-2 rounded-xl bg-panel px-2 py-3 text-center shadow-[var(--elevation-1)] transition-[transform,box-shadow] duration-200 ease-[var(--ease-out-quart)] hover:-translate-y-0.5 hover:shadow-[var(--elevation-2)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                {Icon ? (
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-forest/10 text-forest transition-transform duration-200 ease-[var(--ease-out-quart)] group-hover:scale-105">
                    <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                ) : null}
                <span className="flex min-w-0 flex-col items-center gap-0.5">
                  <span className="text-xs font-bold leading-tight text-ink">
                    {category.label}
                  </span>
                  {category.tagline ? (
                    <span className="line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                      {category.tagline}
                    </span>
                  ) : null}
                </span>
              </div>

              <div className="mt-auto flex w-full items-end justify-between gap-1">
                {category.count !== undefined ? (
                  <span className="flex min-w-0 flex-col text-left text-[10px] font-medium leading-none text-muted-foreground">
                    <span className="font-bold text-ink">{category.count}</span>
                    <span>homes</span>
                  </span>
                ) : (
                  <span aria-hidden="true" />
                )}
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-forest/10 text-forest transition-colors group-hover:bg-forest group-hover:text-white">
                  <ArrowRight
                    className="size-3.5 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Rental blogs — featured story + two compact reading cards                */
/* -------------------------------------------------------------------------- */

export type RentalBlog = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  imageUrl?: string | null;
};

export const DEFAULT_RENTAL_BLOGS: RentalBlog[] = [];

function BadgePill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex w-fit items-center rounded-full bg-forest px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
      {children}
    </span>
  );
}

export function RentalBlogsSection({
  title = "Rental tips",
  blogs = DEFAULT_RENTAL_BLOGS,
  onSeeAll,
  className,
}: {
  title?: string;
  blogs?: RentalBlog[];
  onSeeAll?: () => void;
  className?: string;
}) {
  const headingId = useId();

  if (blogs.length === 0) {
    return (
      <section aria-labelledby={headingId} className={cn("flex flex-col", className)}>
        <SectionHeader id={headingId} title={title} seeAllHref="/blog" />
        <div className="px-4">
          <div className="rounded-2xl border border-border/70 bg-panel px-5 py-6 shadow-[var(--elevation-1)]">
            <span className="flex size-10 items-center justify-center rounded-full bg-forest/10 text-forest">
              <BookOpen className="size-5" aria-hidden="true" />
            </span>
            <p className="mt-4 text-base font-semibold text-ink">Fresh reads are on the way</p>
            <p className="mt-1 max-w-[42ch] text-sm leading-6 text-muted-foreground">
              New Pinpoints articles will appear here as soon as they are published.
            </p>
            <Link
              href="/blog"
              className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-full px-1 text-sm font-semibold text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Browse the blog
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const [featured, ...rest] = blogs;
  if (!featured) return null;

  return (
    <section aria-labelledby={headingId} className={cn("flex flex-col", className)}>
      <SectionHeader id={headingId} title={title} onSeeAll={onSeeAll} seeAllHref="/blog" />

      <div className="flex flex-col gap-3 px-4">
        <RentalBlogCard
          blog={featured}
          variant="featured"
          badge="Featured read"
          className="h-56"
        />

        {rest.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {rest.map((blog) => (
              <RentalBlogCard
                key={blog.id}
                blog={blog}
                className="h-36"
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function RentalBlogCard({
  blog,
  variant = "compact",
  badge,
  className,
}: {
  blog: RentalBlog;
  variant?: "featured" | "compact";
  badge?: string;
  className?: string;
}) {
  const isFeatured = variant === "featured";
  return (
    <Link
      href={`/blog/${blog.slug}`}
      aria-label={`Read ${blog.title}`}
      className={cn(
        "relative block w-full overflow-hidden rounded-3xl text-left shadow-[var(--elevation-1)]",
        className,
      )}
    >
      <CardImage src={blog.imageUrl} alt="" icon={BookOpen} />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/25 to-transparent transition-opacity"
      />

      {badge || blog.category ? (
        <div className="absolute inset-x-3 top-3 flex">
          {badge ? <BadgePill>{badge}</BadgePill> : null}
          {!badge ? <BadgePill>{blog.category}</BadgePill> : null}
        </div>
      ) : null}

      <div className="absolute inset-x-3 bottom-3 flex flex-col gap-1">
        <span
          className={cn(
            "font-bold leading-tight text-white",
            isFeatured ? "text-xl line-clamp-2" : "truncate text-sm",
          )}
        >
          {blog.title}
        </span>
        <span
          className={cn(
            "flex items-center gap-1 font-medium text-white/85",
            isFeatured ? "text-sm" : "text-xs",
          )}
        >
          <span className="line-clamp-2">{blog.excerpt}</span>
        </span>
      </div>
    </Link>
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

/* -------------------------------------------------------------------------- */
/* 4. Rental guides — concise, progressive answers in the discovery flow     */
/* -------------------------------------------------------------------------- */

export type RentalGuide = {
  id: string;
  title: string;
  summary: string;
  steps: string[];
};

export const DEFAULT_RENTAL_GUIDES: RentalGuide[] = [
  {
    id: "before-you-view",
    title: "Before you view",
    summary: "A quick checklist for comparing homes with confidence.",
    steps: ["Confirm the monthly rent and move-in costs.", "Check the commute at your usual travel time.", "Ask what utilities and parking are included."],
  },
  {
    id: "ready-to-apply",
    title: "Get application-ready",
    summary: "Keep the essentials ready when you find the right place.",
    steps: ["Have your ID and proof of income available.", "Prepare recent bank statements if requested.", "Review the lease terms before you apply."],
  },
  {
    id: "move-in-costs",
    title: "Understand move-in costs",
    summary: "Know the full upfront amount, not only the monthly rent.",
    steps: ["Compare the deposit and admin fee.", "Ask whether parking has a separate cost.", "Confirm when your first rental payment is due."],
  },
];

export function RentalGuidesSection({
  guides = DEFAULT_RENTAL_GUIDES,
  className,
}: {
  guides?: RentalGuide[];
  className?: string;
}) {
  const headingId = useId();
  const [openGuideId, setOpenGuideId] = useState<string | null>(null);

  if (guides.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className={cn("flex flex-col", className)}>
      <div className="flex items-center gap-2 px-4 pb-4">
        <span className="flex size-8 items-center justify-center rounded-full bg-forest/10 text-forest">
          <BookOpen className="size-4" aria-hidden="true" />
        </span>
        <h2 id={headingId} className="font-heading text-2xl font-semibold tracking-tight text-ink">
          Guides for your move
        </h2>
      </div>

      <div className="flex flex-col gap-2 px-4">
        {guides.map((guide) => {
          const isOpen = openGuideId === guide.id;
          const contentId = `${headingId}-${guide.id}`;

          return (
            <article key={guide.id} className="rounded-xl border border-border/70 bg-panel">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={contentId}
                onClick={() => setOpenGuideId(isOpen ? null : guide.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{guide.title}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{guide.summary}</span>
                </span>
                <ChevronDown className={cn("size-4 shrink-0 text-forest transition-transform duration-200", isOpen && "rotate-180")} aria-hidden="true" />
              </button>
              {isOpen ? (
                <div id={contentId} className="border-t border-border/70 px-4 py-3.5">
                  <ul className="space-y-2" aria-label={`${guide.title} checklist`}>
                    {guide.steps.map((step) => (
                      <li key={step} className="flex gap-2 text-sm leading-5 text-muted-foreground">
                        <Check className="mt-0.5 size-3.5 shrink-0 text-forest" aria-hidden="true" />
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Shared discovery feed used by both desktop and mobile. Keep the section
 * order identical across breakpoints so responsive layout changes do not hide
 * or rename the discovery content.
 */
export function DiscoveryExploreSections({
  onSelect,
  className,
  blogs = [],
}: {
  onSelect?: (id: string) => void;
  className?: string;
  blogs?: RentalBlog[];
}) {
  const lifestyleHeadingId = useId();

  return (
    <div className={cn("flex flex-col gap-6", className)} data-slot="discovery-explore-sections">
      <section aria-labelledby={lifestyleHeadingId} className="flex flex-col">
        <h2 id={lifestyleHeadingId} className="sr-only">Lifestyle</h2>
        <LifestyleStrip onSelect={onSelect} />
      </section>
      <RentalBlogsSection blogs={blogs} />
      <CollectionsSection onSelect={onSelect} />
      <RentalGuidesSection />
    </div>
  );
}
