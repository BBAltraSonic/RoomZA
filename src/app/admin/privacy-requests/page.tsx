import { StatusBadge } from "@/components/premium/primitives";
import { requireAdmin } from "@/features/admin/auth";
import { AdminHeader, AdminRowLink, AdminTable } from "@/features/admin/components/admin-ui";
import { listAdminPrivacyRequests } from "@/features/trust/data";

export default async function AdminPrivacyRequestsPage() {
  await requireAdmin();
  const requests = await listAdminPrivacyRequests();
  return <><AdminHeader title="Privacy requests" description="Track POPIA access, correction, deletion, objection, consent, and export work against the 30-day target." /><AdminTable headers={["Request", "User", "Status", "Due"]} empty={!requests.length}>{requests.map((request) => { const profile = Array.isArray(request.profile) ? request.profile[0] : request.profile; const overdue = !["completed", "declined", "cancelled"].includes(request.status) && new Date(request.due_at) < new Date(); return <tr key={request.id}><td className="px-4 py-3"><AdminRowLink href={`/admin/privacy-requests/${request.id}`}>{request.request_type.replaceAll("_", " ")}</AdminRowLink><p className="mt-1 font-mono text-xs text-muted-foreground">{request.id.slice(0, 8)}</p></td><td className="px-4 py-3 text-muted-foreground">{profile?.full_name || profile?.email || request.user_id || "Deleted account"}</td><td className="px-4 py-3"><StatusBadge tone={overdue ? "error" : request.status === "completed" ? "success" : "info"}>{overdue ? "overdue" : request.status.replaceAll("_", " ")}</StatusBadge></td><td className="px-4 py-3 text-muted-foreground">{new Date(request.due_at).toLocaleDateString("en-ZA")}</td></tr>; })}</AdminTable></>;
}
