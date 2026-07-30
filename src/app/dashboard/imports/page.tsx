import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, FileUp, Plus } from "lucide-react";

import { AppShell, EmptyState, PageHeader, StatusBadge } from "@/components/premium/primitives";
import { Button } from "@/components/ui/button";
import { listImportJobs } from "@/features/listing-imports/repository";

export const metadata: Metadata = {
  title: "Listing imports",
  robots: { index: false, follow: false },
};

const statusTone = (stage: string): "success" | "warning" | "error" | "info" | "neutral" => {
  if (stage === "complete") return "success";
  if (stage === "failed" || stage === "cancelled") return "error";
  if (stage === "validating" || stage === "committing") return "info";
  if (stage === "resolving" || stage === "confirming") return "warning";
  return "neutral";
};

export default async function ImportsPage() {
  const result = await listImportJobs();
  if (!result.allowed) {
    return (
      <AppShell width="xl" className="pt-2 md:pt-20">
        <PageHeader eyebrow="Organization workspace" title="Listing imports" description="Durable, review-first listing migration." />
        <EmptyState icon={AlertCircle} title="Imports are unavailable" description={result.reason ?? "Your organization cannot access imports."} />
      </AppShell>
    );
  }

  return (
    <AppShell width="xl" className="pt-2 md:pt-20">
      <PageHeader
        eyebrow={result.activeOrganization?.organizationName}
        title="Listing imports"
        description="Stage structured records and media, isolate failures, then explicitly confirm every public change."
        action={
          <Button render={<Link href="/dashboard/imports/new" />}>
            <Plus className="size-4" />
            New import
          </Button>
        }
      />
      {result.jobs.length === 0 ? (
        <EmptyState
          icon={FileUp}
          title="No import jobs yet"
          description="Start with CSV, XLSX, XML, JSON, a pasted table, or a Pinpoint v1 export. Imported listings begin as private drafts."
          action={<Button render={<Link href="/dashboard/imports/new" />}>Start an import</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-panel shadow-[var(--shadow-card)]">
          <div className="hidden grid-cols-[minmax(0,1.5fr)_9rem_repeat(4,6rem)_7rem] gap-3 border-b border-border bg-warm-surface px-4 py-3 text-xs font-semibold uppercase text-muted-foreground md:grid">
            <span>Source</span><span>Stage</span><span>Rows</span><span>Valid</span><span>Blocked</span><span>Failed</span><span>Updated</span>
          </div>
          <ul className="divide-y divide-border">
            {result.jobs.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/dashboard/imports/${job.id}`}
                  className="grid min-h-20 gap-2 px-4 py-4 outline-none hover:bg-warm-surface focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:grid-cols-[minmax(0,1.5fr)_9rem_repeat(4,6rem)_7rem] md:items-center md:gap-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{job.sourceName ?? "Untitled import"}</p>
                    <p className="mt-0.5 text-xs uppercase text-muted-foreground">{job.sourceKind.replaceAll("_", " ")}</p>
                  </div>
                  <StatusBadge tone={statusTone(job.stage)} className="w-fit">{job.stage.replaceAll("_", " ")}</StatusBadge>
                  <div className="grid grid-cols-4 gap-3 text-sm tabular-nums md:contents">
                    <span aria-label={`${job.totalRows} rows`}>{job.totalRows}</span>
                    <span className="text-status-success-text" aria-label={`${job.validRows} valid`}>{job.validRows}</span>
                    <span className="text-status-warning-text" aria-label={`${job.blockedRows} blocked`}>{job.blockedRows}</span>
                    <span className="text-status-error-text" aria-label={`${job.failedRows} failed`}>{job.failedRows}</span>
                  </div>
                  <time className="text-xs text-muted-foreground" dateTime={job.updatedAt}>
                    {new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "short" }).format(new Date(job.updatedAt))}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AppShell>
  );
}
