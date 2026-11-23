import { Skeleton, SkeletonCard, SkeletonHeader, SkeletonStatus, SkeletonText } from "@/components/ui/skeleton";
import { LoadingHandoff } from "@/lib/motion/provider";

/** Fallback for routes without their own loader: the AppShell page frame with a card grid. */
export default function AppLoading() {
  return (
    <LoadingHandoff>
      <main className="min-h-dvh bg-background px-5 pb-[calc(var(--app-mobile-nav-offset)+2rem)] pt-4 text-foreground sm:px-6 sm:pt-6 lg:px-8">
        <SkeletonStatus label="Loading page" className="mx-auto w-full max-w-6xl pt-2 md:pt-20">
          <SkeletonHeader descriptionLines={2} action />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <SkeletonCard key={index} className="p-0">
                <Skeleton className="aspect-[16/10] w-full rounded-none rounded-t-xl" />
                <div className="p-5">
                  <Skeleton className="h-5 w-3/4" />
                  <SkeletonText lines={2} className="mt-3" />
                </div>
              </SkeletonCard>
            ))}
          </div>
        </SkeletonStatus>
      </main>
    </LoadingHandoff>
  );
}
