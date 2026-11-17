"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { requireAdmin } from "@/features/admin/auth";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/action-result";
import { logger } from "@/lib/logger";
import { createUntypedClient } from "@/lib/supabase/admin";

import { depositIdSchema, depositStateResultSchema } from "./schemas";
import { sendRefundNow } from "./send-refund";

/*
 * What admins do with deposits: decide disputes, pay owners, finish refunds
 * Paystack could not, and settle charges that arrived without a deposit. The
 * database functions check the admin again, enforce the state rules and write
 * the audit log; these actions validate input and explain refusals.
 */


const disputeSchema = z.object({
  paymentId: depositIdSchema,
  resolution: z.enum(["release", "refund"]),
  waiveCancellationFee: z.boolean(),
  reason: z.string().trim().min(10, "Give a reason of at least 10 characters.").max(2000),
});
const payoutSchema = z.object({ paymentId: depositIdSchema, bankReference: z.string().trim().min(1).max(200) });
const manualRefundSchema = z.object({ paymentId: depositIdSchema, reference: z.string().trim().min(1).max(190) });
const eventReviewSchema = z.object({
  eventId: depositIdSchema,
  note: z.string().trim().min(10, "Say what was done, in at least 10 characters.").max(2000),
});

const payoutAccountSchema = z.object({
  accountHolder: z.string(),
  bankName: z.string(),
  branchCode: z.string(),
  accountNumber: z.string(),
  updatedAt: z.string(),
  changedAfterPayment: z.boolean(),
  payoutCents: z.number().int(),
});
export type RevealedPayoutAccount = z.infer<typeof payoutAccountSchema>;

const refusals: Record<string, string> = {
  "Deposit is not in dispute": "This deposit is no longer in dispute.",
  "Deposit is not awaiting an owner payout": "This deposit is not waiting for an owner payout.",
  "Deposit is not awaiting a refund": "This deposit is not waiting for a refund.",
  "Refund is not marked for manual handling": "Take this refund to handle by hand before recording a bank transfer.",
  "The refund is being sent to Paystack":
    "This refund is being sent to Paystack. If nothing changes in ten minutes it moves to the manual queue.",
  "Paystack has accepted this refund": "Paystack accepted this refund. Wait for it to complete on Paystack.",
  "The owner has no bank details": "The owner has not saved bank details. Ask them to add them at Settings, Payouts.",
  "Payment event does not need review": "This payment does not need review.",
};

const TRY_AGAIN = "That did not work. Refresh the page and try again.";

async function requestId() {
  const requestHeaders = await headers();
  return requestHeaders.get("x-request-id") ?? requestHeaders.get("cf-ray") ?? randomUUID();
}

function refreshPayment(paymentId: string | null) {
  revalidatePath("/admin/payments");
  if (paymentId) revalidatePath(`/admin/payments/${paymentId}`);
}

type RpcError = { code?: string; message?: string };

function explain(rpc: string, error: RpcError): ActionResult<never> {
  if (error.code === "42501") return actionFailure("This record is unavailable.");
  if (error.code === "PT409") return actionFailure(refusals[error.message ?? ""] ?? TRY_AGAIN);
  if (error.code === "22023") return actionFailure("Check the details you entered.");
  logger.error("Admin payment action failed", { rpc, code: error.code });
  return actionFailure(TRY_AGAIN);
}

async function runStateRpc(
  rpc: string,
  args: Record<string, unknown>,
  paymentId: string,
): Promise<ActionResult<{ state: string }>> {
  const { data, error } = await createUntypedClient().rpc(rpc, args);
  if (error) return explain(rpc, error);
  const parsed = depositStateResultSchema.safeParse(data);
  if (!parsed.success) {
    logger.error("Admin payment action returned an unexpected shape", { rpc, paymentId });
    return actionFailure(TRY_AGAIN);
  }
  refreshPayment(paymentId);
  return actionSuccess({ state: parsed.data.state });
}

/** Decide a dispute: the deposit goes to the owner, or back to the renter (optionally without the fee). */
export async function resolveDepositDispute(input: unknown): Promise<ActionResult<{ state: string }>> {
  const parsed = disputeSchema.safeParse(input);
  if (!parsed.success) return actionFailure(parsed.error.issues[0]?.message ?? "Check the decision.");
  const { user } = await requireAdmin();
  const { paymentId, resolution, waiveCancellationFee, reason } = parsed.data;
  const result = await runStateRpc("pinpoint_deposit_resolve_dispute", {
    actor: user.id,
    target_payment_id: paymentId,
    resolution,
    waive_cancellation_fee: resolution === "refund" && waiveCancellationFee,
    action_reason: reason,
    audit_request_id: await requestId(),
  }, paymentId);
  if (result.success && result.data.state === "refunding") await sendRefundNow(paymentId);
  return result;
}

/** The owner's full bank details for the payout transfer. Every view is audited. */
export async function revealOwnerPayoutAccount(paymentId: string): Promise<ActionResult<RevealedPayoutAccount>> {
  const target = depositIdSchema.safeParse(paymentId);
  if (!target.success) return actionFailure("Invalid deposit.");
  const { user } = await requireAdmin();
  const { data, error } = await createUntypedClient().rpc("pinpoint_owner_payout_account_reveal", {
    actor: user.id, target_payment_id: target.data, audit_request_id: await requestId(),
  });
  if (error) return explain("pinpoint_owner_payout_account_reveal", error);
  const parsed = payoutAccountSchema.safeParse(data);
  if (!parsed.success) {
    // Only the id: the payload holds the account number.
    logger.error("Payout account reveal returned an unexpected shape", { paymentId: target.data });
    return actionFailure(TRY_AGAIN);
  }
  return actionSuccess(parsed.data);
}

/** Record the bank transfer that paid the owner. */
export async function recordOwnerPayout(input: unknown): Promise<ActionResult<{ state: string }>> {
  const parsed = payoutSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Enter the bank reference of the transfer.");
  const { user } = await requireAdmin();
  return runStateRpc("pinpoint_deposit_record_payout", {
    actor: user.id,
    target_payment_id: parsed.data.paymentId,
    bank_reference: parsed.data.bankReference,
    audit_request_id: await requestId(),
  }, parsed.data.paymentId);
}

/** Take a refund nobody has sent yet out of the automatic path, to refund it by bank transfer. */
export async function takeDepositRefund(paymentId: string): Promise<ActionResult<{ state: string }>> {
  const target = depositIdSchema.safeParse(paymentId);
  if (!target.success) return actionFailure("Invalid deposit.");
  const { user } = await requireAdmin();
  return runStateRpc("pinpoint_deposit_take_refund", {
    actor: user.id, target_payment_id: target.data, audit_request_id: await requestId(),
  }, target.data);
}

/** Record a refund made by hand. Only for a refund taken off the automatic path. */
export async function recordManualRefund(input: unknown): Promise<ActionResult<{ state: string }>> {
  const parsed = manualRefundSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Enter the bank reference of the refund.");
  const { user } = await requireAdmin();
  return runStateRpc("pinpoint_deposit_record_refund", {
    target_payment_id: parsed.data.paymentId,
    external_reference: `manual:${parsed.data.reference}`,
    actor: user.id,
    audit_request_id: await requestId(),
  }, parsed.data.paymentId);
}

/** Clear a charge that needed review, saying what was done about the money. */
export async function markPaymentEventReviewed(input: unknown): Promise<ActionResult<undefined>> {
  const parsed = eventReviewSchema.safeParse(input);
  if (!parsed.success) return actionFailure(parsed.error.issues[0]?.message ?? "Say what was done.");
  const { user } = await requireAdmin();
  const { data, error } = await createUntypedClient().rpc("pinpoint_payment_event_mark_reviewed", {
    actor: user.id, target_event_id: parsed.data.eventId, note: parsed.data.note, audit_request_id: await requestId(),
  });
  if (error) return explain("pinpoint_payment_event_mark_reviewed", error);
  const paymentId = z.object({ paymentId: depositIdSchema.nullish() }).safeParse(data);
  refreshPayment(paymentId.success ? paymentId.data.paymentId ?? null : null);
  return actionSuccess(undefined);
}
