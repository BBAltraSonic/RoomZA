import Link from "next/link";
import { FileCheck2 } from "lucide-react";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getRequiredPolicyVersions } from "@/features/trust/acceptance";
import { acceptRequiredPolicies } from "@/features/trust/settings-actions";
import { getSessionProfile } from "@/lib/auth";

export default async function PolicyAcceptancePage() {
  const { user } = await getSessionProfile();
  if (!user) redirect("/auth?redirect=/policy-acceptance");
  const required = await getRequiredPolicyVersions(user.id);
  if (!required.length) redirect("/");
  return <main className="min-h-dvh bg-background px-4 py-12 text-foreground"><div className="mx-auto max-w-2xl rounded-2xl border border-border bg-panel p-6 shadow-[var(--elevation-2)]"><FileCheck2 className="size-6 text-forest" /><p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-clay">Policy update</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Review material changes</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Pinpoint needs your acceptance before continuing because these published versions materially change the agreement or data processing notice.</p><div className="mt-6 divide-y divide-border border-y border-border">{required.map((version) => { const document = Array.isArray(version.document) ? version.document[0] : version.document; return <Link key={version.id} href={`/trust/${document?.slug}`} className="flex min-h-14 items-center justify-between gap-4 py-3 text-sm font-semibold text-ink hover:text-forest">{document?.title ?? "Policy"}<span className="text-xs text-muted-foreground">Version {version.version}</span></Link>; })}</div><form action={acceptRequiredPolicies}><Button className="mt-6" type="submit">Accept and continue</Button></form></div></main>;
}
