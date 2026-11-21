import "server-only";

import * as z from "@/lib/zod";

import { requireAdmin } from "@/features/admin/auth";
import { createUntypedClient } from "@/lib/supabase/admin";

import {
  depositQueueKind,
  heldForOthersCents,
  type AdminDepositRow,
  type DepositQueueKind,
} from "./admin-view";
import { depositIdSchema } from "./schemas";
import { DEPOSIT_STATES, type DepositState } from "./states";

/*
 * Reads for the admin payments pages. Every reader checks the admin first.
 * Bank account numbers are never read here: the payout panel asks for them
 * through an audited function, one deposit at a time.
 */

const PAYMENT_COLUMNS = [
  "id", "application_id", "listing_id", "renter_id", "owner_id", "state", "amount_cents", "commission_bps",
  "commission_cents", "provider_fee_cents", "cancellation_fee_cents", "move_in_date", "provider_reference",
  "refund_requested_at", "refund_dispatch", "refund_dispatched_at", "provider_refund_id", "refund_manual_reason",
  "auto_released", "payout_reference", "refund_reference", "created_at", "paid_at", "disputed_at",
  "release_started_at", "released_at", "refund_started_at", "refunded_at", "cancelled_at",
].join(", ");

const PARTIES =
  "listing:listings(title), renter:profiles!payments_renter_id_fkey(full_name, email), owner:profiles!payments_owner_id_fkey(full_name, email)";

type Person = { full_name: string | null; email: string | null };

export type AdminDeposit = AdminDepositRow & {
  id: string;
  application_id: string | null;
  listing_id: string | null;
  renter_id: string;
  owner_id: string;
  provider_fee_cents: number | null;
  move_in_date: string;
  provider_reference: string;
  refund_requested_at: string | null;
  refund_dispatched_at: string | null;
  provider_refund_id: string | null;
  auto_released: boolean;
  payout_reference: string | null;
  refund_reference: string | null;
  created_at: string;
  paid_at: string | null;
  disputed_at: string | null;
  release_started_at: string | null;
  released_at: string | null;
  refunded_at: string | null;
  cancelled_at: string | null;
  listingTitle: string | null;
  renter: Person | null;
  owner: Person | null;
};

type RawDeposit = Omit<AdminDeposit, "listingTitle" | "renter" | "owner"> & {
  listing?: { title: string | null } | { title: string | null }[] | null;
  renter?: Person | Person[] | null;
  owner?: Person | Person[] | null;
};

function single<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function toDeposit(raw: RawDeposit): AdminDeposit {
  const { listing, renter, owner, ...payment } = raw;
  return {
    ...payment,
    amount_cents: Number(payment.amount_cents),
    commission_cents: payment.commission_cents === null ? null : Number(payment.commission_cents),
    provider_fee_cents: payment.provider_fee_cents === null ? null : Number(payment.provider_fee_cents),
    cancellation_fee_cents: payment.cancellation_fee_cents === null ? null : Number(payment.cancellation_fee_cents),
    listingTitle: single(listing)?.title ?? null,
    renter: single(renter),
    owner: single(owner),
  };
}

export type ProviderEventForReview = {
  id: string;
  payment_id: string | null;
  kind: string;
  reason: string | null;
  payload: Record<string, unknown>;
  received_at: string;
};

export type DepositQueueItem = { kind: DepositQueueKind; deposit: AdminDeposit; since: string };

const queueOrder: DepositQueueKind[] = ["refund_not_sent", "manual_refund", "dispute", "owner_payout"];

function queueSince(deposit: AdminDeposit, kind: DepositQueueKind): string {
  if (kind === "dispute") return deposit.disputed_at ?? deposit.created_at;
  if (kind === "owner_payout") return deposit.release_started_at ?? deposit.created_at;
  return deposit.refund_started_at ?? deposit.created_at;
}

/** Everything open: what RoomZA holds, and the work waiting on a person, oldest first within each kind. */
export async function getAdminPaymentsOverview(now = new Date()) {
  await requireAdmin();
  const admin = createUntypedClient();
  const [paymentsResult, eventsResult] = await Promise.all([
    admin.from("payments").select(`${PAYMENT_COLUMNS}, ${PARTIES}`)
      .in("state", ["awaiting_payment", "held", "disputed", "releasing", "refunding"])
      .order("created_at", { ascending: true })
      .limit(1000),
    admin.from("payment_provider_events").select("id, payment_id, kind, reason, payload, received_at")
      .eq("outcome", "needs_review").is("reviewed_at", null)
      .order("received_at", { ascending: true })
      .limit(100),
  ]);
  if (paymentsResult.error || eventsResult.error) throw new Error("Unable to load payments.");

  const open = ((paymentsResult.data ?? []) as unknown as RawDeposit[]).map(toDeposit);
  const queue = open
    .map((deposit) => ({ deposit, kind: depositQueueKind(deposit, now) }))
    .filter((item): item is { deposit: AdminDeposit; kind: DepositQueueKind } => item.kind !== null)
    .map(({ deposit, kind }) => ({ kind, deposit, since: queueSince(deposit, kind) }))
    .sort((a, b) => queueOrder.indexOf(a.kind) - queueOrder.indexOf(b.kind) || a.since.localeCompare(b.since));

  const count = (kind: DepositQueueKind) => queue.filter((item) => item.kind === kind).length;
  return {
    heldCents: open.reduce((sum, deposit) => sum + heldForOthersCents(deposit), 0),
    heldCount: open.filter((deposit) => heldForOthersCents(deposit) > 0).length,
    awaitingPaymentCount: open.filter((deposit) => deposit.state === "awaiting_payment").length,
    payoutsDue: {
      count: count("owner_payout"),
      cents: queue.filter((item) => item.kind === "owner_payout")
        .reduce((sum, item) => sum + heldForOthersCents(item.deposit), 0),
    },
    refundsForPerson: count("manual_refund") + count("refund_not_sent"),
    disputes: count("dispute"),
    queue,
    eventsToReview: (eventsResult.data ?? []) as ProviderEventForReview[],
  };
}

const stateFilter = z.enum(DEPOSIT_STATES).optional().catch(undefined);

/** Every deposit, newest first, filtered by state or by payment id / Paystack reference. */
export async function listAdminDeposits(params: { status?: string; q?: string; cursor?: string }) {
  await requireAdmin();
  let query = createUntypedClient().from("payments").select(`${PAYMENT_COLUMNS}, ${PARTIES}`)
    .order("created_at", { ascending: false })
    .limit(50);
  const state: DepositState | undefined = stateFilter.parse(params.status || undefined);
  if (state) query = query.eq("state", state);
  const q = params.q?.trim();
  if (q) {
    query = depositIdSchema.safeParse(q).success
      ? query.eq("id", q)
      : query.eq("provider_reference", q.replace(/[^A-Za-z0-9_]/g, ""));
  }
  if (params.cursor && !Number.isNaN(Date.parse(params.cursor))) query = query.lt("created_at", params.cursor);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load deposits.");
  return ((data ?? []) as unknown as RawDeposit[]).map(toDeposit);
}

export type LedgerEntry = { id: string; kind: string; amount_cents: number; external_reference: string | null; created_at: string };
export type PaymentEvent = {
  id: string; kind: string; outcome: string; reason: string | null; received_at: string;
  reviewed_at: string | null; review_note: string | null;
};
export type PaymentAudit = {
  id: string; actor_id: string | null; action_key: string; reason: string | null; metadata: Record<string, unknown>;
  created_at: string;
};

/** One deposit with its money trail, Paystack events and admin decisions. Null when the id matches nothing. */
export async function getAdminDeposit(paymentId: string) {
  await requireAdmin();
  if (!depositIdSchema.safeParse(paymentId).success) return null;
  const admin = createUntypedClient();
  const { data: raw, error } = await admin.from("payments").select(`${PAYMENT_COLUMNS}, ${PARTIES}`)
    .eq("id", paymentId).maybeSingle();
  if (error) throw new Error("Unable to load the deposit.");
  if (!raw) return null;
  const deposit = toDeposit(raw as unknown as RawDeposit);

  const [ledger, events, audit, payoutAccount] = await Promise.all([
    admin.from("payment_ledger_entries").select("id, kind, amount_cents, external_reference, created_at")
      .eq("payment_id", paymentId).order("created_at"),
    admin.from("payment_provider_events").select("id, kind, outcome, reason, received_at, reviewed_at, review_note")
      .eq("payment_id", paymentId).order("received_at"),
    admin.from("admin_audit_events").select("id, actor_id, action_key, reason, metadata, created_at")
      .eq("target_type", "payment").eq("target_id", paymentId).order("created_at"),
    // The bank name and when it last changed; never the account number.
    admin.from("owner_payout_accounts").select("bank_name, updated_at").eq("owner_id", deposit.owner_id).maybeSingle(),
  ]);
  if (ledger.error || events.error || audit.error || payoutAccount.error) throw new Error("Unable to load the deposit.");

  const entries = ((ledger.data ?? []) as LedgerEntry[]).map((entry) => ({ ...entry, amount_cents: Number(entry.amount_cents) }));
  return {
    deposit,
    ledger: entries,
    ledgerBalanceCents: entries.reduce((sum, entry) => sum + entry.amount_cents, 0),
    events: (events.data ?? []) as PaymentEvent[],
    audit: (audit.data ?? []) as PaymentAudit[],
    payoutAccount: payoutAccount.data as { bank_name: string; updated_at: string } | null,
  };
}
