import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getAdminOverview } from "@/features/admin/data";
import { AdminHeader, AdminMetricBand } from "@/features/admin/components/admin-ui";

export const metadata = { title: "Admin overview", robots: { index: false, follow: false } };

export default async function AdminOverviewPage() {
  const data = await getAdminOverview();
  return (
    <>
      <AdminHeader title="Operations overview" description="Current platform volume, moderation pressure, and delivery health." action={<Button render={<Link href="/admin/inbox" />} variant="outline">Open inbox<ArrowRight className="size-4" /></Button>} />
      <AdminMetricBand items={[
        { label: "Users", value: data.totals.users, detail: `${data.trends.users7} joined in 7 days`, tone: "forest" },
        { label: "Listings", value: data.totals.listings },
        { label: "Open cases", value: data.totals.cases, detail: `${data.trends.cases7} reports in 7 days`, tone: data.totals.cases ? "clay" : "forest" },
        { label: "Applications", value: data.totals.applications },
        { label: "Viewings", value: data.totals.viewings },
        { label: "Failed notifications", value: data.totals.failedJobs, tone: data.totals.failedJobs ? "error" : "forest" },
      ]} />
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-panel p-5"><h2 className="font-semibold text-ink">Moderation</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Triage reported listings and accounts, document decisions, then apply reversible restrictions.</p><Button className="mt-4" render={<Link href="/admin/reports" />} variant="outline">Review reports</Button></section>
        <section className="rounded-xl border border-border bg-panel p-5"><h2 className="font-semibold text-ink">Delivery operations</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Inspect failed notification events and retry only records that remain unsent.</p><Button className="mt-4" render={<Link href="/admin/operations" />} variant="outline">Inspect delivery</Button></section>
      </div>
    </>
  );
}
