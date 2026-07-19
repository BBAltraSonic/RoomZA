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

export default async function SavedPropertiesPage() {
  const result = await getSavedListingCards();

  if (!result.authenticated) {
    redirect(authPathForRedirect("/saved"));
  }

  return (
    <main
      className="min-h-dvh bg-background px-4 pb-[calc(var(--mobile-bottom-nav-h)+var(--mobile-safe-bottom)+1rem)] text-foreground sm:px-6 sm:pb-28 sm:pt-20 lg:px-8"
      style={{ paddingTop: "max(env(safe-area-inset-top), 1.25rem)" }}
    >
      <div className="mx-auto max-w-6xl">
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
