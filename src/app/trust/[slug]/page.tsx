import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { findTrustCatalogItem, trustCatalog, trustCategoryLabels } from "@/features/trust/catalog";
import { TransparencyPanel } from "@/features/trust/components/transparency-panel";
import { TrustDocumentView } from "@/features/trust/components/trust-document";
import { TrustShell } from "@/features/trust/components/trust-shell";
import { getLatestTransparencySnapshot, getPublishedTrustDocument } from "@/features/trust/data";
import type { TrustDocument } from "@/features/trust/types";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return trustCatalog.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = findTrustCatalogItem(slug);
  return item ? { title: item.title, description: item.summary } : {};
}

export default async function TrustDocumentPage({ params }: Props) {
  const { slug } = await params;
  const catalogItem = findTrustCatalogItem(slug);
  if (!catalogItem) notFound();

  let result: Awaited<ReturnType<typeof getPublishedTrustDocument>> = null;
  try {
    result = await getPublishedTrustDocument(slug);
  } catch {
    result = null;
  }
  const fallbackDocument: TrustDocument = { id: slug, slug, title: catalogItem.title, summary: catalogItem.summary, category: catalogItem.category, currentVersionId: null };
  const document = result?.document ?? fallbackDocument;
  const snapshot = slug === "transparency" ? await getLatestTransparencySnapshot().catch(() => null) : null;
  const peers = trustCatalog.filter((item) => item.category === document.category);

  return (
    <TrustShell aside={
      <nav aria-label={`${trustCategoryLabels[document.category]} documents`}>
        <p className="px-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{trustCategoryLabels[document.category]}</p>
        <div className="mt-3 flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
          {peers.map((item) => <Link key={item.slug} href={`/trust/${item.slug}`} aria-current={item.slug === slug ? "page" : undefined} className={`min-h-11 shrink-0 rounded-lg px-3 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring ${item.slug === slug ? "bg-accent text-forest" : "text-muted-foreground hover:bg-muted hover:text-ink"}`}>{item.title}</Link>)}
        </div>
      </nav>
    }>
      <div>
        <TrustDocumentView document={document} version={result?.version ?? null} />
        {slug === "transparency" ? <TransparencyPanel snapshot={snapshot} /> : null}
      </div>
    </TrustShell>
  );
}
