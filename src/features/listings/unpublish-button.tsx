"use client";

import { useState } from "react";
import { EyeOff } from "lucide-react";
import { unpublishListing } from "@/features/listings/actions";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { PendingGlyph } from "@/lib/motion/primitives";
import { toast } from "sonner";

export function UnpublishButton({ listingId, expectedUpdatedAt }: { listingId: string; expectedUpdatedAt: string }) {
    const [isPending, setIsPending] = useState(false);
    const router = useRouter();

    async function handleUnpublish() {
        if (!confirm("Are you sure you want to unpublish this listing? It will be reverted to draft.")) {
            return;
        }

        setIsPending(true);
        const result = await unpublishListing(listingId, expectedUpdatedAt);
        setIsPending(false);

        if (result.success) {
            router.refresh();
        } else {
            toast.error(result.error);
        }
    }

    return (
        <Button
            variant="secondary"
            className="rounded-full border border-status-warning-border bg-status-warning-surface px-3 text-status-warning-text transition-colors hover:opacity-90"
            title="Unpublish Listing"
            onClick={handleUnpublish}
            disabled={isPending}
        >
            {isPending ? (
                <PendingGlyph label="Unpublishing listing" />
            ) : (
                <EyeOff className="size-3.5" />
            )}
        </Button>
    );
}
