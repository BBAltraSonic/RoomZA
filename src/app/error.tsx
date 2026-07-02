"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/ui/route-state";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("RoomZA app route render failed", {
      name: error.name,
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-3xl items-center">
        <ErrorState
          title="RoomZA could not load"
          message="Retry the view. Your previous data is kept where the page can preserve it."
          onRetry={reset}
        />
      </div>
    </main>
  );
}
