import { notFound } from "next/navigation";

import { BackLink, StatusBadge } from "@/components/premium/primitives";
import { AdminHeader, AdminRowLink, AdminTable, DetailList } from "@/features/admin/components/admin-ui";
import { AdminDepositControls, ProviderEventReview } from "@/features/payments/admin-deposit-controls";
import { getAdminDeposit } from "@/features/payments/admin-data";
import {
  adminDepositPanels,
  depositAmounts,
  depositStateLabels,
  manualRefundReason,
  providerEventReason,
} from "@/features/payments/admin-view";
import { formatCents } from "@/features/payments/deposit-view";

export const metadata = { title: "Deposit | Admin", robots: { index: false, follow: false } };

const dateTime = new Intl.DateTimeFormat("en-ZA", {
  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg",
});
const when = (value: string | null) => (value ? dateTime.format(new Date(value)) : "Not yet");

const ledgerLabels: Record<string, string> = {
  charge: "Paid by the renter",
  commission: "RoomZA commission",
  cancellation_fee: "Cancellation fee kept",
  owner_payout: "Paid to the owner",
  renter_refund: "Refunded to the renter",
};

const auditLabels: Record<string, string> = {
  "payment.dispute_resolved": "Dispute decided",
  "payment.payout_recorded": "Owner payout recorded",
  "payment.refund_recorded": "Refund recorded",
  "payment.refund_taken_over": "Refund taken to do by hand",
  "payment.payout_account_viewed": "Bank details viewed",
};

function refundStatus(dispatch: string | null, reason: string | null, refundId: string | null) {
  if (dispatch === "claimed") return "Being sent to Paystack";
  if (dispatch === "submitted") return `Accepted by Paystack${refundId ? ` (refund ${refundId})` : ""}, waiting for it to complete`;
  if (dispatch === "manual") return `Needs a person: ${manualRefundReason(reason)}`;
  return "Waiting to be sent to Paystack";
}

export default async function AdminDepositPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await getAdminDeposit(id);
  if (!record) notFound();
  const { deposit, ledger, ledgerBalanceCents, events, audit, payoutAccount } = record;
  const amounts = depositAmounts(deposit);
  const person = (value: typeof deposit.renter, userId: string) => (
    <AdminRowLink href={`/admin/users/${userId}`}>{value?.full_name || value?.email || "Unknown"}</AdminRowLink>
  );

  return (
    <>
      <BackLink href="/admin/payments">Payments</BackLink>
      <AdminHeader
        title={`${formatCents(deposit.amount_cents)} deposit`}
        description={`${deposit.listingTitle ?? "Listing removed"} · move-in ${deposit.move_in_date}`}
        action={<StatusBadge tone={deposit.state === "disputed" ? "warning" : "info"}>{depositStateLabels[deposit.state]}</StatusBadge>}
      />

      <AdminDepositControls
        paymentId={deposit.id}
        panels={adminDepositPanels(deposit)}
        amounts={{
          amountCents: deposit.amount_cents,
          ownerPayoutCents: amounts.ownerPayoutCents,
          renterRefundCents: amounts.renterRefundCents,
          providerFeeCents: deposit.provider_fee_cents,
        }}
        ownerHasBankDetails={Boolean(payoutAccount)}
      />

      <section className="mt-6" aria-labelledby="deposit-details-heading">
        <h2 id="deposit-details-heading" className="mb-3 text-lg font-semibold text-ink">Details</h2>
        <DetailList items={[
          { label: "Listing", value: deposit.listing_id ? <AdminRowLink href={`/admin/listings/${deposit.listing_id}`}>{deposit.listingTitle ?? "Listing"}</AdminRowLink> : "Removed" },
          { label: "Paystack reference", value: <span className="font-mono">{deposit.provider_reference}</span> },
          { label: "Renter", value: person(deposit.renter, deposit.renter_id) },
          { label: "Owner", value: person(deposit.owner, deposit.owner_id) },
          { label: "Paid", value: when(deposit.paid_at) },
          { label: "Move-in date", value: deposit.move_in_date },
          { label: "Commission", value: `${deposit.commission_bps / 100}%: ${formatCents(amounts.commissionCents)}${deposit.commission_cents === null ? " if released" : ""}` },
          { label: "Paystack fee", value: deposit.provider_fee_cents === null ? "Not reported" : formatCents(deposit.provider_fee_cents) },
          { label: "Owner bank", value: payoutAccount ? `${payoutAccount.bank_name}, changed ${when(payoutAccount.updated_at)}` : "No bank details saved" },
          { label: "Refund requested", value: when(deposit.refund_requested_at) },
          ...(deposit.state === "refunding" || deposit.state === "refunded" ? [
            { label: "Cancellation fee kept", value: formatCents(amounts.cancellationFeeCents) },
            { label: "Refund", value: deposit.state === "refunded" ? `Sent, reference ${deposit.refund_reference}` : refundStatus(deposit.refund_dispatch, deposit.refund_manual_reason, deposit.provider_refund_id) },
          ] : []),
          ...(deposit.state === "releasing" || deposit.state === "released" ? [
            { label: "Owner payout", value: deposit.state === "released" ? `${formatCents(amounts.ownerPayoutCents)} sent, reference ${deposit.payout_reference}` : `${formatCents(amounts.ownerPayoutCents)} to send` },
            { label: "Released because", value: deposit.auto_released ? "The renter did not answer after the move-in date" : "The renter confirmed, or an admin decided" },
          ] : []),
        ]} />
      </section>

      <section className="mt-6" aria-labelledby="deposit-ledger-heading">
        <h2 id="deposit-ledger-heading" className="mb-1 text-lg font-semibold text-ink">Money trail</h2>
        <p className="mb-3 text-sm text-muted-foreground">RoomZA still holds {formatCents(ledgerBalanceCents)} of this deposit for the renter or owner.</p>
        <AdminTable headers={["Entry", "Amount", "Reference", "When"]} empty={!ledger.length}>
          {ledger.map((entry) => (
            <tr key={entry.id}>
              <td className="px-4 py-3 font-medium text-ink">{ledgerLabels[entry.kind] ?? entry.kind}</td>
              <td className="px-4 py-3 font-mono">{entry.amount_cents < 0 ? "−" : "+"}{formatCents(Math.abs(entry.amount_cents))}</td>
              <td className="px-4 py-3 font-mono text-xs">{entry.external_reference ?? ""}</td>
              <td className="px-4 py-3 text-muted-foreground">{when(entry.created_at)}</td>
            </tr>
          ))}
        </AdminTable>
      </section>

      {events.length ? (
        <section className="mt-6" aria-labelledby="deposit-events-heading">
          <h2 id="deposit-events-heading" className="mb-3 text-lg font-semibold text-ink">Paystack notifications</h2>
          <AdminTable headers={["Event", "Result", "Received", "Review"]}>
            {events.map((event) => (
              <tr key={event.id}>
                <td className="px-4 py-3">{event.kind}</td>
                <td className="px-4 py-3">{event.outcome === "applied" ? "Applied" : providerEventReason(event.reason)}</td>
                <td className="px-4 py-3 text-muted-foreground">{when(event.received_at)}</td>
                <td className="px-4 py-3">
                  {event.outcome !== "needs_review" ? null
                    : event.reviewed_at ? <span className="text-sm text-muted-foreground">Settled {when(event.reviewed_at)}: {event.review_note}</span>
                      : <ProviderEventReview eventId={event.id} />}
                </td>
              </tr>
            ))}
          </AdminTable>
        </section>
      ) : null}

      <section className="mt-6" aria-labelledby="deposit-audit-heading">
        <h2 id="deposit-audit-heading" className="mb-3 text-lg font-semibold text-ink">Admin actions</h2>
        <AdminTable headers={["Action", "By", "Reason", "When"]} empty={!audit.length}>
          {audit.map((entry) => (
            <tr key={entry.id}>
              <td className="px-4 py-3 font-medium text-ink">{auditLabels[entry.action_key] ?? entry.action_key}</td>
              <td className="px-4 py-3">{entry.actor_id ? <AdminRowLink href={`/admin/users/${entry.actor_id}`}>Admin</AdminRowLink> : "System"}</td>
              <td className="px-4 py-3 text-muted-foreground">{entry.reason ?? ""}</td>
              <td className="px-4 py-3 text-muted-foreground">{when(entry.created_at)}</td>
            </tr>
          ))}
        </AdminTable>
      </section>
    </>
  );
}
