"use client";
import { Button } from "@/components/ui/button";
export default function ServiceReviewError({ retry }: { retry: () => void }) {
  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-2xl font-semibold">Could not load service reviews</h1>
      <p role="alert" className="text-status-error-text">
        Try again to check the current submissions before making a decision.
      </p>
      <Button onClick={retry}>Try again</Button>
    </div>
  );
}
