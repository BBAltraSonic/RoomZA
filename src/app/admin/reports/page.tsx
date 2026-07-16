import Link from "next/link";

import { StatusBadge } from "@/components/premium/primitives";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/features/admin/auth";
import { AdminFilters, AdminHeader, AdminNextPage, AdminRowLink, AdminTable } from "@/features/admin/components/admin-ui";
import { listAdminCases } from "@/features/admin/data";

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const [cases, context] = await Promise.all([listAdminCases(params), requireAdmin()]);
  const exportQuery = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1]))).toString();
  return (
    <>
      <AdminHeader title="Moderation reports" description="Assign, investigate, and resolve listing or account reports." action={context.membership.level === "owner" ? <Button render={<Link href={`/admin/exports/cases${exportQuery ? `?${exportQuery}` : ""}`} />} variant="outline">Export CSV</Button> : undefined} />
      <AdminFilters status={params.status} statuses={[{ value: "open", label: "Open" }, { value: "in_review", label: "In review" }, { value: "resolved", label: "Resolved" }, { value: "dismissed", label: "Dismissed" }]} priority={params.priority ?? ""} assignee={params.assignee ?? ""} from={params.from} to={params.to} showDates />
      <AdminTable headers={["Case", "Target", "Category", "Priority", "Status", "Submitted"]} empty={!cases.length}>
        {cases.map((item) => <tr key={item.id} className="hover:bg-muted/40"><td className="px-4 py-3"><AdminRowLink href={`/admin/reports/${item.id}`}>{item.id.slice(0, 8)}</AdminRowLink></td><td className="px-4 py-3 text-ink">{item.listing?.title ?? item.reported_user?.full_name ?? item.reported_user?.email ?? "Account"}</td><td className="px-4 py-3 text-muted-foreground">{item.category.replaceAll("_", " ")}</td><td className="px-4 py-3"><StatusBadge tone={item.priority === "urgent" || item.priority === "high" ? "error" : item.priority === "normal" ? "warning" : "neutral"}>{item.priority}</StatusBadge></td><td className="px-4 py-3"><StatusBadge tone={item.status === "resolved" ? "success" : item.status === "dismissed" ? "neutral" : "info"}>{item.status.replaceAll("_", " ")}</StatusBadge></td><td className="px-4 py-3 text-muted-foreground">{new Date(item.created_at).toLocaleDateString("en-ZA")}</td></tr>)}
      </AdminTable>
      <AdminNextPage cursor={cases.length === 50 ? cases.at(-1)?.created_at : null} params={params} />
    </>
  );
}
