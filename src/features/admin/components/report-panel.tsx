"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Flag } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { submitModerationReport } from "../actions";
import type { ModerationCategory } from "../types";
import { cn } from "@/lib/utils";
import { authPathForRedirect } from "@/lib/redirects";

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

type ReportPanelProps = { listingId?: string; shoppingOfferId?: string; reportedUserId?: string; messageId?: string; listingImageId?: string; label?: string; popover?: boolean; compact?: boolean; iconOnly?: boolean; className?: string };

export function ReportPanel(props: ReportPanelProps) {
  const targetKey = JSON.stringify([props.listingId, props.shoppingOfferId, props.reportedUserId, props.messageId, props.listingImageId]);
  return <ReportPanelForm key={targetKey} {...props} />;
}

function ReportPanelForm({ listingId, shoppingOfferId, reportedUserId, messageId, listingImageId, label = "Report", popover = false, compact = false, iconOnly = false, className }: ReportPanelProps) {
  const [category, setCategory] = useState<ModerationCategory>("misleading_listing");
  const [details, setDetails] = useState("");
  const [signInHref, setSignInHref] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  function submit() {
    if (busy.current || details.trim().length < 20) return;
    busy.current = true;
    setError(null);
    setSignInHref(null);
    startTransition(async () => {
      try {
        const result = await submitModerationReport({ listingId, shoppingOfferId, reportedUserId, messageId, listingImageId, category, details });
        if (!mounted.current) return;
        if (!result.success) {
          if (result.details && "code" in result.details && result.details.code === "authentication_required") {
            setSignInHref(authPathForRedirect(window.location.pathname + window.location.search));
          }
          setError(result.error);
          return;
        }
        setDetails("");
        setSignInHref(null);
        toast.success("Report submitted. The operations team will review it.");
      } catch {
        if (mounted.current) setError("Report submission could not be confirmed. Your details are kept. Try again to check.");
      } finally {
        busy.current = false;
      }
    });
  }

  const triggerClass = cn("group flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-semibold text-muted-foreground outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ring", compact && "px-1 text-[11px]");
  const triggerLabel = <><Flag className="size-4 shrink-0" aria-hidden="true" /><span data-report-label="" className={iconOnly ? cn("sr-only", popover ? "group-aria-expanded:not-sr-only" : "group-open:not-sr-only") : undefined}>{label}</span></>;
  const form = (
      <div className={cn("p-3", !popover && "border-t border-border")}>
        <label className="text-xs font-semibold text-muted-foreground">Reason
          <select disabled={pending} value={category} onChange={(event) => setCategory(event.target.value as ModerationCategory)} className="mt-1 h-11 w-full rounded-md border border-input bg-panel px-3 text-sm shadow-[var(--shadow-control)] outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-ring/25">
            {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="mt-3 block text-xs font-semibold text-muted-foreground">Details
          <Textarea disabled={pending} className="mt-1" minLength={20} maxLength={2000} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Share specific details that will help us investigate." />
        </label>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">{details.length}/2000</span>
          <Button type="button" size="sm" aria-busy={pending} disabled={pending || details.trim().length < 20} onClick={submit}>{pending ? "Submitting report…" : "Submit report"}</Button>
        </div>
        {error ? <p role="alert" className="mt-3 text-sm leading-5 text-destructive">{error}</p> : null}
        {signInHref ? <p className="mt-3 text-sm"><Link href={signInHref} prefetch={false} className="inline-flex min-h-11 items-center font-semibold text-forest underline">Sign in to submit this report</Link></p> : null}
      </div>
  );

  if (popover) return (
    <Popover.Root modal={false}>
      <div className={cn("w-fit", className)}>
        <Popover.Trigger aria-label={label} className={cn(triggerClass, "rounded-lg border border-border bg-panel", compact && "border-0 bg-transparent")}>
          {triggerLabel}
        </Popover.Trigger>
      </div>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} collisionPadding={12} collisionAvoidance={{ side: "flip", align: "shift" }} className="z-[calc(var(--z-dialog)+1)]">
          <Popover.Popup role="dialog" aria-label={label} className="max-h-[var(--available-height)] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-xl border border-border bg-panel text-ink shadow-[var(--elevation-2)] outline-none">
            {form}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );

  return (
    <details className={cn("group rounded-lg border border-border bg-panel", compact && "w-fit border-0 bg-transparent", className)}>
      <summary className={triggerClass}>{triggerLabel}</summary>
      {form}
    </details>
  );
}
