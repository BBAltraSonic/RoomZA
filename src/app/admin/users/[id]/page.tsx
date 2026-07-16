import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/premium/primitives";
import { UserRestrictionControls } from "@/features/admin/components/admin-actions";
import { AdminHeader, DetailList } from "@/features/admin/components/admin-ui";
import { getAdminUser } from "@/features/admin/data";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getAdminUser(id);
  if (!data) notFound();
  const activeSuspension = data.suspensions.find((item) => !item.restored_at && (!item.suspended_until || new Date(item.suspended_until) > new Date()));
  return <><AdminHeader title={data.profile?.full_name || data.user.email || "User"} description="Account metadata only. Message bodies and documents require an active moderation case." /><div className="mb-4 flex gap-2">{data.membership && !data.membership.revoked_at ? <StatusBadge tone="forest">{data.membership.level}</StatusBadge> : null}{activeSuspension ? <StatusBadge tone="error">Suspended</StatusBadge> : <StatusBadge tone="success">Active</StatusBadge>}</div><DetailList items={[{ label: "User ID", value: data.user.id }, { label: "Email", value: data.user.email || "Unavailable" }, { label: "Persona", value: data.profile?.role || "Not selected" }, { label: "Created", value: new Date(data.user.created_at).toLocaleString("en-ZA") }, { label: "Last sign-in", value: data.user.last_sign_in_at ? new Date(data.user.last_sign_in_at).toLocaleString("en-ZA") : "Never" }, { label: "Email verification", value: data.profile?.email_verified_at ? "Verified" : "Pending" }, { label: "Admin MFA", value: data.membership && !data.membership.revoked_at ? `${data.factorCount} verified factor${data.factorCount === 1 ? "" : "s"}` : "Not an admin" }]} /><div className="mt-4"><UserRestrictionControls userId={id} suspended={Boolean(activeSuspension)} /></div></>;
}
