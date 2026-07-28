"use client";

import Image from "next/image";
import Link from "next/link";
import { useId } from "react";
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Eye,
  Globe2,
  Heart,
  Image as ImageIcon,
  ShieldCheck,
  Sofa,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { useHorizontalScrollAffordance } from "@/lib/hooks/use-horizontal-scroll-affordance";
import { cn } from "@/lib/utils";
import type { QuickFilterKey } from "../lib/types";

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

export type QuickFilterOption = {
  id: QuickFilterKey;
  label: string;
  icon: LucideIcon;
  rentOnly?: boolean;
};

export const QUICK_FILTERS: QuickFilterOption[] = [
  { id: "all", label: "All", icon: Globe2 },
  { id: "nsfas-approved", label: "NSFAS", icon: ShieldCheck, rentOnly: true },
  { id: "furnished", label: "Furnished", icon: Sofa },
  { id: "favourites", label: "Saved", icon: Heart },
  { id: "recently-listed", label: "New", icon: Sparkles },
  { id: "recently-viewed", label: "Viewed", icon: Eye },
];

export type QuickFilterNavigation = {
  setScrollElement: (element: HTMLUListElement | null) => void;
  onScroll: (event: React.UIEvent<HTMLUListElement>) => void;
  onWheel: (event: React.WheelEvent<HTMLUListElement>) => void;
  scrollByPage: (direction: "previous" | "next") => void;
  atStart: boolean;
  atEnd: boolean;
  canScroll: boolean;
};

function scrollQuickFilterTrack(element: HTMLElement | null, direction: "previous" | "next") {
  if (!element) return;
  element.scrollBy({
    left: direction === "next" ? element.clientWidth * 0.85 : -element.clientWidth * 0.85,
    behavior: "smooth",
  });
}

/**
 * QuickFilterStrip is a horizontally scrollable set of discovery shortcuts.
 * It keeps one selection active while leaving the editorial sections below intact.
 */
export function QuickFilterStrip({
  activeFilter,
  onFilterChange,
  listingMode,
  navigation,
  showNavigationControls = false,
  className,
}: {
  activeFilter: QuickFilterKey;
  onFilterChange: (filter: QuickFilterKey) => void;
  listingMode: "rent" | "buy";
  navigation?: QuickFilterNavigation;
  showNavigationControls?: boolean;
  className?: string;
}) {
  const filters = QUICK_FILTERS.filter((filter) => listingMode === "rent" || !filter.rentOnly);
  const localNavigation = useHorizontalScrollAffordance<HTMLUListElement>();
  const {
    setScrollElement,
    onScroll,
    onWheel,
    atStart,
    atEnd,
    canScroll,
    scrollByPage,
  } = navigation ?? localNavigation;
  const selectFilter = (filter: QuickFilterKey) => {
    if (filter === activeFilter && filter !== "all") return;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10);
    onFilterChange(filter);
  };

  return (
    <div className={cn("relative flex items-center gap-1", className)}>
      {showNavigationControls ? (
        <button
          type="button"
          aria-label="Scroll quick filters left"
          disabled={!canScroll || atStart}
          onClick={() => scrollByPage("previous")}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border/70 bg-panel text-ink shadow-[var(--elevation-2)] transition-[background-color,color,transform,opacity] duration-[220ms] ease-[var(--ease-out-expo)] hover:bg-surface-floating hover:text-forest active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-colors"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
      ) : null}
      <ul
        ref={setScrollElement}
        aria-label="Quick filters"
        data-slot="quick-filter-track"
        data-at-start={atStart}
        data-at-end={atEnd}
        tabIndex={0}
        onScroll={onScroll}
        onWheel={onWheel}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          scrollQuickFilterTrack(event.currentTarget, event.key === "ArrowRight" ? "next" : "previous");
        }}
        className={cn(
          "scroll-contained scroll-snap-row flex touch-pan-x gap-2 overflow-x-auto py-1 scrollbar-hide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          showNavigationControls ? "min-w-0 flex-1 px-1" : "w-full px-4",
        )}
      >
        {filters.map((filter) => {
          const Icon = filter.icon;
          const active = filter.id === activeFilter;
          return (
            <li key={filter.id} className="shrink-0 snap-start">
              <button
                type="button"
                aria-pressed={active}
                onClick={() => selectFilter(filter.id)}
                className={cn(
                  "group inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-[transform,background-color,border-color,color] duration-[220ms] ease-[var(--ease-out-expo)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-colors",
                  active
                    ? "border-forest bg-forest text-primary-foreground"
                    : "border-border/70 bg-panel text-ink hover:border-border hover:bg-surface-floating active:scale-[0.98]",
                )}
              >
                <Icon className={cn("size-4 shrink-0", active ? "text-primary-foreground" : "text-muted-foreground")} strokeWidth={1.8} aria-hidden="true" />
                <span>{filter.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {showNavigationControls ? (
        <button
          type="button"
          aria-label="Scroll quick filters right"
          disabled={!canScroll || atEnd}
          onClick={() => scrollByPage("next")}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border/70 bg-panel text-ink shadow-[var(--elevation-2)] transition-[background-color,color,transform,opacity] duration-[220ms] ease-[var(--ease-out-expo)] hover:bg-surface-floating hover:text-forest active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-colors"
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
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
    <span className="inline-flex w-fit items-center rounded-full bg-forest px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary-foreground shadow-[var(--shadow-control)]">
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
          <div className="rounded-[var(--radius-card)_var(--radius-cut)_var(--radius-card)_var(--radius-card)] border border-border bg-panel px-5 py-6 shadow-[var(--shadow-card)]">
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
        "relative block w-full overflow-hidden rounded-[var(--radius-card)_var(--radius-cut)_var(--radius-card)_var(--radius-card)] border border-border text-left shadow-[var(--shadow-card)]",
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

/**
 * Shared discovery feed used by both desktop and mobile. Keep the section
 * order identical across breakpoints so responsive layout changes do not hide
 * or rename the discovery content.
 */
export function DiscoveryExploreSections({
  activeQuickFilter,
  onQuickFilterChange,
  listingMode,
  className,
  blogs = [],
  showQuickFilters = true,
  showBlogs = true,
  quickFilterNavigation,
  showQuickFilterControls = false,
}: {
  activeQuickFilter: QuickFilterKey;
  onQuickFilterChange: (filter: QuickFilterKey) => void;
  listingMode: "rent" | "buy";
  className?: string;
  blogs?: RentalBlog[];
  showQuickFilters?: boolean;
  showBlogs?: boolean;
  quickFilterNavigation?: QuickFilterNavigation;
  showQuickFilterControls?: boolean;
}) {
  const lifestyleHeadingId = useId();

  return (
    <div className={cn("flex flex-col gap-6", className)} data-slot="discovery-explore-sections">
      {showQuickFilters ? (
        <section aria-labelledby={lifestyleHeadingId} className="flex flex-col">
          <h2 id={lifestyleHeadingId} className="sr-only">Quick filters</h2>
          <QuickFilterStrip
            activeFilter={activeQuickFilter}
            onFilterChange={onQuickFilterChange}
            listingMode={listingMode}
            navigation={quickFilterNavigation}
            showNavigationControls={showQuickFilterControls}
          />
        </section>
      ) : null}
      {showBlogs ? <RentalBlogsSection blogs={blogs} /> : null}
    </div>
  );
}
