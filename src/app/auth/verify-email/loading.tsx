import { MailCheck } from "lucide-react";

import { Skeleton, SkeletonStatus, SkeletonText } from "@/components/ui/skeleton";
import { LoadingHandoff } from "@/lib/motion/provider";

export default function VerifyEmailLoading() {
  return (
    <LoadingHandoff>
      <main className="min-h-dvh bg-background px-4 py-8 text-foreground">
        <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col justify-center">
          <SkeletonStatus
            label="Loading email verification"
            className="rounded-lg border border-border bg-panel p-5 shadow-[var(--elevation-2)]"
          >
            <div className="mb-5 flex size-10 items-center justify-center rounded-md bg-forest text-primary-foreground">
              <MailCheck className="size-5" aria-hidden="true" />
            </div>
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-3 h-8 w-48" />
            <SkeletonText lines={2} className="mt-4" />
            <Skeleton className="mt-6 h-11 w-full rounded-lg" />
          </SkeletonStatus>
        </div>
      </main>
    </LoadingHandoff>
  );
}
