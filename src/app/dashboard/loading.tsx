import { AppShell } from "@/components/premium/primitives";
import { Skeleton, SkeletonHeader, SkeletonStatus, SkeletonText } from "@/components/ui/skeleton";
import { LoadingHandoff } from "@/lib/motion/provider";

/** Mirrors the dashboard home: header with create actions, section links and the listing card grid. */
export default function DashboardLoading() {
  return (
    <LoadingHandoff>
      <AppShell width="xl" className="pt-2 md:pt-20">
        <SkeletonStatus label="Loading your dashboard">
          <SkeletonHeader descriptionLines={1} action />
          <div className="mb-5 flex min-h-11 flex-wrap items-center gap-4">
            {["w-20", "w-28", "w-16", "w-24"].map((width) => (
              <Skeleton key={width} className={`h-4 ${width}`} />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-[var(--radius-card)_var(--radius-cut)_var(--radius-card)_var(--radius-card)] border border-border bg-panel shadow-[var(--shadow-card)]"
              >
                <Skeleton className="aspect-[16/10] w-full rounded-none" />
                <div className="p-4">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-2 h-6 w-3/4" />
                  <Skeleton className="mt-3 h-6 w-28" />
                  <div className="mt-3 flex gap-4">
                    <Skeleton className="h-4 w-10" />
                    <Skeleton className="h-4 w-10" />
                    <Skeleton className="h-4 w-10" />
                  </div>
                  <SkeletonText lines={2} className="mt-4 border-t border-border pt-4" />
                </div>
              </div>
            ))}
          </div>
        </SkeletonStatus>
      </AppShell>
    </LoadingHandoff>
  );
}
