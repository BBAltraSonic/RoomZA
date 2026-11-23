import { Skeleton, SkeletonList, SkeletonStatus, SkeletonText } from "@/components/ui/skeleton";
import { LoadingHandoff } from "@/lib/motion/provider";

/** Renders inside the offer workspace layout: header, poster controls and the offer list. */
export default function OfferWorkspaceLoading() {
  return (
    <LoadingHandoff>
      <SkeletonStatus label="Loading your offers" className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-72 max-w-full" />
          <SkeletonText lines={2} className="max-w-prose" />
        </div>
        <Skeleton className="h-11 w-44 rounded-lg" />
        <div className="space-y-3">
          <Skeleton className="h-6 w-28" />
          <SkeletonList rows={4} metaLines={1} />
        </div>
      </SkeletonStatus>
    </LoadingHandoff>
  );
}
