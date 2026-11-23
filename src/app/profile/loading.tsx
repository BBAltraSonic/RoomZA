import { Skeleton, SkeletonCard, SkeletonHeader, SkeletonStatus, SkeletonText } from "@/components/ui/skeleton";
import { LoadingHandoff } from "@/lib/motion/provider";

/** Renders inside ProfileShell's content column; the section nav stays interactive. */
export default function ProfileLoading() {
  return (
    <LoadingHandoff>
      <SkeletonStatus label="Loading profile" className="space-y-8">
        <SkeletonHeader descriptionLines={1} action className="mb-0 sm:mb-0" />
        <section className="border-y border-border py-6 sm:rounded-2xl sm:border sm:bg-panel sm:p-6 sm:shadow-[var(--elevation-1)]">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <Skeleton className="size-20 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </section>
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }, (_, index) => (
            <SkeletonCard key={index}>
              <Skeleton className="h-5 w-40" />
              <SkeletonText lines={3} className="mt-4" />
            </SkeletonCard>
          ))}
        </div>
      </SkeletonStatus>
    </LoadingHandoff>
  );
}
