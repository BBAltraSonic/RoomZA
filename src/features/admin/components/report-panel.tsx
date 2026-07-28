"use client";

import { useState, useTransition } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { submitModerationReport } from "../actions";
import type { ModerationCategory } from "../types";
import { cn } from "@/lib/utils";

const categoryOptions: { value: ModerationCategory; label: string }[] = [
  { value: "fraud_or_scam", label: "Fraud or scam" },
  { value: "misleading_listing", label: "Misleading information" },
  { value: "duplicate_or_spam", label: "Duplicate or spam" },
  { value: "discrimination", label: "Discrimination" },
  { value: "harassment", label: "Harassment" },
  { value: "safety", label: "Safety concern" },
  { value: "privacy", label: "Privacy concern" },
  { value: "other", label: "Other" },
];

export function ReportPanel({ listingId, reportedUserId, messageId, listingImageId, label = "Report", popover = false, compact = false, className }: { listingId?: string; reportedUserId?: string; messageId?: string; listingImageId?: string; label?: string; popover?: boolean; compact?: boolean; className?: string }) {
  const [category, setCategory] = useState<ModerationCategory>("misleading_listing");
  const [details, setDetails] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await submitModerationReport({ listingId, reportedUserId, messageId, listingImageId, category, details });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setDetails("");
      toast.success("Report submitted. The operations team will review it.");
    });
  }

  return (
    <details className={cn("group rounded-lg border border-border bg-panel", popover && "relative", compact && "w-fit border-0 bg-transparent", className)}>
      <summary className={cn("flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-semibold text-muted-foreground outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ring", compact && "min-h-7 px-1 text-[11px]")}>
        <Flag className="size-4" />{label}
      </summary>
      <div className={cn("border-t border-border p-3", popover && "absolute right-0 top-full z-[var(--z-nav-menu)] mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border bg-panel shadow-[var(--elevation-2)]")}>
        <label className="text-xs font-semibold text-muted-foreground">Reason
          <select value={category} onChange={(event) => setCategory(event.target.value as ModerationCategory)} className="mt-1 h-10 w-full rounded-md border border-input bg-panel px-3 text-sm shadow-[var(--shadow-control)] outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-ring/25">
            {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="mt-3 block text-xs font-semibold text-muted-foreground">Details
          <Textarea className="mt-1" minLength={20} maxLength={2000} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Share specific details that will help us investigate." />
        </label>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">{details.length}/2000</span>
          <Button type="button" size="sm" disabled={pending || details.trim().length < 20} onClick={submit}>Submit report</Button>
        </div>
      </div>
    </details>
  );
}
