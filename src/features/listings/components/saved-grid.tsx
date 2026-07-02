"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { PropertyCard, SaveIconButton, type PropertyCardData } from "@/components/premium/property-card";
import { createClient } from "@/lib/supabase/browser";
import { FavoriteMutationTimeoutError, withFavoriteMutationTimeout } from "../favorites";

type SavedItem = {
  listingId: string;
  href: string;
  property: PropertyCardData;
};

export function SavedGrid({ items }: { items: SavedItem[] }) {
  const [list, setList] = useState<SavedItem[]>(items);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const supabase = useMemo(() => createClient(), []);

  function handleRemove(listingId: string) {
    if (pendingIds.has(listingId)) return;
    setPendingIds((prev) => new Set(prev).add(listingId));

    const previous = list;
    setList((prev) => prev.filter((item) => item.listingId !== listingId));

    startTransition(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setList(previous);
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(listingId);
          return next;
        });
        toast.error("Please sign in to manage saved homes.");
        return;
      }

      let error: unknown = null;
      try {
        const result = await withFavoriteMutationTimeout(
          supabase.from("user_favorites").delete().eq("listing_id", listingId).eq("user_id", user.id),
        );
        error = result.error;
      } catch (mutationError) {
        if (!(mutationError instanceof FavoriteMutationTimeoutError)) {
          throw mutationError;
        }
        error = mutationError;
      }

      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(listingId);
        return next;
      });

      if (error) {
        setList(previous);
        toast.error(
          error instanceof FavoriteMutationTimeoutError
            ? "Saved state could not be confirmed within 2 seconds."
            : "Couldn't remove this home. Try again.",
        );
      } else {
        toast.success("Removed from saved homes");
      }
    });
  }

  if (list.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-warm-surface px-4 py-10 text-center text-sm font-medium text-muted-foreground">
        You&apos;ve removed all your saved homes. Explore the map to start a new shortlist.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((item) => (
        <PropertyCard
          key={item.listingId}
          href={item.href}
          property={item.property}
          action={<SaveIconButton saved onClick={() => handleRemove(item.listingId)} />}
        />
      ))}
    </div>
  );
}
