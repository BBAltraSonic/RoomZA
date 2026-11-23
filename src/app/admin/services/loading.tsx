import { Skeleton, SkeletonStatus, SkeletonText } from "@/components/ui/skeleton";
import { LoadingHandoff } from "@/lib/motion/provider";

/** One review card per submission: media, title, provider line, description, facts and the decision controls. */
export default function ServiceReviewLoading() {
  return (
    <LoadingHandoff>
      <SkeletonStatus label="Loading service submissions" className="max-w-3xl space-y-6">
        <Skeleton className="h-8 w-64" />
        <SkeletonText lines={2} />
        {Array.from({ length: 2 }, (_, index) => (
          <section key={index} className="space-y-4 rounded-xl border border-border bg-panel p-5">
            <Skeleton className="aspect-video w-full rounded-lg" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-2/3" />
            <SkeletonText lines={3} />
            <div className="grid gap-3">
              {["w-1/2", "w-2/5", "w-1/3", "w-1/4"].map((width) => (
                <div key={width} className="space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className={`h-4 ${width}`} />
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <Skeleton className="h-11 w-28 rounded-lg" />
              <Skeleton className="h-11 w-28 rounded-lg" />
            </div>
          </section>
        ))}
      </SkeletonStatus>
    </LoadingHandoff>
  );
}
