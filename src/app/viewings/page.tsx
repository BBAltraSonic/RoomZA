import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getMyApplications } from "@/features/applications/actions";
import { getMyPurchases } from "@/features/purchase/data";
import { AppointmentSummary } from "@/features/viewings/components/appointment-summary";

export const metadata = { title: "My viewings", robots: { index: false, follow: false } };

export default async function ViewingsPage() {
  await requireUser({ redirectTo: "/viewings" });
  const [applications, purchases] = await Promise.all([getMyApplications(), getMyPurchases("/viewings")]);
  const now = purchases.now;
  const rows = [
    ...(applications.success ? applications.data ?? [] : []).map(row => ({ ...row, applicationId: row.id, buyerInterestId: undefined })),
    ...(purchases.success ? purchases.data : []).map(row => ({ ...row, applicationId: undefined, buyerInterestId: row.id })),
  ].filter(row => row.viewings?.length || row.viewing_slot_offers?.length);
  return <main className="mx-auto max-w-4xl space-y-6 px-5 py-10">
    <header><h1 className="text-3xl font-semibold">Viewings</h1><p className="mt-2 text-muted-foreground">Choose proposed times and review your rental and purchase appointments.</p></header>
    <Link href="/dashboard/viewings" className="inline-flex min-h-11 items-center text-forest underline">Manage viewings for your listings</Link>
    {!applications.success || !purchases.success ? <div role="alert" className="space-y-3"><p>Some viewing information could not be loaded.</p><Link href="/viewings" className="inline-flex min-h-11 items-center text-forest underline">Try again</Link></div> : null}
    {rows.length ? <ul className="space-y-5">{rows.map(row => {
      const listing = Array.isArray(row.listing) ? row.listing[0] : row.listing;
      return <li key={`${row.applicationId ? "rental" : "purchase"}-${row.id}`} className="space-y-4 rounded-xl border border-border bg-panel p-5">
        <div><h2 className="text-xl font-semibold"><Link href={`/listing/${row.listing_id}`} className="text-forest underline">{listing?.title ?? "Property unavailable"}</Link></h2><p className="mt-1 text-sm text-muted-foreground">{listing?.address}</p></div>
        <AppointmentSummary now={now} applicationId={row.applicationId} buyerInterestId={row.buyerInterestId} viewings={row.viewings ?? []} offers={row.viewing_slot_offers ?? []} />
      </li>;
    })}</ul> : applications.success && purchases.success ? <div className="space-y-3"><p>No viewing invitations yet. Apply for a rental or request a viewing on a property for sale.</p><Link href="/" className="inline-flex min-h-11 items-center text-forest underline">Explore properties</Link></div> : null}
  </main>;
}
