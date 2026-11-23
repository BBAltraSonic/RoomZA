import { Skeleton, SkeletonList, SkeletonStatus, SkeletonText } from "@/components/ui/skeleton";
import { LoadingHandoff } from "@/lib/motion/provider";

export default function ServicesWorkspaceLoading() {
  return (
    <LoadingHandoff>
      <main className="mx-auto w-full max-w-3xl px-5 py-10 pb-28">
        <SkeletonStatus label="Loading your services" className="space-y-6">
          <div>
            <Skeleton className="h-9 w-56" />
            <SkeletonText lines={2} className="mt-3" />
          </div>
          <Skeleton className="h-11 w-40 rounded-lg" />
          <SkeletonList rows={4} metaLines={1} className="border-y-0" />
          <Skeleton className="h-4 w-32" />
        </SkeletonStatus>
      </main>
    </LoadingHandoff>
  );
}
