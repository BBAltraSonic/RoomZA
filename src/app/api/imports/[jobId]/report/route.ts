import { requireAccessibleImportJob, toJobSummary } from "@/features/listing-imports/repository";
import type { ImportIssueCode, ImportReport, ImportRowState } from "@/features/listing-imports/types";
import { apiFailure, getRequestId } from "@/lib/api";
import { createUntypedClient } from "@/lib/supabase/admin";

type ReportRow = {
  row_number: number;
  state: ImportRowState;
  normalized_data: { sourceReference?: string } | null;
  resulting_listing_id: string | null;
  listing_import_issues: Array<{ code: ImportIssueCode }>;
};

function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const requestId = getRequestId(request);
  const { jobId } = await context.params;
  const result = await requireAccessibleImportJob(jobId);
  if (!result.job) return apiFailure({ code: "not_found", message: result.error }, 404, { requestId });

  const admin = createUntypedClient();
  const rows: ReportRow[] = [];
  for (let from = 0; ; from += 1_000) {
    const { data, error } = await admin
      .from("listing_import_rows")
      .select("row_number, state, normalized_data, resulting_listing_id, listing_import_issues(code)")
      .eq("job_id", jobId)
      .order("row_number", { ascending: true })
      .range(from, from + 999);
    if (error) return apiFailure({ code: "server_error", message: "Unable to generate the import report." }, 500, { requestId });
    rows.push(...((data ?? []) as ReportRow[]));
    if ((data?.length ?? 0) < 1_000) break;
  }

  const report: ImportReport = {
    schemaVersion: 1,
    job: toJobSummary(result.job),
    rows: rows.map((row) => ({
      rowNumber: row.row_number,
      state: row.state,
      sourceReference: row.normalized_data?.sourceReference,
      issueCodes: row.listing_import_issues.map((issue) => issue.code),
      resultingListingId: row.resulting_listing_id ?? undefined,
    })),
    generatedAt: new Date().toISOString(),
  };
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "json";
  const headers = new Headers({
    "cache-control": "private, no-store",
    "content-disposition": `attachment; filename="pinpoint-import-${jobId}.${format}"`,
    "x-request-id": requestId,
  });
  if (format === "json") {
    headers.set("content-type", "application/json; charset=utf-8");
    return new Response(JSON.stringify(report, null, 2), { headers });
  }

  headers.set("content-type", "text/csv; charset=utf-8");
  const lines = [
    ["row_number", "state", "source_reference", "issue_codes", "resulting_listing_id"].map(csvCell).join(","),
    ...report.rows.map((row) => [
      row.rowNumber,
      row.state,
      row.sourceReference,
      row.issueCodes.join("|"),
      row.resultingListingId,
    ].map(csvCell).join(",")),
  ];
  return new Response(`\uFEFF${lines.join("\r\n")}`, { headers });
}
