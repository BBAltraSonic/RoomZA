"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ReportPanel } from "@/features/admin/components/report-panel";

export function ReportListingDialog({ listingId, open, onOpenChange }: { listingId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="pr-8 text-base font-semibold text-ink">Report this listing</DialogTitle>
        <ReportPanel listingId={listingId} bare />
      </DialogContent>
    </Dialog>
  );
}
