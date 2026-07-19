import { MfaChallenge } from "@/features/admin/components/mfa-flow";
import { getAdminMfaChallengeData } from "@/features/admin/auth";

export default async function AdminMfaChallengePage() { const factors = await getAdminMfaChallengeData(); return <div className="py-8"><MfaChallenge factors={factors} /></div>; }
