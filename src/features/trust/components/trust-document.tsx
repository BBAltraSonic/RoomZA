import Link from "next/link";
import { Clock3, FileCheck2 } from "lucide-react";

import { BlogMarkdown } from "@/features/blog/markdown";

import { discoveryRankingFacts } from "../catalog";
import type { PolicyVersion, TrustDocument } from "../types";

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

export function TrustDocumentView({ document, version }: { document: TrustDocument; version: PolicyVersion | null }) {
  if (!version) {
    return (
      <article className="max-w-[72ch]">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-clay">Counsel review</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{document.title}</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">{document.summary}</p>
        <div className="mt-8 rounded-2xl border border-border bg-panel p-5 shadow-[var(--elevation-1)]">
          <FileCheck2 className="size-5 text-forest" />
          <h2 className="mt-3 font-semibold text-ink">Publication is waiting for legal review</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">The product workflow is ready, but Pinpoint will not present draft policy text as approved guidance. Urgent safety concerns can be reported from a listing, profile, or conversation.</p>
        </div>
      </article>
    );
  }

  return (
    <article className="min-w-0 max-w-[72ch]">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-clay">{document.category}</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{document.title}</h1>
      <p className="mt-4 text-base leading-7 text-muted-foreground">{document.summary}</p>
      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-y border-border py-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2"><FileCheck2 className="size-4 text-forest" />Version {version.version}</span>
        <span className="inline-flex items-center gap-2"><Clock3 className="size-4" />Effective {formatDate(version.effectiveAt)}</span>
      </div>
      {document.slug === "transparency" ? (
        <section className="mt-8 rounded-2xl border border-border bg-panel p-5">
          <h2 className="font-semibold text-ink">Current ranking facts</h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
            {discoveryRankingFacts.map((fact) => <li key={fact} className="flex gap-3"><span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-forest" />{fact}</li>)}
          </ul>
        </section>
      ) : null}
      <BlogMarkdown markdown={version.bodyMarkdown} className="mt-9" />
      <footer className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
        Need help? Visit <Link href="/trust/reporting-policy" className="font-semibold text-forest hover:underline">Reporting Policy</Link> or manage personal information in <Link href="/settings#privacy" className="font-semibold text-forest hover:underline">Privacy &amp; Data settings</Link>.
      </footer>
    </article>
  );
}
