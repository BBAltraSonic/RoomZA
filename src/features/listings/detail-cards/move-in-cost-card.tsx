import { WalletCards } from "lucide-react";

import { StatusBadge } from "@/components/premium/primitives";
import { formatRand, listingMoveInCost } from "@/features/listings/true-monthly-cost";

import type { ListingDetail } from "./types";

/** Every one-off amount due before move-in, so no fee is a surprise at signing. */
export function MoveInCostCard({ listing }: { listing: Pick<ListingDetail, "price" | "deposit_amount" | "admin_fee" | "deposit_online"> }) {
  const cost = listingMoveInCost(listing);
  const fullyDisclosed = cost.depositDisclosed && cost.adminFeeDisclosed;
  const rows = [
    { label: "First month's rent", amount: cost.monthlyRent, note: null },
    { label: "Deposit", amount: cost.deposit, note: cost.depositDisclosed ? null : "Estimate: one month's rent" },
    {
      label: "Lease/admin fee",
      amount: cost.adminFee,
      note: cost.adminFeeDisclosed ? (cost.adminFee === 0 ? "No fee" : null) : "Not stated by lister",
    },
  ];

  return (
    <section aria-labelledby="move-in-cost-heading" className="rounded-xl border border-border bg-warm-surface p-4 sm:rounded-lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <WalletCards className="size-4 text-forest" aria-hidden="true" />
            <h2 id="move-in-cost-heading" className="text-sm font-semibold text-ink">Due before move-in</h2>
          </div>
          <p className="mt-2 text-2xl font-semibold text-ink">{formatRand(cost.total)}</p>
        </div>
        <StatusBadge tone={fullyDisclosed ? "forest" : "neutral"}>{fullyDisclosed ? "Set by lister" : "Partly estimated"}</StatusBadge>
      </div>
      <dl className="mt-4 divide-y divide-border rounded-md border border-border bg-panel">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 px-3 py-2.5">
            <dt className="min-w-0 text-sm font-medium text-ink">
              {row.label}
              {row.note ? <span className="block text-xs font-normal text-muted-foreground">{row.note}</span> : null}
            </dt>
            <dd className="shrink-0 text-sm font-semibold text-ink">{formatRand(row.amount)}</dd>
          </div>
        ))}
      </dl>
      {listing.deposit_online && cost.depositDisclosed ? (
        <p className="mt-3 text-xs leading-5 text-ink">
          Once you&apos;re approved, you pay this deposit through RoomZA. We hold it until you move in. If you cancel, you get it back less the card processing fee.
        </p>
      ) : null}
      {!fullyDisclosed ? (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">Ask the lister to confirm any estimated amount before you pay anything.</p>
      ) : null}
    </section>
  );
}
