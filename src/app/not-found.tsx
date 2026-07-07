import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/route-state";

export default function NotFound() {
  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-3xl items-center">
        <EmptyState
          title="Page not found"
          description="This Pinpoints page is not available."
          action={
            <Button render={<Link href="/" />} className="h-11 bg-forest text-primary-foreground hover:bg-forest/90">
              Back to map
            </Button>
          }
        />
      </div>
    </main>
  );
}
