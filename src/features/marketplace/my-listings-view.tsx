import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Plus } from "lucide-react";

import { AppShell, EmptyState, PageHeader } from "@/components/premium/primitives";
import { cn } from "@/lib/utils";

import { listingCategoryMeta, type ListingCategory, type MyListings } from "./my-listings";

const primaryButton = "inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Every listing a person manages, on one page. Create listing is the only button;
 * a category filter appears only when there is more than one category to filter.
 */
export function MyListingsView({ view, sections, importAllowed, assistant }: {
  view: MyListings;
  /** Rendered content per category (property cards, or a `ManagedItemList`). */
  sections: Partial<Record<ListingCategory, ReactNode>>;
  importAllowed: boolean;
  /** The business assistant button, shown beside Create listing. */
  assistant?: ReactNode;
}) {
  const createLabel = view.active ? `Create ${listingCategoryMeta[view.active].label.toLowerCase()} listing` : "Create listing";
  return <AppShell width="xl" className="pt-2 md:pt-8">
    <PageHeader
      title="My listings"
      description={importAllowed
        ? <Link href="/dashboard/imports/new" className="inline-flex min-h-11 items-center font-semibold text-brand-ink underline-offset-4 hover:underline">Import listings</Link>
        : "Drafts, submissions and published listings across Pinpoint."}
      action={view.isEmpty && !assistant ? null : <div className="flex flex-wrap items-center gap-2">
        {assistant}
        {view.isEmpty ? null : <Link href={view.createHref} className={primaryButton}><Plus className="size-4" aria-hidden="true" />{createLabel}</Link>}
      </div>}
    />

    {view.filters.length ? <nav aria-label="Filter listings" className="-mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide">
      {view.filters.map(filter => <Link key={filter.href} href={filter.href} aria-current={filter.active ? "page" : undefined}
        className={cn("inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          filter.active ? "border-transparent bg-selection text-selection-foreground" : "border-border bg-panel text-ink hover:bg-muted")}>
        {filter.label}<span className={cn("text-xs", filter.active ? "opacity-80" : "text-muted-foreground")}>{filter.count}</span>
      </Link>)}
    </nav> : null}

    {view.isEmpty ? <EmptyState icon={Building2} title="Nothing listed yet"
      description="Homes, services, shopping specials, places and events you list will all appear here."
      action={<Link href="/post" className={primaryButton}><Plus className="size-4" aria-hidden="true" />Create your first listing</Link>} />
      : <div className="space-y-10">
        {view.sections.map(category => <section key={category} aria-labelledby={`my-listings-${category}`}>
          {/* With one category on screen the page title already names it. */}
          <h2 id={`my-listings-${category}`} className={cn("mb-4 text-lg font-semibold text-ink", view.sections.length === 1 && "sr-only")}>
            {listingCategoryMeta[category].label}
          </h2>
          {view.errors[category] ? <p role="alert" className="rounded-xl border border-status-error-border bg-status-error-surface p-4 text-sm text-status-error-text">{view.errors[category]}</p> : sections[category]}
        </section>)}
      </div>}
  </AppShell>;
}

export type ManagedItem = { id: string; title: string; status: string; href: string };

/** Compact rows for Services, Shopping Specials, Places and Events. */
export function ManagedItemList({ items, hasMore, moreHref, emptyText = "Nothing here yet." }: {
  items: ManagedItem[]; hasMore: boolean; moreHref: string; emptyText?: string;
}) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  return <div>
    <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-panel)] border border-border bg-panel shadow-[var(--elevation-1)]">
      {items.map(item => <li key={item.id}>
        <Link href={item.href} className="flex min-h-16 items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-ink">{item.title}</span>
            <span className="mt-0.5 block text-sm text-muted-foreground">{item.status}</span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link>
      </li>)}
    </ul>
    {hasMore ? <Link href={moreHref} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-ink underline-offset-4 hover:underline">See all</Link> : null}
  </div>;
}
