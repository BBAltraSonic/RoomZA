import { Skeleton, SkeletonCard, SkeletonStatus } from "@/components/ui/skeleton";
import { LoadingHandoff } from "@/lib/motion/provider";

/** Renders inside SettingsShell's content column: a settings section of labelled rows and controls. */
export default function SettingsLoading() {
  return (
    <LoadingHandoff>
      <SkeletonStatus label="Loading settings" className="space-y-6">
        <div>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        </div>
        <SkeletonCard className="divide-y divide-border p-0">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className={index % 2 ? "h-4 w-32" : "h-4 w-44"} />
                <Skeleton className="h-3.5 w-2/3" />
              </div>
              <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
            </div>
          ))}
        </SkeletonCard>
      </SkeletonStatus>
    </LoadingHandoff>
  );
}
