import Link from "next/link";
import { readOfferWorkspace } from "@/features/offers/workspace-data";
import { privateOfferStatus } from "@/features/offers/workspace-contract";
import { PosterControls } from "@/features/offers/poster-controls";

export default async function OfferWorkspacePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const rawPage = Number(params.page ?? 1);
  const page = Number.isInteger(rawPage) && rawPage > 0 && rawPage <= 10000 ? rawPage : 1;
  const workspace = await readOfferWorkspace(page);
  return <>
    <header className="space-y-2"><h1 className="text-2xl font-semibold tracking-tight">Shopping Offer workspace</h1><p className="max-w-prose text-sm text-muted-foreground">Draft edits stay private. Submitted changes need fresh admin confirmation before they appear publicly.</p></header>
    <PosterControls enrollment={workspace.enrollment} />
    {workspace.enrollment === "active" ? <section className="space-y-3"><h2 className="text-lg font-semibold">Your offers</h2>{workspace.offers.length ? <ul className="divide-y divide-border border-y border-border">{workspace.offers.map((offer) => <li key={offer.id}><Link href={`/post/offers/${offer.id}`} className="flex min-h-16 flex-col gap-1 rounded-lg px-2 py-4 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="break-words font-medium">{offer.draft.title || "Untitled offer"}</span><span className="text-sm text-muted-foreground">{privateOfferStatus(offer)} · Version {offer.version}</span></Link></li>)}</ul> : <p className="py-6 text-sm text-muted-foreground">{page === 1 ? "Create a private draft to add your first Shopping Offer." : "No offers on this page."}</p>}
      <nav aria-label="Offer pages" className="flex gap-5 text-sm font-semibold text-forest">{page > 1 ? <Link className="inline-flex min-h-11 items-center" href={`/post/offers?page=${page - 1}`}>Previous</Link> : null}{workspace.hasNext && page < 10000 ? <Link className="inline-flex min-h-11 items-center" href={`/post/offers?page=${page + 1}`}>Next</Link> : null}</nav>
    </section> : null}
  </>;
}
