import { Skeleton, SkeletonList, SkeletonStatus, SkeletonText } from "@/components/ui/skeleton";
import { LoadingHandoff } from "@/lib/motion/provider";

export default function OfferReviewLoading() {
  return (
    <LoadingHandoff>
      <SkeletonStatus label="Loading submitted offers" className="max-w-3xl space-y-6">
        <div>
          <Skeleton className="h-8 w-72 max-w-full" />
          <SkeletonText lines={2} className="mt-2" />
        </div>
        <div className="flex min-h-11 items-center">
          <Skeleton className="h-4 w-48" />
        </div>
        <SkeletonList rows={5} metaLines={1} />
      </SkeletonStatus>
    </LoadingHandoff>
  );
}
