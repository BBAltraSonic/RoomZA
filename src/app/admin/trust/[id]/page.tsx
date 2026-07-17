import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/premium/primitives";
import { requireAdmin } from "@/features/admin/auth";
import { AdminHeader } from "@/features/admin/components/admin-ui";
import { TrustEditor } from "@/features/trust/components/trust-editor";
import { getAdminTrustDocument } from "@/features/trust/data";

export default async function AdminTrustDocumentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ version?: string }> }) {
  const context = await requireAdmin();
  const { id } = await params;
  const query = await searchParams;
  const data = await getAdminTrustDocument(id);
  if (!data || !data.versions.length) notFound();
  const version = data.versions.find((item) => item.id === query.version) ?? data.versions[0];
  if (!version) notFound();
  return <><AdminHeader title={data.document.title} description={data.document.summary} /><div className="mb-5 flex flex-wrap gap-2">{data.versions.map((item) => <a key={item.id} href={`?version=${item.id}`}><StatusBadge tone={item.id === version.id ? "forest" : "neutral"}>v{item.version} {item.status.replaceAll("_", " ")}</StatusBadge></a>)}</div><TrustEditor document={data.document} version={version} isOwner={context.membership.level === "owner"} /></>;
}
