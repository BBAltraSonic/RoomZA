import { cn } from "@/lib/utils";
import { Skeleton, SkeletonStatus } from "@/components/ui/skeleton";
import { LoadingHandoff } from "@/lib/motion/provider";

const bubbles = [
  { mine: false, width: "w-2/3" },
  { mine: true, width: "w-1/2" },
  { mine: false, width: "w-3/5" },
  { mine: true, width: "w-2/5" },
  { mine: false, width: "w-1/2" },
];

/** A full-height thread: chat header, alternating message bubbles and the composer. */
export default function ConversationLoading() {
  return (
    <LoadingHandoff>
      <SkeletonStatus label="Loading conversation" className="flex h-dvh flex-col bg-background">
        <div
          className="flex items-center gap-3 border-b border-border bg-panel px-4 pb-3"
          style={{ paddingTop: "max(env(safe-area-inset-top), 0.75rem)" }}
        >
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-52 max-w-full" />
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-end gap-3 overflow-hidden p-4">
          {bubbles.map(({ mine, width }, index) => (
            <Skeleton key={index} className={cn("h-12 max-w-md rounded-2xl", width, mine && "self-end")} />
          ))}
        </div>
        <div className="border-t border-border bg-panel p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Skeleton className="mx-auto h-11 w-full max-w-3xl rounded-full" />
        </div>
      </SkeletonStatus>
    </LoadingHandoff>
  );
}
