import Link from "next/link";

import { StatusBadge } from "@/components/premium/primitives";
import { requireAdmin } from "@/features/admin/auth";
import { AdminHeader, AdminRowLink, AdminTable } from "@/features/admin/components/admin-ui";
import { trustVersionTone } from "@/features/trust/admin-presentation";
import { listAdminTrustDocuments } from "@/features/trust/data";

export default async function AdminTrustPage() {
  await requireAdmin();
  const rows = await listAdminTrustDocuments();
  return <><AdminHeader title="Trust content" description="Draft, review, approve, and publish immutable policies without exposing review content." action={<Link href="/trust" className="text-sm font-semibold text-forest hover:underline">Open public centre</Link>} /><AdminTable headers={["Document", "Category", "Latest version", "Public"]} empty={!rows.length}>{rows.map(({ document, versions }) => { const latest = versions[0]; return <tr key={document.id}><td className="px-4 py-3"><AdminRowLink href={`/admin/trust/${document.id}`}>{document.title}</AdminRowLink><p className="mt-1 text-xs text-muted-foreground">/{document.slug}</p></td><td className="px-4 py-3 text-muted-foreground">{document.category}</td><td className="px-4 py-3"><StatusBadge tone={trustVersionTone(latest?.status)}>{latest ? `v${latest.version} ${latest.status.replaceAll("_", " ")}` : "No version"}</StatusBadge></td><td className="px-4 py-3 text-muted-foreground">{document.currentVersionId ? "Published" : "In review"}</td></tr>; })}</AdminTable></>;
}
