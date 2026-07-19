import Link from "next/link";

import { Button } from "@/components/ui/button";
import { AdminHeader, DetailList } from "@/features/admin/components/admin-ui";
import { requireAdmin } from "@/features/admin/auth";

export default async function AdminSecurityPage() { const context = await requireAdmin(); const required = context.membership.level === "owner" ? 2 : 1; return <><AdminHeader title="Admin security" description="Admin sessions require authenticator verification at AAL2." /><DetailList items={[{ label: "Access level", value: context.membership.level }, { label: "Verified factors", value: `${context.verifiedFactorCount} of ${required} required` }, { label: "Current assurance", value: context.assuranceLevel?.toUpperCase() || "Unavailable" }, { label: "Recovery", value: context.membership.level === "owner" ? "Trusted recovery command" : "Owner-assisted reset" }]} /><Button className="mt-4" render={<Link href="/admin/security/mfa/setup" />} variant="outline">Manage factors</Button></>; }
