import { Skeleton, SkeletonList, SkeletonStatus, SkeletonText } from "@/components/ui/skeleton";
import { LoadingHandoff } from "@/lib/motion/provider";

export default function ConfirmedLoading() {
  return (
    <LoadingHandoff>
      <SkeletonStatus label="Loading confirmed offers" className="max-w-3xl space-y-6">
        <div>
          <Skeleton className="h-8 w-80 max-w-full" />
          <SkeletonText lines={2} className="mt-2" />
        </div>
        <Skeleton className="h-3 w-64" />
        <SkeletonList rows={5} metaLines={2} />
        <div className="flex min-h-11 items-center gap-6">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-28" />
        </div>
      </SkeletonStatus>
    </LoadingHandoff>
  );
}
