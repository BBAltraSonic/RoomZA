"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAdminMutation } from "@/features/admin/use-admin-mutation";

import {
  markPaymentEventReviewed,
  recordManualRefund,
  recordOwnerPayout,
  resolveDepositDispute,
  revealOwnerPayoutAccount,
  takeDepositRefund,
  type RevealedPayoutAccount,
} from "./admin-actions";
import type { AdminDepositPanels } from "./admin-view";
import { formatCents } from "./deposit-view";

const panel = "rounded-xl border border-border bg-panel p-4";
const dateTime = new Intl.DateTimeFormat("en-ZA", {
  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg",
});

export type AdminDepositControlsProps = {
  paymentId: string;
  panels: AdminDepositPanels;
  amounts: { amountCents: number; ownerPayoutCents: number; renterRefundCents: number; providerFeeCents: number | null };
  ownerHasBankDetails: boolean;
};

export function AdminDepositControls({ paymentId, panels, amounts, ownerHasBankDetails }: AdminDepositControlsProps) {
  if (!Object.values(panels).some(Boolean)) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {panels.dispute ? <DisputeDecision paymentId={paymentId} amounts={amounts} /> : null}
      {panels.payout ? <OwnerPayout paymentId={paymentId} payoutCents={amounts.ownerPayoutCents} ownerHasBankDetails={ownerHasBankDetails} /> : null}
      {panels.takeRefund ? <TakeRefund paymentId={paymentId} refundCents={amounts.renterRefundCents} /> : null}
      {panels.recordRefund ? <RecordRefund paymentId={paymentId} refundCents={amounts.renterRefundCents} /> : null}
    </div>
  );
}

function DisputeDecision({ paymentId, amounts }: Pick<AdminDepositControlsProps, "paymentId" | "amounts">) {
  const [resolution, setResolution] = useState<"release" | "refund" | null>(null);
  const [waive, setWaive] = useState(false);
  const [reason, setReason] = useState("");
  const { pending, run } = useAdminMutation();
  const fee = amounts.providerFeeCents ?? 0;
  const refundCents = waive ? amounts.amountCents : amounts.amountCents - Math.min(fee, amounts.amountCents);
  const outcome = resolution === "release"
    ? `The owner is paid ${formatCents(amounts.ownerPayoutCents)} after RoomZA's commission.`
    : resolution === "refund"
      ? `The renter gets ${formatCents(refundCents)} back${waive || fee === 0 ? "" : `; RoomZA keeps the ${formatCents(fee)} card fee`}.`
      : null;

  return (
    <section className={panel}>
      <h2 className="font-semibold text-ink">Decide the dispute</h2>
      <p className="mt-1 text-sm text-muted-foreground">The renter asked for a refund and the owner says they moved in. Both are told the decision.</p>
      <fieldset className="mt-4 grid gap-2">
        <legend className="sr-only">Where the deposit goes</legend>
        {([["release", "The renter moved in: pay the owner"], ["refund", "The renter did not move in: refund them"]] as const).map(([value, label]) => (
          <label key={value} className="flex min-h-11 items-center gap-3 rounded-md border border-border px-3 text-sm font-medium text-ink has-[:checked]:border-forest has-[:checked]:bg-accent">
            <input type="radio" name={`resolution-${paymentId}`} value={value} checked={resolution === value} onChange={() => setResolution(value)} />
            {label}
          </label>
        ))}
      </fieldset>
      {resolution === "refund" && fee > 0 ? (
        <label className="mt-3 flex items-start gap-3 text-sm text-ink">
          <input type="checkbox" className="mt-1" checked={waive} onChange={(event) => setWaive(event.target.checked)} />
          <span>Waive the {formatCents(fee)} cancellation fee. RoomZA then carries the card fee, for example when the listing was misleading.</span>
        </label>
      ) : null}
      <label className="mt-3 block text-xs font-semibold text-muted-foreground">
        Reason, kept in the audit log
        <Textarea className="mt-1" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="What the evidence showed" />
      </label>
      {outcome ? <p className="mt-3 text-sm font-medium text-ink">{outcome}</p> : null}
      <Button
        className="mt-3"
        disabled={pending || !resolution || reason.trim().length < 10}
        onClick={() => resolution && run(
          () => resolveDepositDispute({ paymentId, resolution, waiveCancellationFee: waive, reason }),
          resolution === "release" ? "Owner payout queued" : "Refund started",
        )}
      >
        Confirm decision
      </Button>
    </section>
  );
}

function OwnerPayout({ paymentId, payoutCents, ownerHasBankDetails }: { paymentId: string; payoutCents: number; ownerHasBankDetails: boolean }) {
  const [account, setAccount] = useState<RevealedPayoutAccount | null>(null);
  const [revealing, startReveal] = useTransition();
  const [reference, setReference] = useState("");
  const { pending, run } = useAdminMutation();

  function reveal() {
    startReveal(async () => {
      const result = await revealOwnerPayoutAccount(paymentId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setAccount(result.data);
    });
  }

  return (
    <section className={panel}>
      <h2 className="font-semibold text-ink">Pay the owner {formatCents(payoutCents)}</h2>
      <p className="mt-1 text-sm text-muted-foreground">Make the bank transfer, then record its reference. The owner is told it was sent.</p>
      {!ownerHasBankDetails ? (
        <p className="mt-3 rounded-md border border-status-warning-border bg-status-warning-surface p-3 text-sm text-status-warning-text">
          The owner has no bank details saved. Ask them to add them at Settings, Payouts.
        </p>
      ) : account ? (
        <div className="mt-3 rounded-md border border-border p-3">
          {account.changedAfterPayment ? (
            <p role="alert" className="mb-3 rounded-md border border-status-error-border bg-status-error-surface p-2 text-sm font-medium text-status-error-text">
              These bank details changed on {dateTime.format(new Date(account.updatedAt))}, after the renter paid. Confirm them with the owner by phone before sending money.
            </p>
          ) : null}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Account holder</dt><dd className="font-medium text-ink">{account.accountHolder}</dd>
            <dt className="text-muted-foreground">Bank</dt><dd className="font-medium text-ink">{account.bankName}</dd>
            <dt className="text-muted-foreground">Branch code</dt><dd className="font-mono text-ink">{account.branchCode}</dd>
            <dt className="text-muted-foreground">Account number</dt><dd className="font-mono text-ink">{account.accountNumber}</dd>
            <dt className="text-muted-foreground">Amount</dt><dd className="font-semibold text-ink">{formatCents(account.payoutCents)}</dd>
          </dl>
        </div>
      ) : (
        <Button className="mt-3" variant="outline" disabled={revealing} onClick={reveal}>
          Show bank details
        </Button>
      )}
      <p className="mt-2 text-xs text-muted-foreground">Showing the bank details is recorded in the audit log.</p>
      <label className="mt-3 block text-xs font-semibold text-muted-foreground">
        Bank reference of the transfer
        <Input className="mt-1" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="For example EFT-20261201-01" />
      </label>
      <Button
        className="mt-3"
        disabled={pending || !reference.trim()}
        onClick={() => run(() => recordOwnerPayout({ paymentId, bankReference: reference }), "Payout recorded")}
      >
        Record payout sent
      </Button>
    </section>
  );
}

function TakeRefund({ paymentId, refundCents }: { paymentId: string; refundCents: number }) {
  const { pending, run } = useAdminMutation();
  return (
    <section className={panel}>
      <h2 className="font-semibold text-ink">Refund {formatCents(refundCents)} not sent</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Nothing has sent this refund to Paystack. Check that Paystack is configured and the sweep is running. To refund by bank transfer instead, take it off the automatic path first, so it is never sent twice.
      </p>
      <Button className="mt-3" variant="outline" disabled={pending} onClick={() => run(() => takeDepositRefund(paymentId), "Refund moved to the manual queue")}>
        Refund it by hand
      </Button>
    </section>
  );
}

function RecordRefund({ paymentId, refundCents }: { paymentId: string; refundCents: number }) {
  const [reference, setReference] = useState("");
  const { pending, run } = useAdminMutation();
  return (
    <section className={panel}>
      <h2 className="font-semibold text-ink">Refund {formatCents(refundCents)} by hand</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Check the Paystack dashboard: if a refund for this reference exists, wait for it instead.</li>
        <li>Otherwise refund on Paystack when the balance allows (the webhook records it), or ask the renter for bank details and transfer it.</li>
        <li>For a bank transfer, record its reference here. The renter is told it was sent.</li>
      </ol>
      <label className="mt-3 block text-xs font-semibold text-muted-foreground">
        Bank reference of the refund
        <Input className="mt-1" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="For example EFT-20261201-02" />
      </label>
      <Button
        className="mt-3"
        disabled={pending || !reference.trim()}
        onClick={() => run(() => recordManualRefund({ paymentId, reference }), "Refund recorded")}
      >
        Record refund sent
      </Button>
    </section>
  );
}

/** Clear a charge Paystack confirmed that RoomZA could not apply to a deposit. */
export function ProviderEventReview({ eventId }: { eventId: string }) {
  const [note, setNote] = useState("");
  const { pending, run } = useAdminMutation();
  return (
    <div className="flex min-w-72 flex-col gap-2 sm:flex-row">
      <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="What was done, e.g. refunded on Paystack" aria-label="What was done about this payment" />
      <Button size="sm" variant="outline" disabled={pending || note.trim().length < 10} onClick={() => run(() => markPaymentEventReviewed({ eventId, note }), "Marked as settled")}>
        Mark settled
      </Button>
    </div>
  );
}
