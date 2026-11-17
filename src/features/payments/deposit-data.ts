import "server-only";

import { logger } from "@/lib/logger";
import { createUntypedClient } from "@/lib/supabase/admin";

import {
  PAYMENT_COLUMNS,
  toOwnerDepositSetup,
  toOwnerDeposits,
  toRenterDeposits,
  type PaymentRow,
} from "./deposit-records";
import type { OwnerDeposit, OwnerDepositSetup, RenterDeposit } from "./deposit-view";
import { payoutAccountSummarySchema, type PayoutAccountSummary } from "./payout-account";
import { paystackKeyCleared } from "./paystack";

/*
 * The payments tables are reachable only with the service role, so every
 * reader here is given an identity the caller has already authenticated and
 * filters by it. None of them returns bank details beyond the last four digits.
 */

/**
 * Deposits for the signed-in renter's applications. A failed read degrades to
 * no deposit information, which shows the "message the landlord" step.
 */
export async function getRenterDeposits(
  renterId: string,
  applications: { id: string; status: string; listing_id: string }[],
): Promise<Record<string, RenterDeposit>> {
  if (applications.length === 0) return {};
  const admin = createUntypedClient();
  const applicationIds = applications.map((application) => application.id);
  const approvedListingIds = [...new Set(
    applications.filter((application) => application.status === "approved").map((application) => application.listing_id),
  )];

  const [paymentsResult, listingsResult] = await Promise.all([
    admin.from("payments").select(PAYMENT_COLUMNS)
      .eq("renter_id", renterId).in("application_id", applicationIds).neq("state", "cancelled"),
    approvedListingIds.length
      ? admin.from("listings").select("id, deposit_amount, landlord_id")
          .in("id", approvedListingIds).eq("listing_type", "rent")
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (paymentsResult.error || listingsResult.error) {
    logger.error("Renter deposits could not be loaded", {
      renterId, paymentsCode: paymentsResult.error?.code, listingsCode: listingsResult.error?.code,
    });
    return {};
  }

  const listings = (listingsResult.data ?? []) as { id: string; deposit_amount: number | null; landlord_id: string }[];
  const landlordIds = [...new Set(listings.map((listing) => listing.landlord_id))];
  const payoutResult = landlordIds.length
    ? await admin.from("owner_payout_accounts").select("owner_id").in("owner_id", landlordIds)
    : { data: [], error: null };
  if (payoutResult.error) {
    logger.error("Owner payout readiness could not be loaded", { renterId, code: payoutResult.error.code });
  }

  return toRenterDeposits({
    applications,
    payments: (paymentsResult.data ?? []) as PaymentRow[],
    listings,
    payoutOwnerIds: ((payoutResult.data ?? []) as { owner_id: string }[]).map((row) => row.owner_id),
  });
}

/**
 * Deposits on one listing, for whoever manages it. The caller must already
 * have checked that the signed-in user may manage `listing`.
 */
export async function getListingDeposits(
  listing: { id: string; landlord_id: string; listing_type: string | null; deposit_amount: number | null },
  applicationIds: string[],
): Promise<{ deposits: Record<string, OwnerDeposit>; setup: OwnerDepositSetup }> {
  const admin = createUntypedClient();
  const [paymentsResult, payoutResult] = await Promise.all([
    applicationIds.length
      ? admin.from("payments").select(PAYMENT_COLUMNS)
          .eq("listing_id", listing.id).in("application_id", applicationIds).neq("state", "cancelled")
      : Promise.resolve({ data: [], error: null }),
    admin.from("owner_payout_accounts").select("owner_id").eq("owner_id", listing.landlord_id).maybeSingle(),
  ]);
  if (paymentsResult.error || payoutResult.error) {
    logger.error("Listing deposits could not be loaded", {
      listingId: listing.id, paymentsCode: paymentsResult.error?.code, payoutCode: payoutResult.error?.code,
    });
  }
  return {
    deposits: toOwnerDeposits((paymentsResult.data ?? []) as PaymentRow[]),
    // An unknown payout state is shown as "off" rather than asking for bank details already given.
    setup: payoutResult.error ? { kind: "off" } : toOwnerDepositSetup(listing, Boolean(payoutResult.data)),
  };
}

/**
 * Whether approved renters can pay this listing's deposit through RoomZA: a
 * rental with a published deposit, an owner with bank details, and Paystack
 * cleared for the key in use. Any doubt reads as no, so the listing never
 * promises a held deposit it cannot take.
 */
export async function listingTakesDepositsOnline(
  listing: { landlord_id: string; listing_type: string | null; deposit_amount: number | null },
): Promise<boolean> {
  if (toOwnerDepositSetup(listing, true).kind !== "ready") return false;
  if (!paystackKeyCleared(process.env.PAYSTACK_SECRET_KEY, process.env.PAYSTACK_LIVE_PAYMENTS)) return false;
  const { data, error } = await createUntypedClient().from("owner_payout_accounts")
    .select("owner_id").eq("owner_id", listing.landlord_id).maybeSingle();
  if (error) {
    logger.warn("Deposit payout readiness could not be read for a listing", { code: error.code });
    return false;
  }
  return Boolean(data);
}

/** The owner's saved payout account, masked; null when none is saved. Throws when it cannot be read. */
export async function getOwnerPayoutAccount(ownerId: string): Promise<PayoutAccountSummary | null> {
  const { data, error } = await createUntypedClient().rpc("pinpoint_owner_payout_account_get", { actor_id: ownerId });
  if (error) {
    logger.error("Owner payout account could not be loaded", { ownerId, code: error.code });
    throw new Error("Your bank details could not be loaded. Refresh to try again.");
  }
  if (data === null) return null;
  const parsed = payoutAccountSummarySchema.safeParse(data);
  if (!parsed.success) {
    logger.error("Owner payout account read returned an unexpected shape", { ownerId });
    throw new Error("Your bank details could not be loaded. Refresh to try again.");
  }
  return parsed.data;
}
