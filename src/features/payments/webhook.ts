/**
 * Paystack webhook handling for deposits. The route in
 * src/app/api/payments/paystack/webhook/route.ts only wires this to the request.
 *
 * Only this path can mark a deposit paid, and only after the signature matches
 * and Paystack itself confirms the transaction. The amount and currency that
 * reach the database are the ones Paystack reports on verification, never the
 * ones in the event.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { logger } from "@/lib/logger";

import { PaystackError, parsePaystackEvent, verifyPaystackSignature, type PaystackClient } from "./paystack";

/** Every deposit reference starts with this (see pinpoint_deposit_start). */
const DEPOSIT_REFERENCE_PREFIX = "dep_";

export type ChargeOutcome = "applied" | "needs_review";
export type RefundOutcome = "recorded" | "not_awaiting" | "unknown_reference";

export interface DepositWebhookStore {
  recordCharge(input: {
    reference: string;
    eventKey: string;
    amountCents: number;
    currency: string;
    feeCents: number | null;
    payload: Record<string, unknown>;
  }): Promise<{ outcome: ChargeOutcome; reason: string | null; duplicate: boolean }>;
  recordProviderRefund(input: { transactionReference: string; refundReference: string }): Promise<RefundOutcome>;
}

export type WebhookResult =
  | { status: 200; outcome: "ignored" | ChargeOutcome | RefundOutcome }
  | { status: 400 | 401 | 500 | 502 | 503; code: "bad_request" | "unauthorized" | "server_error" | "service_unavailable"; message: string };

/**
 * Status codes matter: Paystack retries anything that is not 200, so a
 * temporary failure (Paystack or the database unreachable) answers 5xx and the
 * event comes back later. Events RoomZA does not act on answer 200 so they stop.
 */
export async function handlePaystackWebhook(
  input: { rawBody: string; signature: string | null },
  deps: { secretKey: string | undefined; paystack: Pick<PaystackClient, "verifyTransaction">; store: DepositWebhookStore },
): Promise<WebhookResult> {
  if (!deps.secretKey) {
    return { status: 503, code: "service_unavailable", message: "Payments are not configured." };
  }
  if (!(await verifyPaystackSignature(input.rawBody, input.signature, deps.secretKey))) {
    return { status: 401, code: "unauthorized", message: "Invalid signature." };
  }
  const event = parsePaystackEvent(input.rawBody);
  if (!event) {
    return { status: 400, code: "bad_request", message: "Unreadable event." };
  }

  if (event.kind === "charge_success") {
    if (!event.reference.startsWith(DEPOSIT_REFERENCE_PREFIX)) return { status: 200, outcome: "ignored" };
    return recordVerifiedCharge(event.reference, deps);
  }

  if (event.kind === "refund_processed") {
    if (!event.transactionReference.startsWith(DEPOSIT_REFERENCE_PREFIX)) return { status: 200, outcome: "ignored" };
    let outcome: RefundOutcome;
    try {
      outcome = await deps.store.recordProviderRefund({
        transactionReference: event.transactionReference,
        refundReference: event.refundReference,
      });
    } catch (error) {
      logger.error("Deposit refund could not be recorded", { reference: event.transactionReference, error });
      return { status: 500, code: "server_error", message: "Could not record the refund." };
    }
    if (outcome !== "recorded") {
      // A refund made outside RoomZA (for example from the Paystack dashboard)
      // still moved money; an admin needs to reconcile it.
      logger.warn("Paystack refund does not match a deposit awaiting refund", {
        reference: event.transactionReference, refundReference: event.refundReference, outcome,
      });
    }
    return { status: 200, outcome };
  }

  return { status: 200, outcome: "ignored" };
}

async function recordVerifiedCharge(
  reference: string,
  deps: { paystack: Pick<PaystackClient, "verifyTransaction">; store: DepositWebhookStore },
): Promise<WebhookResult> {
  let verified;
  try {
    verified = await deps.paystack.verifyTransaction(reference);
  } catch (error) {
    logger.warn("Deposit charge verification failed; Paystack will retry", {
      reference, kind: error instanceof PaystackError ? error.kind : "unknown",
      status: error instanceof PaystackError ? error.status : undefined,
    });
    return { status: 502, code: "service_unavailable", message: "Could not verify the charge." };
  }

  if (verified.reference !== reference) {
    logger.error("Paystack verified a different transaction than the event named", {
      reference, verifiedReference: verified.reference,
    });
    return { status: 200, outcome: "ignored" };
  }
  if (verified.status !== "success") {
    logger.info("Deposit charge event did not verify as successful", { reference, status: verified.status });
    return { status: 200, outcome: "ignored" };
  }
  if (verified.feeCents === null) {
    logger.warn("Paystack did not report a processing fee; a cancellation will keep no fee", { reference });
  }

  let recorded;
  try {
    recorded = await deps.store.recordCharge({
      reference,
      // Paystack's transaction id is stable across redeliveries of the same charge.
      eventKey: `charge:${verified.id}`,
      amountCents: verified.amountCents,
      currency: verified.currency,
      feeCents: verified.feeCents,
      // Only the facts about the money; no customer or card details.
      payload: {
        id: verified.id, reference: verified.reference, status: verified.status, amount: verified.amountCents,
        currency: verified.currency, fees: verified.feeCents, channel: verified.channel, paidAt: verified.paidAt,
      },
    });
  } catch (error) {
    logger.error("Deposit charge could not be recorded", { reference, error });
    return { status: 500, code: "server_error", message: "Could not record the charge." };
  }

  if (recorded.outcome === "needs_review") {
    logger.warn("Deposit charge needs review", { reference, reason: recorded.reason, duplicate: recorded.duplicate });
  }
  return { status: 200, outcome: recorded.outcome };
}

const chargeResult = z.object({
  outcome: z.enum(["applied", "needs_review"]),
  reason: z.string().nullable(),
  duplicate: z.boolean(),
});

/** Backs the store with the service-role database functions. */
export function createDepositWebhookStore(client: SupabaseClient): DepositWebhookStore {
  return {
    async recordCharge(input) {
      const { data, error } = await client.rpc("pinpoint_deposit_record_charge", {
        target_reference: input.reference,
        charge_event_key: input.eventKey,
        paid_amount_cents: input.amountCents,
        paid_currency: input.currency,
        fee_cents: input.feeCents,
        event_payload: input.payload,
      });
      if (error) throw new Error(`pinpoint_deposit_record_charge failed: ${error.code ?? "unknown"}`);
      const parsed = chargeResult.parse(data);
      return { outcome: parsed.outcome, reason: parsed.reason, duplicate: parsed.duplicate };
    },

    async recordProviderRefund(input) {
      const { data: payment, error: lookupError } = await client
        .from("payments")
        .select("id")
        .eq("provider_reference", input.transactionReference)
        .maybeSingle();
      if (lookupError) throw new Error(`Deposit lookup failed: ${lookupError.code ?? "unknown"}`);
      if (!payment) return "unknown_reference";

      const { error } = await client.rpc("pinpoint_deposit_record_refund", {
        target_payment_id: (payment as { id: string }).id,
        external_reference: `paystack:${input.refundReference}`,
      });
      if (error?.code === "PT409") return "not_awaiting";
      if (error) throw new Error(`pinpoint_deposit_record_refund failed: ${error.code ?? "unknown"}`);
      return "recorded";
    },
  };
}
