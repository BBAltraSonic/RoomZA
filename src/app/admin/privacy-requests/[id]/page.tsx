import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/premium/primitives";
import { requireAdmin } from "@/features/admin/auth";
import { AdminHeader, DetailList } from "@/features/admin/components/admin-ui";
import { PrivacyRequestControls } from "@/features/trust/components/admin-trust-controls";
import { getAdminPrivacyRequest } from "@/features/trust/data";

export default async function AdminPrivacyRequestPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const request = await getAdminPrivacyRequest(id);
  if (!request) notFound();
  const profile = Array.isArray(request.profile) ? request.profile[0] : request.profile;
  return <><AdminHeader title={`${request.request_type.replaceAll("_", " ")} request`} description="Resolution details are private, reasoned, and included in the privileged audit trail." /><div className="mb-4"><StatusBadge tone={request.status === "completed" ? "success" : "info"}>{request.status.replaceAll("_", " ")}</StatusBadge></div><DetailList items={[{ label: "User", value: profile?.full_name || profile?.email || request.user_id || "Deleted account" }, { label: "Submitted", value: new Date(request.created_at).toLocaleString("en-ZA") }, { label: "Due", value: new Date(request.due_at).toLocaleString("en-ZA") }, { label: "Assigned", value: request.assigned_to || "Unassigned" }]} /><section className="mt-5 rounded-xl border border-border bg-panel p-5"><h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">User request</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink">{request.details}</p></section><PrivacyRequestControls request={request} /></>;
}
