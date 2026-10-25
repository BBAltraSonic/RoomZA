import Link from "next/link";
import { getMyPurchases } from "@/features/purchase/data";
import { buyerInterestStatusLabels } from "@/features/purchase/pipeline";
import { purchaseStageLabels } from "@/features/purchase/progress";
import { AppointmentSummary } from "@/features/viewings/components/appointment-summary";

export const metadata = { title: "My purchases", robots: { index: false, follow: false } };

export default async function PurchasesPage() {
  const result = await getMyPurchases();
  const now = result.now;
  return <main className="mx-auto max-w-4xl space-y-6 px-5 py-10">
    <header><h1 className="text-3xl font-semibold">Purchases</h1><p className="mt-2 text-muted-foreground">Your property enquiries, purchase progress, and viewing times.</p></header>
    {!result.success ? <div role="alert" className="space-y-3"><p>{result.error}</p><Link href="/purchases" className="inline-flex min-h-11 items-center text-forest underline">Try again</Link></div>
      : !result.data.length ? <div className="space-y-3"><p>Contact a seller or request a viewing to start your purchase journey.</p><Link href="/?mode=buy" className="inline-flex min-h-11 items-center text-forest underline">Explore properties for sale</Link></div>
      : <ul className="space-y-5">{result.data.map(purchase => <li key={purchase.id} className="space-y-4 rounded-xl border border-border bg-panel p-5">
        <div><h2 className="text-xl font-semibold"><Link href={`/listing/${purchase.listing_id}`} className="text-forest underline">{purchase.listing?.title ?? "Property unavailable"}</Link></h2><p className="mt-1 text-sm text-muted-foreground">{purchase.listing?.address}</p></div>
        <p>{buyerInterestStatusLabels[purchase.status]}</p>
        {purchase.progress ? <p className="text-sm">Current milestone: {purchaseStageLabels[purchase.progress.current_stage]}</p> : null}
        <AppointmentSummary now={now} buyerInterestId={purchase.id} viewings={purchase.viewings ?? []} offers={purchase.viewing_slot_offers ?? []} />
      </li>)}</ul>}
  </main>;
}
