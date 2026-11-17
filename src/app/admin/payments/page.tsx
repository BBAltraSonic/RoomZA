import { StatusBadge } from "@/components/premium/primitives";
import {
  AdminFilters,
  AdminHeader,
  AdminMetricBand,
  AdminNextPage,
  AdminRowLink,
  AdminTable,
} from "@/features/admin/components/admin-ui";
import { ProviderEventReview } from "@/features/payments/admin-deposit-controls";
import { getAdminPaymentsOverview, listAdminDeposits, type AdminDeposit } from "@/features/payments/admin-data";
import {
  depositStateLabels,
  heldForOthersCents,
  providerEventReason,
  queueTitles,
} from "@/features/payments/admin-view";
import { formatCents } from "@/features/payments/deposit-view";
import { DEPOSIT_STATES } from "@/features/payments/states";

export const metadata = { title: "Payments | Admin", robots: { index: false, follow: false } };

const dateTime = new Intl.DateTimeFormat("en-ZA", {
  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg",
});

function person(value: AdminDeposit["renter"]) {
  return value?.full_name || value?.email || "Unknown";
}

function stateTone(state: AdminDeposit["state"]) {
  if (state === "disputed") return "warning" as const;
  if (state === "released" || state === "refunded") return "success" as const;
  if (state === "cancelled") return "neutral" as const;
  return "info" as const;
}

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const [overview, deposits] = await Promise.all([getAdminPaymentsOverview(), listAdminDeposits(params)]);
  const needsPerson = overview.queue.length + overview.eventsToReview.length;

  return (
    <>
      <AdminHeader
        title="Payments"
        description="Rental deposits RoomZA holds until move-in, and the transfers and decisions waiting on a person."
      />
      <AdminMetricBand items={[
        { label: "Held for others", value: formatCents(overview.heldCents), detail: `${overview.heldCount} deposits`, tone: "forest" },
        { label: "Owner payouts to send", value: overview.payoutsDue.count, detail: formatCents(overview.payoutsDue.cents), tone: overview.payoutsDue.count ? "clay" : undefined },
        { label: "Refunds needing a person", value: overview.refundsForPerson, tone: overview.refundsForPerson ? "warning" : undefined },
        { label: "Disputes to decide", value: overview.disputes, tone: overview.disputes ? "warning" : undefined },
        { label: "Charges to review", value: overview.eventsToReview.length, detail: "Paid, but not matched to a deposit", tone: overview.eventsToReview.length ? "error" : undefined },
        { label: "Awaiting payment", value: overview.awaitingPaymentCount, detail: "Checkouts opened, not paid" },
      ]} />

      <section className="mt-8" aria-labelledby="payments-queue-heading">
        <h2 id="payments-queue-heading" className="mb-3 text-lg font-semibold text-ink">Needs a person {needsPerson ? `(${needsPerson})` : ""}</h2>
        {needsPerson === 0 ? (
          <p className="rounded-xl border border-border bg-panel px-6 py-8 text-center text-sm text-muted-foreground">Nothing is waiting. Payouts, refunds and disputes appear here.</p>
        ) : (
          <div className="space-y-4">
            {overview.queue.length ? (
              <AdminTable headers={["To do", "Deposit", "Amount to move", "Waiting since", ""]}>
                {overview.queue.map((item) => (
                  <tr key={item.deposit.id}>
                    <td className="px-4 py-3"><StatusBadge tone={item.kind === "owner_payout" ? "clay" : "warning"}>{queueTitles[item.kind]}</StatusBadge></td>
                    <td className="px-4 py-3">
                      <span className="block font-medium text-ink">{item.deposit.listingTitle ?? "Listing removed"}</span>
                      <span className="text-xs text-muted-foreground">{person(item.deposit.renter)} to {person(item.deposit.owner)}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-ink">{item.kind === "dispute" ? formatCents(item.deposit.amount_cents) : formatCents(heldForOthersCents(item.deposit))}</td>
                    <td className="px-4 py-3 text-muted-foreground">{dateTime.format(new Date(item.since))}</td>
                    <td className="px-4 py-3 text-right"><AdminRowLink href={`/admin/payments/${item.deposit.id}`}>Open</AdminRowLink></td>
                  </tr>
                ))}
              </AdminTable>
            ) : null}
            {overview.eventsToReview.length ? (
              <AdminTable headers={["Charge to review", "Paystack reference", "Amount", "Received", "Settle"]}>
                {overview.eventsToReview.map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-3">
                      <span className="block font-medium text-ink">{providerEventReason(event.reason)}</span>
                      {event.payment_id ? <AdminRowLink href={`/admin/payments/${event.payment_id}`}>Open deposit</AdminRowLink> : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{typeof event.payload.reference === "string" ? event.payload.reference : "Unknown"}</td>
                    <td className="px-4 py-3">{typeof event.payload.amount === "number" ? formatCents(event.payload.amount) : "Unknown"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{dateTime.format(new Date(event.received_at))}</td>
                    <td className="px-4 py-3"><ProviderEventReview eventId={event.id} /></td>
                  </tr>
                ))}
              </AdminTable>
            ) : null}
          </div>
        )}
      </section>

      <section className="mt-8" aria-labelledby="payments-all-heading">
        <h2 id="payments-all-heading" className="mb-3 text-lg font-semibold text-ink">All deposits</h2>
        <AdminFilters
          q={params.q}
          status={params.status}
          statuses={DEPOSIT_STATES.map((value) => ({ value, label: depositStateLabels[value] }))}
        />
        <AdminTable headers={["Listing", "Renter", "Owner", "Deposit", "State", "Started"]} empty={!deposits.length}>
          {deposits.map((deposit) => (
            <tr key={deposit.id}>
              <td className="px-4 py-3"><AdminRowLink href={`/admin/payments/${deposit.id}`}>{deposit.listingTitle ?? "Listing removed"}</AdminRowLink></td>
              <td className="px-4 py-3">{person(deposit.renter)}</td>
              <td className="px-4 py-3">{person(deposit.owner)}</td>
              <td className="px-4 py-3 font-medium text-ink">{formatCents(deposit.amount_cents)}</td>
              <td className="px-4 py-3"><StatusBadge tone={stateTone(deposit.state)}>{depositStateLabels[deposit.state]}</StatusBadge></td>
              <td className="px-4 py-3 text-muted-foreground">{dateTime.format(new Date(deposit.created_at))}</td>
            </tr>
          ))}
        </AdminTable>
        <AdminNextPage cursor={deposits.length === 50 ? deposits.at(-1)?.created_at : null} params={{ q: params.q, status: params.status }} />
      </section>
    </>
  );
}
