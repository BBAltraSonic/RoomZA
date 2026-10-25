import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { CategoryLinks } from "./category-links";

/** Shared presentation; route owners retain their existing authorization. */
export function ListingCategoryWorkspace({ intent }: { intent: "create" | "manage" }) {
  const create = intent === "create";
  return <main className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-brand-ink">Your Pinpoint workspace</p>
    <header className="mb-8 flex flex-wrap items-start justify-between gap-5">
      <div className="max-w-lg">
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{create ? "What would you like to list?" : "My listings"}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{create
          ? "Choose a category to get started. Your account works across all of Pinpoint."
          : "Open a category to manage your drafts, submissions, and published listings."}</p>
      </div>
      {!create ? <Link href="/post" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-85"><Plus className="size-4" aria-hidden="true" />Create listing</Link> : null}
    </header>
    <CategoryLinks intent={intent} />
    {create ? <Link href="/post/listings" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full text-sm font-semibold text-brand-ink"><ArrowLeft className="size-4" aria-hidden="true" />My listings</Link> : null}
  </main>;
}
