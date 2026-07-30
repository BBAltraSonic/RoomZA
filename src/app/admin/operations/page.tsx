import { StatusBadge } from "@/components/premium/primitives";
import { ImportOperationButtons, RetryNotificationButton } from "@/features/admin/components/admin-actions";
import { AdminFilters, AdminHeader, AdminTable } from "@/features/admin/components/admin-ui";
import { listAdminImportOperations, listAdminOperations } from "@/features/admin/data";

export default async function AdminOperationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const [items, imports] = await Promise.all([listAdminOperations(params), listAdminImportOperations()]);
  return (
    <>
      <AdminHeader title="Operations" description="Inspect delivery and import jobs using sanitized status data only." />
      <section>
        <h2 className="mb-3 font-semibold text-ink">Listing imports</h2>
        <AdminTable headers={["Organization", "Stage", "Progress", "Storage", "Stage time", "Failure code", "Action"]} empty={!imports.length}>
          {imports.map((job) => (
            <tr key={job.id} className={job.stuck ? "bg-status-warning-surface/50" : undefined}>
              <td className="px-4 py-3"><p className="font-medium text-ink">{job.organizationName}</p><p className="font-mono text-xs text-muted-foreground">{job.id.slice(0, 8)}</p></td>
              <td className="px-4 py-3"><StatusBadge tone={job.stage === "failed" ? "error" : job.stuck ? "warning" : job.stage === "complete" ? "success" : "info"}>{job.stuck ? "stuck" : job.stage}</StatusBadge></td>
              <td className="px-4 py-3 tabular-nums">{job.processed_rows}/{job.total_rows}<p className="text-xs text-muted-foreground">{job.failed_rows} failed</p></td>
              <td className="px-4 py-3 tabular-nums">{(job.storageBytes / 1024 / 1024).toFixed(1)} MB</td>
              <td className="px-4 py-3 tabular-nums">{job.latestStageDurationMs ? `${(job.latestStageDurationMs / 1000).toFixed(1)}s` : "Unavailable"}</td>
              <td className="px-4 py-3 font-mono text-xs">{job.message_code ?? "none"}</td>
              <td className="px-4 py-3"><ImportOperationButtons jobId={job.id} canRetry={job.stage === "failed" || job.stuck} /></td>
            </tr>
          ))}
        </AdminTable>
      </section>
      <section className="mt-8">
        <h2 className="mb-3 font-semibold text-ink">Notification delivery</h2>
        <AdminFilters status={params.status} statuses={[{ value: "queued", label: "Queued" }, { value: "failed", label: "Failed" }, { value: "sent", label: "Sent" }]} />
        <AdminTable headers={["Type", "State", "Attempts", "Next attempt", "Created", "Action"]} empty={!items.length}>
          {items.map((item) => {
            const failed = !item.sent_at && Boolean(item.last_error);
            const state = item.sent_at ? "sent" : failed ? "failed" : "queued";
            return <tr key={item.id}><td className="px-4 py-3 font-medium text-ink">{item.type.replaceAll("_", " ")}</td><td className="px-4 py-3"><StatusBadge tone={state === "sent" ? "success" : state === "failed" ? "error" : "warning"}>{state}</StatusBadge></td><td className="px-4 py-3">{item.attempt_count}</td><td className="px-4 py-3 text-muted-foreground">{new Date(item.next_attempt_at).toLocaleString("en-ZA")}</td><td className="px-4 py-3 text-muted-foreground">{new Date(item.created_at).toLocaleString("en-ZA")}</td><td className="px-4 py-3">{state !== "sent" ? <RetryNotificationButton eventId={item.id} /> : null}</td></tr>;
          })}
        </AdminTable>
      </section>
    </>
  );
}
