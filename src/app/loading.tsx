import { SkeletonStatus } from "@/components/ui/skeleton";
import { LoadingHandoff } from "@/lib/motion/provider";

/**
 * Shows before every section whose layout awaits auth (profile, settings, post,
 * dashboard, admin) and before the map, each of which then shows its own
 * skeleton. So this one stays a plain page frame: a card grid here would flash
 * one shape and swap to another. Routes without a loader of their own show
 * this frame until they render.
 */
export default function AppLoading() {
  return (
    <LoadingHandoff>
      <SkeletonStatus label="Loading page" className="min-h-dvh bg-background">
        {null}
      </SkeletonStatus>
    </LoadingHandoff>
  );
}
