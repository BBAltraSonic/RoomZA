import { Skeleton, SkeletonList, SkeletonStatus, SkeletonText } from "@/components/ui/skeleton";
import { LoadingHandoff } from "@/lib/motion/provider";

/** Renders inside the entry workspace layout: header and the divided entry list. */
export default function EntryWorkspaceLoading() {
  return (
    <LoadingHandoff>
      <SkeletonStatus label="Loading your entries" className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-80 max-w-full" />
          <SkeletonText lines={2} className="max-w-prose" />
        </div>
        <SkeletonList rows={3} metaLines={1} />
      </SkeletonStatus>
    </LoadingHandoff>
  );
}
