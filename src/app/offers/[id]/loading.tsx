import { Skeleton, SkeletonStatus, SkeletonText } from "@/components/ui/skeleton";
import { LoadingHandoff } from "@/lib/motion/provider";

/** Mirrors PublicOfferDetailScreen: return link, then the detail header, media, terms and actions. */
export default function OfferLoading() {
  return (
    <LoadingHandoff>
      <main className="mx-auto max-w-3xl px-5 py-8">
        <SkeletonStatus label="Loading Shopping Offer">
          <div className="flex min-h-11 items-center">
            <Skeleton className="h-4 w-36" />
          </div>
          <div className="space-y-5 bg-panel p-5">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="aspect-[4/3] w-full rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <SkeletonText lines={3} />
            </div>
            <div className="space-y-3 border-y border-border py-4">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
              <div className="grid gap-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-44" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-11 flex-1 rounded-full" />
              <Skeleton className="h-11 flex-1 rounded-full" />
            </div>
          </div>
        </SkeletonStatus>
      </main>
    </LoadingHandoff>
  );
}
