import { Skeleton, SkeletonStatus } from "@/components/ui/skeleton";
import { LoadingHandoff } from "@/lib/motion/provider";

/** Mirrors the inbox frame: header band, then conversation rows with a listing thumbnail. */
export default function MessagesLoading() {
  return (
    <LoadingHandoff>
      <div className="relative h-[calc(100dvh_-_var(--workspace-header-h,64px)_-_var(--app-mobile-nav-offset))] min-h-80 w-full overflow-hidden bg-background">
        <section className="absolute inset-0 z-40 flex w-full flex-col overflow-hidden bg-panel">
          <SkeletonStatus label="Loading conversations" className="mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden sm:px-6">
            <div
              className="flex items-end justify-between gap-4 border-b border-border px-5 pb-4 pt-4 sm:px-0 sm:pb-6 sm:pt-10"
              style={{ paddingTop: "max(env(safe-area-inset-top), 1.25rem)" }}
            >
              <div className="w-full max-w-md">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="mt-2 h-8 w-40" />
                <Skeleton className="mt-2 h-4 w-full" />
              </div>
              <Skeleton className="hidden h-10 w-32 shrink-0 rounded-full sm:block" />
            </div>
            <ul className="flex-1 space-y-2 overflow-hidden p-4 sm:px-0 sm:pt-5">
              {Array.from({ length: 6 }, (_, index) => (
                <li key={index} className="flex items-center gap-3 rounded-2xl border border-border bg-panel p-3.5 shadow-[var(--elevation-1)]">
                  <Skeleton className="size-14 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <Skeleton className={index % 2 ? "h-4 w-28" : "h-4 w-36"} />
                      <Skeleton className="h-3 w-8" />
                    </div>
                    <Skeleton className="mt-2 h-3 w-44 max-w-full" />
                    <Skeleton className="mt-2 h-4 w-3/4" />
                  </div>
                </li>
              ))}
            </ul>
          </SkeletonStatus>
        </section>
      </div>
    </LoadingHandoff>
  );
}
