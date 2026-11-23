import { Skeleton, SkeletonHeader, SkeletonStatus } from "@/components/ui/skeleton";
import { LoadingHandoff } from "@/lib/motion/provider";

/** Renders inside the admin layout, so the sidebar stays put: AdminHeader plus a records table. */
export default function AdminLoading() {
  return (
    <LoadingHandoff>
      <SkeletonStatus label="Loading admin workspace">
        <SkeletonHeader descriptionLines={1} action className="mb-6 sm:mb-6" />
        <div className="overflow-hidden rounded-xl border border-border bg-panel shadow-[var(--elevation-1)]">
          <div className="flex gap-6 border-b border-border bg-muted/60 px-4 py-3">
            {["w-20", "w-28", "w-16", "w-24"].map((width) => (
              <Skeleton key={width} className={`h-3 ${width}`} />
            ))}
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="flex items-center gap-6 px-4 py-4">
                <Skeleton className={index % 2 ? "h-4 w-1/4" : "h-4 w-1/3"} />
                <Skeleton className="h-4 w-1/5" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="ml-auto h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </SkeletonStatus>
    </LoadingHandoff>
  );
}
