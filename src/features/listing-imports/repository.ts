import "server-only";

import { getImportAccess } from "./access";
import type {
  CanonicalImportListing,
  DuplicateStrategy,
  ImportJobStage,
  ImportJobSummary,
  ImportMapping,
  ImportRowState,
  ImportSelection,
} from "./types";
import { createUntypedClient } from "@/lib/supabase/admin";

type JobRow = {
  id: string;
  organization_id: string;
  created_by: string;
  source_kind: ImportJobSummary["sourceKind"];
  source_name: string | null;
  source_path: string | null;
  source_size_bytes: number | null;
  source_metadata: Record<string, unknown>;
  adapter_version: string;
  record_path: string | null;
  sheet_name: string | null;
  stage: ImportJobStage;
  stage_cursor: number;
  version: number;
  total_rows: number;
  processed_rows: number;
  valid_rows: number;
  warning_rows: number;
  blocked_rows: number;
  committed_rows: number;
  failed_rows: number;
  mapping: ImportMapping;
  defaults: Partial<CanonicalImportListing> & Record<string, unknown>;
  selection: ImportSelection;
  cancel_requested_at: string | null;
  heartbeat_at: string | null;
  updated_at: string;
  message_code: string | null;
  message_detail: string | null;
};

export function toJobSummary(job: JobRow): ImportJobSummary {
  return {
    id: job.id,
    organizationId: job.organization_id,
    sourceKind: job.source_kind,
    sourceName: job.source_name,
    stage: job.stage,
    version: job.version,
    totalRows: job.total_rows,
    processedRows: job.processed_rows,
    validRows: job.valid_rows,
    warningRows: job.warning_rows,
    blockedRows: job.blocked_rows,
    committedRows: job.committed_rows,
    failedRows: job.failed_rows,
    heartbeatAt: job.heartbeat_at,
    updatedAt: job.updated_at,
    messageCode: job.message_code,
    messageDetail: job.message_detail,
  };
}

export async function requireAccessibleImportJob(jobId: string) {
  const access = await getImportAccess();
  if (!access.allowed || !access.activeOrganization) {
    return { access, job: null, error: access.reason ?? "Import access is unavailable." };
  }

  const admin = createUntypedClient();
  const { data, error } = await admin
    .from("listing_import_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("organization_id", access.activeOrganization.organizationId)
    .maybeSingle();

  if (error || !data) return { access, job: null, error: "Import job not found." };
  return { access, job: data as JobRow, error: null };
}

export async function listImportJobs() {
  const access = await getImportAccess();
  if (!access.allowed || !access.activeOrganization) return { ...access, jobs: [] as ImportJobSummary[] };

  const admin = createUntypedClient();
  const { data, error } = await admin
    .from("listing_import_jobs")
    .select("*")
    .eq("organization_id", access.activeOrganization.organizationId)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(100);

  return {
    ...access,
    jobs: error ? [] : ((data ?? []) as JobRow[]).map(toJobSummary),
    loadError: error?.message ?? null,
  };
}

export async function listImportRows(
  jobId: string,
  options: { cursor: number; limit: number; state?: ImportRowState; severity?: string; query?: string },
) {
  const jobResult = await requireAccessibleImportJob(jobId);
  if (!jobResult.job) return { ...jobResult, rows: [], nextCursor: null };
  const admin = createUntypedClient();
  let query = admin
    .from("listing_import_rows")
    .select(`
      id, row_number, state, normalized_data, duplicate_candidate_ids, duplicate_strategy,
      duplicate_listing_id, publication_selected, resulting_listing_id,
      listing_import_issues(id, severity, code, field, message, resolved_at)
    `)
    .eq("job_id", jobId)
    .gt("row_number", options.cursor)
    .order("row_number", { ascending: true })
    .limit(options.limit + 1);

  if (options.state) query = query.eq("state", options.state);
  if (options.query) {
    const escaped = options.query.replaceAll("%", "\\%").replaceAll("_", "\\_");
    query = query.or(`normalized_data->>title.ilike.%${escaped}%,normalized_data->>address.ilike.%${escaped}%,normalized_data->>sourceReference.ilike.%${escaped}%`);
  }
  if (options.severity) {
    query = query.eq("listing_import_issues.severity", options.severity).is("listing_import_issues.resolved_at", null);
  }

  const { data, error } = await query;
  const rows = data ?? [];
  const hasMore = rows.length > options.limit;
  const page = hasMore ? rows.slice(0, options.limit) : rows;
  return {
    ...jobResult,
    rows: page,
    nextCursor: hasMore ? page.at(-1)?.row_number ?? null : null,
    rowsError: error?.message ?? null,
  };
}

export async function listActiveOrganizationAgents(organizationId: string) {
  const admin = createUntypedClient();
  const { data, error } = await admin
    .from("organization_memberships")
    .select("user_id, role")
    .eq("organization_id", organizationId)
    .is("revoked_at", null)
    .order("role", { ascending: true });
  if (error) return [];

  const memberships = data ?? [];
  const userIds = memberships.map((row) => row.user_id as string);
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("id, full_name, email").in("id", userIds)
    : { data: [] };
  const profilesById = new Map(
    (profiles ?? []).map((profile) => [profile.id as string, profile]),
  );

  return memberships.map((row) => {
    const profile = profilesById.get(row.user_id as string);
    return {
      id: row.user_id as string,
      role: row.role as "owner" | "admin" | "agent",
      label: (profile?.full_name as string | null) || (profile?.email as string) || "Organization member",
    };
  });
}

export async function updateDuplicateResolution(
  jobId: string,
  rowId: string,
  strategy: DuplicateStrategy,
  listingId: string | null,
) {
  const result = await requireAccessibleImportJob(jobId);
  if (!result.job) return result;
  const admin = createUntypedClient();
  const { error } = await admin
    .from("listing_import_rows")
    .update({
      duplicate_strategy: strategy,
      duplicate_listing_id: listingId,
      state: strategy === "skip" ? "skipped" : "draft_ready",
      updated_at: new Date().toISOString(),
    })
    .eq("id", rowId)
    .eq("job_id", jobId);
  return { ...result, error: error?.message ?? null };
}

export type { JobRow };
