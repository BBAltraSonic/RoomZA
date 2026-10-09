"use client";

import { Button } from "@/components/ui/button";

export default function OfferWorkspaceError({ reset }: { reset: () => void }) {
  return <div role="alert" className="space-y-4"><h1 className="text-2xl font-semibold">Could not load your offers</h1><p className="text-sm text-muted-foreground">Your drafts have not been changed. Try loading this workspace again.</p><Button className="min-h-11" onClick={reset}>Try again</Button></div>;
}
