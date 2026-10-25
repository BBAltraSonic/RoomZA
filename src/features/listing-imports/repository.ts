import "server-only";

import { getImportAccess } from "./access";
import { applyImportReview } from "./review";
import { LEGACY_IMPORT_REVIEW_MESSAGE } from "./selection";
import type {
  CanonicalImportListing,
  DuplicateStrategy,
  ImportDuplicateCandidate,
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
  prepared_selection?: ImportSelection | null;
  cancel_requested_at: string | null;
  heartbeat_at: string | null;
  updated_at: string;
  message_code: string | null;
  message_detail: string | null;
};

export function toJobSummary(job: JobRow): ImportJobSummary {
  const needsSelectionReview = job.stage === "confirming" && !job.prepared_selection;
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
    messageCode: needsSelectionReview ? "selection_review_required" : job.message_code,
    messageDetail: needsSelectionReview ? LEGACY_IMPORT_REVIEW_MESSAGE : job.message_detail,
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
  if (!jobResult.job) return { ...jobResult, rows: [], nextCursor: null, duplicateCandidates: {} as Record<string, ImportDuplicateCandidate> };
  const admin = createUntypedClient();
  const issueRelation = options.severity ? "listing_import_issues!inner" : "listing_import_issues";
  let query = admin
    .from("listing_import_rows")
    .select(`
      id, row_number, state, normalized_data, duplicate_candidate_ids, duplicate_strategy,
      duplicate_listing_id, publication_selected, resulting_listing_id,
      row_version, ${issueRelation}(id, severity, code, field, message, resolved_at)
    `)
    .eq("job_id", jobId)
    .gt("row_number", options.cursor)
    .order("row_number", { ascending: true })
    .limit(options.limit + 1);

  if (options.state) query = query.eq("state", options.state);
  if (options.query) {
    const escaped = options.query.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
    const pattern = JSON.stringify(`%${escaped}%`);
    query = query.or(`normalized_data->>title.ilike.${pattern},normalized_data->>address.ilike.${pattern},normalized_data->>sourceReference.ilike.${pattern}`);
  }
  if (options.severity) {
    query = query.eq("listing_import_issues.severity", options.severity).is("listing_import_issues.resolved_at", null);
  }

  const { data, error } = await query;
  const rows = data ?? [];
  const hasMore = rows.length > options.limit;
  const page = hasMore ? rows.slice(0, options.limit) : rows;
  const duplicateCandidates: Record<string, ImportDuplicateCandidate> = {};
  const candidateIds = [...new Set(page.flatMap(row => (row.duplicate_candidate_ids ?? []) as string[]))];
  let candidatesError: string | null = null;
  for (let offset = 0; !error && offset < candidateIds.length; offset += 100) {
    const candidates = await admin.from("listings").select("id, title, address, status")
      .eq("organization_id", jobResult.job.organization_id).in("id", candidateIds.slice(offset, offset + 100));
    if (candidates.error) { candidatesError = candidates.error.message; break; }
    for (const candidate of candidates.data ?? []) {
      duplicateCandidates[candidate.id] = {
        id: candidate.id,
        title: candidate.title?.trim() || "Untitled listing",
        address: candidate.address?.trim() || "Address not supplied",
        status: candidate.status,
      };
    }
  }
  return {
    ...jobResult,
    rows: page,
    nextCursor: hasMore ? page.at(-1)?.row_number ?? null : null,
    rowsError: error?.message ?? candidatesError,
    duplicateCandidates,
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
  const reviewed = await applyImportReview(jobId, result.job.version, {
    action: "resolve_duplicate", rowId, strategy, listingId,
  });
  return { ...result, error: reviewed.error?.message ?? null };
}

export type { JobRow };
