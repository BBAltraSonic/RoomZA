"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Copy, Eye, EyeOff, Loader2, Pencil, RotateCcw, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { archiveListing, deleteListing, duplicateListing, publishListing, restoreListing, unpublishListing } from "@/features/listings/actions";
import { canPublishListing, canUnpublishListing } from "@/features/listings/listing-status";
import type { Database } from "@/lib/supabase/types";

type ListingStatus = Database["public"]["Enums"]["listing_status"];

export function ListingControls({ listingId, status, applicantCount }: { listingId: string; status: ListingStatus; applicantCount: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(
    action: () => Promise<{ success: true; data: unknown } | { success: false; error: string; details?: unknown }>,
    options?: { onSuccess?: (data: unknown) => void; successMessage?: string },
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        const details = result.details as { errors?: string[] } | undefined;
        setError(details?.errors?.[0] ?? result.error ?? "Action failed.");
        return;
      }
      if (options?.successMessage) {
        toast.success(options.successMessage);
      }
      options?.onSuccess?.(result.data);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <Button render={<Link href={`/dashboard/listings/${listingId}/applicants`} />} className="h-9 bg-forest text-primary-foreground hover:bg-forest/90">
          <Users className="size-4" />
          {applicantCount === 1 ? "1 applicant" : `${applicantCount} applicants`}
        </Button>
        <Button render={<Link href={`/dashboard/listings/${listingId}/edit`} />} variant="outline" className="h-9">
          <Pencil className="size-4" />
          Edit
        </Button>
        {canPublishListing(status) ? (
          <Button
            variant="outline"
            className="h-9"
            disabled={pending}
            onClick={() => run(() => publishListing(listingId), { successMessage: "Listing published" })}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
            Publish
          </Button>
        ) : null}
        {canUnpublishListing(status) ? (
          <Button
            variant="outline"
            className="h-9"
            disabled={pending}
            onClick={() => run(() => unpublishListing(listingId), { successMessage: "Listing unpublished" })}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <EyeOff className="size-4" />}
            Unpublish
          </Button>
        ) : null}
        {status === "archived" ? (
          <Button variant="outline" className="h-9" disabled={pending} onClick={() => run(() => restoreListing(listingId), { successMessage: "Listing restored" })}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
            Restore
          </Button>
        ) : (
          <Button variant="outline" className="h-9" disabled={pending} onClick={() => run(() => archiveListing(listingId), { successMessage: "Listing archived" })}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Archive className="size-4" />}
            Archive
          </Button>
        )}
        <Button
          variant="outline"
          className="h-9"
          disabled={pending}
          onClick={() =>
            run(
              () => duplicateListing(listingId),
              {
                successMessage: "Listing duplicated",
                onSuccess: (data) => {
                  const duplicated = data as { listingId?: string };
                  if (duplicated.listingId) router.push(`/dashboard/listings/${duplicated.listingId}/edit`);
                },
              },
            )
          }
        >
          <Copy className="size-4" />
          Duplicate
        </Button>
        <Dialog>
          <DialogTrigger render={<Button variant="destructive" className="h-9" disabled={pending} />}>
            <Trash2 className="size-4" />
            Delete
          </DialogTrigger>
          <DialogContent>
            <DialogTitle className="text-base font-semibold text-ink">Delete listing</DialogTitle>
            <p className="text-sm leading-6 text-muted-foreground">This permanently removes the listing when there are no active applications.</p>
            <div className="flex justify-end gap-2">
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <Button variant="destructive" disabled={pending} onClick={() => run(() => deleteListing(listingId), { successMessage: "Listing deleted" })}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
