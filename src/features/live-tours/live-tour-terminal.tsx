import { VideoOff } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function LiveTourTerminal({ status, listingId }: { status: "ended" | "cancelled"; listingId: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-panel p-7 text-center shadow-[var(--elevation-2)]">
        <VideoOff className="mx-auto size-9 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold text-ink">
          {status === "cancelled" ? "This open house was cancelled" : "This live tour has ended"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Return to the listing to message the landlord or arrange a viewing.
        </p>
        <Button render={<Link href={`/?listingId=${listingId}`} />} className="mt-6 min-h-11 bg-forest text-primary-foreground hover:bg-forest/90 sm:min-h-10">
          Back to listing
        </Button>
      </section>
    </main>
  );
}
