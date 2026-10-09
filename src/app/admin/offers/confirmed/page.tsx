import Link from "next/link";
import { confirmedOfferCursorSchema } from "@/features/offers/confirmed-contract";
import { readConfirmedOfferQueue } from "@/features/offers/confirmed-data";
export const dynamic = "force-dynamic";
export const metadata = { title: "Confirmed Shopping Offers", robots: { index: false, follow: false } };
const labels = { live: "Live", scheduled: "Scheduled", expired: "Expired", unavailable: "Unavailable to visitors" };
const format = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
export default async function ConfirmedOffersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const hasCursor = params.afterConfirmedAt !== undefined || params.afterOfferId !== undefined;
  const cursor = hasCursor ? confirmedOfferCursorSchema.parse({ confirmedAt: params.afterConfirmedAt, offerId: params.afterOfferId }) : undefined;
  const queue = await readConfirmedOfferQueue(cursor);
  return <div className="max-w-3xl space-y-6">
    <div><h1 className="text-2xl font-semibold">Confirmed Shopping Offers</h1><p className="mt-2 text-sm text-muted-foreground">Current recorded approvals, newest first. Private draft changes are excluded. An approval can be scheduled, expired or unavailable to visitors.</p></div>
    <p className="text-xs text-muted-foreground">Availability checked {format.format(new Date(queue.checkedAt))} SAST</p>
    {queue.items.length ? <ul className="divide-y divide-border border-y border-border">{queue.items.map((offer) => <li key={offer.offerId} className="py-4"><Link href={`/admin/offers/${offer.offerId}`} prefetch={false} className="block min-h-11 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="block break-words font-semibold">{offer.title}</span><span className="mt-1 block break-words text-sm text-muted-foreground">{offer.shopName} · {labels[offer.publicStatus]} · Current version {offer.version}</span><span className="mt-1 block text-xs text-muted-foreground">Confirmed {format.format(new Date(offer.confirmedAt))} SAST</span></Link></li>)}</ul> : <p className="rounded-xl border border-border p-5 text-sm">No current approvals on this page.</p>}
    <nav aria-label="Confirmed offer navigation" className="flex flex-wrap gap-6 text-sm font-medium">
      {queue.nextCursor ? <Link href={`/admin/offers/confirmed?${new URLSearchParams({ afterConfirmedAt: queue.nextCursor.confirmedAt, afterOfferId: queue.nextCursor.offerId })}`} prefetch={false} className="inline-flex min-h-11 items-center underline">Next confirmed offers</Link> : null}
      {cursor ? <Link href="/admin/offers/confirmed" prefetch={false} className="inline-flex min-h-11 items-center underline">First confirmed offers</Link> : null}
      <Link href="/admin/offers" prefetch={false} className="inline-flex min-h-11 items-center underline">Pending offers</Link>
    </nav>
  </div>;
}
