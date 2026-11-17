import type { ReactNode } from "react";
import Link from "next/link";
import { WalletCards } from "lucide-react";

/** Whether the listing's owner has saved the bank account deposits are paid into. */
export type ListingPayoutAccountState = "ready" | "missing" | "other_owner";

const linkClass = "font-semibold text-forest underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Shown under the deposit field: how a published deposit becomes one renters pay through RoomZA. */
export function ListingDepositNote({ payoutAccount }: { payoutAccount?: ListingPayoutAccountState }) {
  let body: ReactNode;
  if (payoutAccount === "ready") {
    body = "Approved renters can pay this deposit through RoomZA. We hold it until they move in, then pay it to you less our commission.";
  } else if (payoutAccount === "missing") {
    body = (
      <>
        Let approved renters pay this deposit through RoomZA: we hold it until they move in, then pay it to you less our commission.{" "}
        <Link href="/settings/payouts" className={linkClass}>Add bank details</Link>
      </>
    );
  } else if (payoutAccount === "other_owner") {
    body = "Once the listing owner adds bank details, approved renters can pay this deposit through RoomZA, which holds it until they move in.";
  } else {
    body = (
      <>
        With a deposit amount and your bank details, approved renters can pay the deposit through RoomZA, which holds it until they move in.{" "}
        <Link href="/settings/payouts" className={linkClass}>Set up payouts</Link>
      </>
    );
  }

  return (
    <p className="mt-5 flex gap-2 rounded-md border border-border bg-warm-surface p-3 text-xs leading-5 text-muted-foreground sm:text-sm">
      <WalletCards className="mt-0.5 size-4 shrink-0 text-forest" aria-hidden="true" />
      <span>{body}</span>
    </p>
  );
}
