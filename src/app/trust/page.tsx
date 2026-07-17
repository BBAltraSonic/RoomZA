import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Database, FileCheck2, Flag, LockKeyhole, ShieldCheck } from "lucide-react";

import { trustCatalog, trustCategoryLabels } from "@/features/trust/catalog";
import { TrustShell } from "@/features/trust/components/trust-shell";
import { listTrustDocuments } from "@/features/trust/data";
import type { TrustDocumentCategory } from "@/features/trust/types";

export const metadata: Metadata = {
  title: "Trust & Safety Centre",
  description: "Safety guidance, verification meanings, privacy controls, community rules, and platform transparency for Pinpoint.",
};

const primaryActions = [
  { href: "/trust/safety", label: "Stay safe", detail: "Viewings, applications and scam prevention", icon: ShieldCheck },
  { href: "/trust/verification", label: "Understand verification", detail: "Know exactly what every signal proves", icon: FileCheck2 },
  { href: "/trust/reporting-policy", label: "Report a concern", detail: "Listings, profiles, messages and photos", icon: Flag },
  { href: "/settings#privacy", label: "Control your data", detail: "Exports, consent and privacy requests", icon: LockKeyhole },
];

export default async function TrustCentrePage() {
  let published = new Set<string>();
  try {
    const documents = await listTrustDocuments();
    published = new Set(documents.filter((item) => item.currentVersionId).map((item) => item.slug));
  } catch {
    published = new Set(["privacy", "terms"]);
  }

  const grouped = Object.entries(trustCategoryLabels).map(([category, label]) => ({
    category: category as TrustDocumentCategory,
    label,
    items: trustCatalog.filter((item) => item.category === category),
  }));

  return (
    <TrustShell>
      <div>
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-clay">Trust is a product feature</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">Make informed property decisions.</h1>
          <p className="mt-5 max-w-[65ch] text-base leading-7 text-muted-foreground">Understand Pinpoint&apos;s safeguards, act on a concern, and manage personal information without searching through legal fine print.</p>
        </div>

        <nav aria-label="Trust centre actions" className="mt-10 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-panel shadow-[var(--elevation-1)] md:grid md:grid-cols-2 md:divide-x md:divide-y-0">
          {primaryActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href} className={`group flex min-h-24 items-center gap-4 px-5 py-4 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${index > 1 ? "md:border-t md:border-border" : ""}`}>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-forest"><Icon className="size-5" /></span>
                <span className="min-w-0 flex-1"><span className="block font-semibold text-ink">{action.label}</span><span className="mt-1 block text-sm text-muted-foreground">{action.detail}</span></span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out group-hover:translate-x-1" />
              </Link>
            );
          })}
        </nav>

        <div className="mt-14 grid gap-10 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <div><Database className="size-5 text-forest" /><h2 className="mt-3 text-xl font-semibold text-ink">Policies and explanations</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Approved documents are versioned. Review drafts are clearly marked and never presented as final.</p></div>
          <div className="divide-y divide-border border-y border-border">
            {grouped.map((group) => (
              <section key={group.category} className="grid gap-4 py-7 sm:grid-cols-[12rem_minmax(0,1fr)]">
                <h3 className="text-sm font-semibold text-ink">{group.label}</h3>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <Link key={item.slug} href={`/trust/${item.slug}`} className="group flex min-h-14 items-center justify-between gap-4 rounded-lg px-3 py-2 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
                      <span><span className="block text-sm font-semibold text-ink">{item.title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.summary}</span></span>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${published.has(item.slug) ? "bg-accent text-forest" : "bg-muted text-muted-foreground"}`}>{published.has(item.slug) ? "Published" : "In review"}</span>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </TrustShell>
  );
}
