import { Users } from "lucide-react";

import { AppShell, BackLink, PageHeader } from "@/components/premium/primitives";

export default function ListingApplicantsLoading() {
  return (
    <AppShell width="xl" className="pt-2 md:pt-20">
      <BackLink href="/dashboard">Dashboard</BackLink>
      <PageHeader
        eyebrow="Applicant queue"
        title="Loading applicants"
        description="Fetching the applicants associated with this listing."
        action={
          <div className="flex items-center gap-2 rounded-lg border border-border bg-panel px-4 py-2 text-sm font-medium shadow-[var(--elevation-1)]">
            <Users className="size-4 text-forest" />
            Loading
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2" aria-busy="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-border bg-panel p-5 shadow-[var(--elevation-1)]">
            <div className="h-5 w-40 rounded bg-warm-surface" />
            <div className="mt-3 h-4 w-28 rounded bg-warm-surface" />
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((__, itemIndex) => (
                <div key={itemIndex} className="rounded-md bg-warm-surface p-3">
                  <div className="h-3 w-14 rounded bg-muted" />
                  <div className="mt-2 h-4 w-20 rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
