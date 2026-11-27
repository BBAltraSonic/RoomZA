"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { buildListingShareUrl, shareListing } from "@/features/map-discovery/lib/listing-share";

/** Native share, then clipboard, then a manual-copy fallback, with a status line for screen readers. */
export function useListingShare(listing: { id: string; title: string; address: string }) {
  const [isSharing, setIsSharing] = useState(false);
  const [manualCopyUrl, setManualCopyUrl] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState("");
  const pendingRef = useRef(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  const closeManualCopy = useCallback(() => {
    setManualCopyUrl(null);
    triggerRef.current?.focus();
  }, []);

  const handleShare = useCallback(async (trigger: HTMLElement | null) => {
    if (pendingRef.current) return;

    pendingRef.current = true;
    triggerRef.current = trigger;
    setIsSharing(true);
    setManualCopyUrl(null);
    setShareStatus("Sharing listing");

    const url = buildListingShareUrl(window.location.origin, listing.id);
    try {
      const outcome = await shareListing({ title: listing.title, text: listing.address, url });

      if (outcome === "shared") {
        setShareStatus("Property shared");
        toast.success("Property shared");
      } else if (outcome === "copied") {
        setShareStatus("Listing link copied");
        toast.success("Link copied");
      } else if (outcome === "cancelled") {
        setShareStatus("Sharing cancelled");
      } else {
        setManualCopyUrl(url);
        setShareStatus("Automatic copying is unavailable. Copy the selected listing link manually.");
      }
    } catch {
      setManualCopyUrl(url);
      setShareStatus("Automatic copying is unavailable. Copy the selected listing link manually.");
      toast.error("Could not share this property");
    } finally {
      pendingRef.current = false;
      setIsSharing(false);
    }
  }, [listing.address, listing.id, listing.title]);

  return { handleShare, isSharing, manualCopyUrl, closeManualCopy, shareStatus };
}
