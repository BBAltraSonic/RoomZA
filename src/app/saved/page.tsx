import { readSavedSpecials } from "@/features/discovery/saved-specials-api";
import { SavedSpecialsGrid } from "@/features/discovery/saved-specials-grid";
import { Heart, Search } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState, PageHeader } from "@/components/premium/primitives";
import { SavedGrid } from "@/features/listings/components/saved-grid";
import { getSavedListingCards } from "@/features/listings/saved-listings";
import { authPathForRedirect } from "@/lib/redirects";

export const metadata = {
  title: "Saved Properties",
};

export default async function SavedPropertiesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const specials = (await searchParams).tab === "specials";
  if (specials) {
    const saved = await readSavedSpecials();
    if (!saved.authenticated) redirect(authPathForRedirect("/saved?tab=specials"));
    return <main className="min-h-dvh bg-background px-4 py-20 text-foreground"><div className="mx-auto max-w-6xl space-y-6"><nav aria-label="Saved collection" className="flex gap-3"><Link href="/saved" className="inline-flex min-h-11 items-center rounded-full border px-4">Saved homes</Link><Link href="/saved?tab=specials" aria-current="page" className="inline-flex min-h-11 items-center rounded-full bg-forest px-4 text-primary-foreground">Saved Specials</Link></nav><PageHeader title="Saved Specials" description="Your Shopping, Places, and Event shortlist." />{saved.items.length ? <SavedSpecialsGrid items={saved.items} serverNow={saved.serverNow} /> : <p>No saved Specials yet. <Link href="/offers" className="text-forest underline">Explore Specials</Link></p>}</div></main>;
  }
  const result = await getSavedListingCards();

  if (!result.authenticated) {
    redirect(authPathForRedirect("/saved"));
  }

  return (
    <main
      className="min-h-dvh bg-background px-4 pb-[calc(var(--app-mobile-nav-offset)+2rem)] text-foreground sm:px-6 sm:pt-6 lg:px-8"
      style={{ paddingTop: "max(env(safe-area-inset-top), 1.25rem)" }}
    >
      <div className="mx-auto max-w-6xl">
        <nav aria-label="Saved collection" className="mb-6 flex gap-3"><Link href="/saved" aria-current="page" className="inline-flex min-h-11 items-center rounded-full bg-forest px-4 text-primary-foreground">Saved homes</Link><Link href="/saved?tab=specials" className="inline-flex min-h-11 items-center rounded-full border px-4">Saved Specials</Link></nav>
        <PageHeader
          eyebrow="Renter workspace"
          title="Saved homes"
          description="Homes you marked for comparison before applying."
        />

        {"error" in result ? (
          <div className="rounded-lg border border-status-error-border bg-status-error-surface p-4 text-sm font-medium text-status-error-text">
            Unable to load saved homes.
          </div>
        ) : result.items.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="Save your first home"
            description="Open a home on the map and tap Save. Your shortlist stays here for easy comparison."
            action={
              <Link
                href="/"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-forest px-4 text-sm font-medium text-primary-foreground hover:bg-forest/90"
              >
                <Search className="size-4" />
                Explore homes
              </Link>
            }
          />
        ) : (
          <SavedGrid items={result.items} />
        )}
      </div>
    </main>
  );
}
