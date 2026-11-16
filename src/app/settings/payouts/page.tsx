import type { Metadata } from "next";

import { getOwnerPayoutAccount } from "@/features/payments/deposit-data";
import { PayoutAccountForm } from "@/features/payments/payout-account-form";
import { requirePersona } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Payouts",
  robots: { index: false, follow: false },
};

export default async function PayoutSettingsPage() {
  const { user } = await requirePersona("landlord", { redirectTo: "/settings/payouts" });
  const account = await getOwnerPayoutAccount(user.id);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">Payouts</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Where we pay deposits</h2>
        <p className="mt-3 max-w-[65ch] text-sm leading-6 text-muted-foreground">
          When a renter pays a deposit through RoomZA, we hold it until they move in, keep our 10% commission
          and transfer the rest to this account. Only the last four digits are ever shown.
        </p>
      </header>
      <PayoutAccountForm initial={account} />
    </div>
  );
}
