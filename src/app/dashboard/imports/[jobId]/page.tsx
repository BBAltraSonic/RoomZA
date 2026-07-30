import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppShell, BackLink, PageHeader } from "@/components/premium/primitives";
import { ImportWorkspace } from "@/features/listing-imports/import-workspace";
import {
  listActiveOrganizationAgents,
  listImportRows,
  requireAccessibleImportJob,
  toJobSummary,
} from "@/features/listing-imports/repository";

export const metadata: Metadata = {
  title: "Listing import workspace",
  robots: { index: false, follow: false },
};

export default async function ImportJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const result = await requireAccessibleImportJob(jobId);
  if (!result.job || !result.access.allowed) notFound();
  const selectedState = result.job.selection.mode === "all_matching"
    ? result.job.selection.filter.states?.[0]
    : undefined;
  const [rowsResult, agents] = await Promise.all([
    listImportRows(jobId, { cursor: 0, limit: 100, state: selectedState }),
    listActiveOrganizationAgents(result.job.organization_id),
  ]);

  return (
    <AppShell width="xl" className="pt-2 md:pt-8">
      <BackLink href="/dashboard/imports">Listing imports</BackLink>
      <PageHeader
        eyebrow={result.access.activeOrganization?.organizationName}
        title={result.job.source_name ?? "Untitled import"}
        description="Work is saved to the organization. You can leave this page and safely resume later."
      />
      <ImportWorkspace
        initialJob={toJobSummary(result.job)}
        initialConfiguration={{
          mapping: result.job.mapping,
          defaults: result.job.defaults,
          selection: result.job.selection,
          sourceMetadata: result.job.source_metadata,
          sheetName: result.job.sheet_name,
          recordPath: result.job.record_path,
        }}
        initialRows={rowsResult.rows}
        initialNextCursor={rowsResult.nextCursor}
        agents={agents}
        mapApiKey={process.env.NEXT_PUBLIC_MAPTILER_API_KEY}
      />
    </AppShell>
  );
}
