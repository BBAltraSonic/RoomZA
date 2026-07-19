import { StatusBadge } from "@/components/premium/primitives";
import { requireAdmin } from "@/features/admin/auth";
import { AdminHeader, AdminTable } from "@/features/admin/components/admin-ui";
import { TransparencyControls } from "@/features/trust/components/admin-trust-controls";
import { listAdminTransparencySnapshots } from "@/features/trust/data";

export default async function AdminTransparencyPage() {
  const context = await requireAdmin();
  const snapshots = await listAdminTransparencySnapshots();
  return <><AdminHeader title="Transparency snapshots" description="Generate thresholded monthly aggregates, then publish them through an owner-controlled gate." /><TransparencyControls snapshots={snapshots.map((item) => ({ id: item.id, status: item.status }))} isOwner={context.membership.level === "owner"} /><AdminTable headers={["Period", "Status", "Metrics", "Published"]} empty={!snapshots.length}>{snapshots.map((snapshot) => <tr key={snapshot.id}><td className="px-4 py-3 text-ink">{snapshot.period_start} to {snapshot.period_end}</td><td className="px-4 py-3"><StatusBadge tone={snapshot.status === "published" ? "success" : "warning"}>{snapshot.status}</StatusBadge></td><td className="px-4 py-3 text-muted-foreground">{Array.isArray(snapshot.metrics) ? snapshot.metrics.length : 0}</td><td className="px-4 py-3 text-muted-foreground">{snapshot.published_at ? new Date(snapshot.published_at).toLocaleDateString("en-ZA") : "Not published"}</td></tr>)}</AdminTable></>;
}
