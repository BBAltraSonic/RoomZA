import Link from "next/link";
import { readOfferReviewQueue } from "@/features/offers/review-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pending Shopping Offers", robots: { index: false, follow: false } };
export default async function OfferReviewQueuePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const parsed = Number(params.page ?? 1);
  const page = Number.isInteger(parsed) && parsed >= 1 && parsed <= 10000 ? parsed : 1;
  const { offers, hasNext } = await readOfferReviewQueue(page);
  return <div className="max-w-3xl space-y-6">
    <div><h1 className="text-2xl font-semibold">Pending Shopping Offers</h1><p className="mt-2 text-sm text-muted-foreground">Submitted snapshots awaiting admin confirmation, oldest first. Private draft changes are excluded.</p></div>
    <Link href="/admin/offers/confirmed" prefetch={false} className="inline-flex min-h-11 items-center text-sm font-medium text-forest underline">Manage confirmed offers</Link>
    {offers.length ? <ul className="divide-y divide-border border-y border-border">{offers.map((offer) => <li key={offer.offerId} className="py-4"><Link href={`/admin/offers/${offer.offerId}`} className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="block break-words font-semibold">{offer.content.title}</span><span className="mt-1 block break-words text-sm text-muted-foreground">{offer.content.shopName} · Version {offer.version}</span></Link></li>)}</ul> : <p className="rounded-xl border border-border p-5 text-sm">No pending submissions on this page.</p>}
    <nav aria-label="Review queue pages" className="flex gap-6 text-sm font-medium">{page > 1 ? <Link href={`/admin/offers?page=${page - 1}`} className="underline">Previous page</Link> : null}{hasNext ? <Link href={`/admin/offers?page=${page + 1}`} className="underline">Next page</Link> : null}</nav>
  </div>;
}
