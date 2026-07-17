import { StatusBadge } from "@/components/premium/primitives";
import { requireAdmin } from "@/features/admin/auth";
import { AdminHeader, AdminTable } from "@/features/admin/components/admin-ui";
import { VerificationControls } from "@/features/trust/components/admin-trust-controls";
import { listAdminVerificationChecks } from "@/features/trust/data";

export default async function AdminVerificationsPage() {
  await requireAdmin();
  const checks = await listAdminVerificationChecks();
  return <><AdminHeader title="Verification checks" description="Award only explicit evidence-based signals. Identity and property ownership are not inferred." /><VerificationControls /><AdminTable headers={["Subject", "Signal", "Status", "Updated"]} empty={!checks.length}>{checks.map((check) => { const listing = Array.isArray(check.listing) ? check.listing[0] : check.listing; const profile = Array.isArray(check.profile) ? check.profile[0] : check.profile; return <tr key={check.id}><td className="px-4 py-3 text-ink">{listing?.title || profile?.full_name || profile?.email || check.listing_id || check.profile_id}</td><td className="px-4 py-3 text-muted-foreground">{check.public_label || check.check_key.replaceAll("_", " ")}</td><td className="px-4 py-3"><StatusBadge tone={check.status === "verified" ? "success" : check.status === "revoked" ? "error" : "warning"}>{check.status}</StatusBadge></td><td className="px-4 py-3 text-muted-foreground">{new Date(check.updated_at).toLocaleDateString("en-ZA")}</td></tr>; })}</AdminTable></>;
}
