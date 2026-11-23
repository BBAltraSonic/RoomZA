import { AppShell, BackLink } from "@/components/premium/primitives";
import { Skeleton, SkeletonHeader, SkeletonStatus } from "@/components/ui/skeleton";
import { LoadingHandoff } from "@/lib/motion/provider";

export default function ListingApplicantsLoading() {
  return (
    <LoadingHandoff>
      <AppShell width="xl" className="pt-2 md:pt-20">
        <BackLink href="/dashboard">Dashboard</BackLink>
        <SkeletonStatus label="Loading applicants">
          <SkeletonHeader descriptionLines={1} />
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="rounded-lg border border-border bg-panel p-5 shadow-[var(--elevation-1)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="mt-3 h-4 w-28" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {Array.from({ length: 4 }, (__, itemIndex) => (
                    <div key={itemIndex} className="rounded-md border border-border p-3">
                      <Skeleton className="h-3 w-14" />
                      <Skeleton className="mt-2 h-4 w-20 max-w-full" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SkeletonStatus>
      </AppShell>
    </LoadingHandoff>
  );
}
