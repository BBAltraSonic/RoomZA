import { AlertCircle, CheckCircle2 } from "lucide-react";

import { StatusBadge } from "@/components/premium/primitives";
import type { PublishReadiness } from "@/features/listings/publish-validation";

export function PublishChecklist({ readiness }: { readiness: PublishReadiness }) {
  const outstanding = [...readiness.fieldErrors, ...(readiness.imageError ? [readiness.imageError] : [])];

  return (
    <div className="rounded-lg border border-border bg-warm-surface p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink">Publish checklist</p>
        <StatusBadge tone={readiness.ready ? "success" : "warning"}>{outstanding.length} outstanding</StatusBadge>
      </div>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        <li className="flex gap-2">
          {readiness.fieldsValid ? <CheckCircle2 className="mt-0.5 size-4 text-forest" /> : <AlertCircle className="mt-0.5 size-4 text-status-warning-text" />}
          Listing details
        </li>
        <li className="flex gap-2">
          {!readiness.imageError ? <CheckCircle2 className="mt-0.5 size-4 text-forest" /> : <AlertCircle className="mt-0.5 size-4 text-status-warning-text" />}
          {readiness.imageCount}/{readiness.requiredImageCount} photos
        </li>
      </ul>
      {outstanding.length > 0 ? <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{outstanding[0]}</p> : null}
    </div>
  );
}
