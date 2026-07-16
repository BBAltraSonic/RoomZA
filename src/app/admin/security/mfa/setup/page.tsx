import { MfaSetup } from "@/features/admin/components/mfa-flow";
import { requireAdminMembership } from "@/features/admin/auth";
import { requiredAdminFactors } from "@/features/admin/policy";

export default async function AdminMfaSetupPage() { const context = await requireAdminMembership({ redirectTo: "/admin/security/mfa/setup" }); const required = requiredAdminFactors(context.membership.level); return <div className="py-8"><MfaSetup requiredFactors={required} verifiedFactors={context.verifiedFactorCount} /></div>; }
