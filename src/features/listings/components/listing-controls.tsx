"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Copy, Loader2, Pencil, RotateCcw, Trash2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { archiveListing, deleteListing, duplicateListing, restoreListing } from "@/features/listings/actions";
import type { Database } from "@/lib/supabase/types";

type ListingStatus = Database["public"]["Enums"]["listing_status"];

export function ListingControls({ listingId, status, applicantCount }: { listingId: string; status: ListingStatus; applicantCount: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ success: true; data: unknown } | { success: false; error: string }>, onSuccess?: (data: unknown) => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? "Action failed.");
        return;
      }
      onSuccess?.(result.data);
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
        {status === "archived" ? (
          <Button variant="outline" className="h-9" disabled={pending} onClick={() => run(() => restoreListing(listingId))}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
            Restore
          </Button>
        ) : (
          <Button variant="outline" className="h-9" disabled={pending} onClick={() => run(() => archiveListing(listingId))}>
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
              (data) => {
                const duplicated = data as { listingId?: string };
                if (duplicated.listingId) router.push(`/dashboard/listings/${duplicated.listingId}/edit`);
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
              <Button variant="destructive" disabled={pending} onClick={() => run(() => deleteListing(listingId))}>
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
