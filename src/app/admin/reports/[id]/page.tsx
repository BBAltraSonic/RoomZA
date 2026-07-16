import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/premium/primitives";
import { CaseControls, SensitiveGrantForm } from "@/features/admin/components/admin-actions";
import { AdminHeader, DetailList } from "@/features/admin/components/admin-ui";
import { getAdminCase } from "@/features/admin/data";
import type { ModerationCase } from "@/features/admin/types";

export default async function AdminReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getAdminCase(id);
  if (!data) notFound();
  const item = data.moderationCase as ModerationCase & { reporter?: { email?: string; full_name?: string }; listing?: { title?: string; address?: string }; reported_user?: { email?: string; full_name?: string } };
  return (
    <>
      <AdminHeader title={`Case ${item.id.slice(0, 8)}`} description="Private content stays closed until a case-bound reveal grant is created." />
      <div className="mb-4 flex flex-wrap gap-2"><StatusBadge tone="info">{item.status.replaceAll("_", " ")}</StatusBadge><StatusBadge tone={item.priority === "high" || item.priority === "urgent" ? "error" : "warning"}>{item.priority}</StatusBadge><StatusBadge>{item.category.replaceAll("_", " ")}</StatusBadge></div>
      <DetailList items={[
        { label: "Reporter", value: item.reporter?.full_name || item.reporter?.email || item.reporter_id },
        { label: "Target", value: item.listing?.title || item.reported_user?.full_name || item.reported_user?.email || item.listing_id || item.reported_user_id },
        { label: "Submitted", value: new Date(item.created_at).toLocaleString("en-ZA") },
        { label: "Assignee", value: item.assigned_to || "Unassigned" },
      ]} />
      <section className="my-4 rounded-xl border border-border bg-panel p-4"><h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reporter details</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{item.details}</p></section>
      <CaseControls caseId={item.id} status={item.status} priority={item.priority} assignedTo={item.assigned_to} resolutionNote={item.resolution_note} />
      <div className="mt-4"><SensitiveGrantForm caseId={item.id} /></div>
      <section className="mt-4 rounded-xl border border-border bg-panel p-4">
        <h2 className="font-semibold text-ink">Active reveal grants</h2>
        <p className="mt-1 text-xs text-muted-foreground">Opening a reveal returns a no-store response and records a new audit event.</p>
        <div className="mt-3 space-y-2">{data.grants.filter((grant) => !grant.revoked_at && new Date(grant.expires_at) > new Date()).map((grant) => <a key={grant.id} href={`/api/admin/sensitive/${grant.resource_type === "conversation" ? "conversations" : "documents"}/${grant.resource_id}?caseId=${item.id}`} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm font-semibold text-forest hover:bg-muted"><span>{grant.resource_type} · {grant.resource_id.slice(0, 8)}</span><span className="text-xs font-normal text-muted-foreground">until {new Date(grant.expires_at).toLocaleTimeString("en-ZA")}</span></a>)}</div>
      </section>
      <section className="mt-4 rounded-xl border border-border bg-panel p-4"><h2 className="font-semibold text-ink">Internal timeline</h2><div className="mt-3 space-y-3">{data.notes.length ? data.notes.map((note) => <article key={note.id} className="rounded-lg bg-muted p-3"><p className="whitespace-pre-wrap text-sm text-ink">{note.body}</p><p className="mt-2 text-xs text-muted-foreground">{new Date(note.created_at).toLocaleString("en-ZA")}</p></article>) : <p className="text-sm text-muted-foreground">No internal notes yet.</p>}</div></section>
    </>
  );
}
