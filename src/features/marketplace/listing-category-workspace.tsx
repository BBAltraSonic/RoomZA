import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CategoryLinks } from "./category-links";
import { MY_LISTINGS_HREF } from "./my-listings";

/** The first step of creating a listing: choose what kind. Managing listings lives on My listings. */
export function ListingCategoryWorkspace() {
  return <main className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
    <header className="mb-8 max-w-lg">
      <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">What would you like to list?</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">Choose a category to get started. Your account works across all of Pinpoint.</p>
    </header>
    <CategoryLinks />
    <Link href={MY_LISTINGS_HREF} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full text-sm font-semibold text-brand-ink"><ArrowLeft className="size-4" aria-hidden="true" />My listings</Link>
  </main>;
}
