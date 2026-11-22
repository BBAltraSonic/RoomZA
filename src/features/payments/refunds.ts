/**
 * Sends deposits that are being refunded to Paystack.
 *
 * Paystack's refund call has no idempotency key, so a refund is sent at most
 * once per deposit: the database claims it first, and every outcome other than
 * Paystack accepting it (a refusal, a timeout, a 5xx, a crash before the
 * outcome is stored) goes to the manual queue for a person to check on
 * Paystack and finish by hand. Paystack's refund.processed webhook then
 * records the money as returned.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import * as z from "@/lib/zod";

import { logger } from "@/lib/logger";

import { PaystackError, type PaystackClient } from "./paystack";

const claimSchema = z.array(z.object({
  paymentId: z.string().uuid(),
  reference: z.string().min(1),
  refundCents: z.number().int().positive(),
}));

export type RefundClaim = z.infer<typeof claimSchema>[number];

export interface RefundStore {
  claimRefunds(input: { batchSize: number; paymentId: string | null }): Promise<RefundClaim[]>;
  finishRefund(input: {
    paymentId: string;
    outcome: "submitted" | "manual";
    providerRefundId: string | null;
    reason: string | null;
  }): Promise<void>;
}

export type DispatchResult = { submitted: number; manual: number; failed: number };

const DEFAULT_BATCH = 10;

export async function dispatchDepositRefunds(input: {
  paystack: Pick<PaystackClient, "createRefund">;
  store: RefundStore;
  /** Send only this deposit's refund, right after the action that started it. */
  paymentId?: string;
}): Promise<DispatchResult> {
  const paymentId = input.paymentId ?? null;
  const claims = await input.store.claimRefunds({ batchSize: paymentId ? 1 : DEFAULT_BATCH, paymentId });
  const result: DispatchResult = { submitted: 0, manual: 0, failed: 0 };

  for (const claim of claims) {
    let outcome: Parameters<RefundStore["finishRefund"]>[0];
    try {
      const refund = await input.paystack.createRefund({
        reference: claim.reference, amountCents: claim.refundCents, merchantNote: "RoomZA deposit refund",
      });
      outcome = { paymentId: claim.paymentId, outcome: "submitted", providerRefundId: String(refund.id), reason: null };
    } catch (error) {
      const reason = error instanceof PaystackError
        ? `paystack_${error.kind}${error.kind === "rejected" && error.status ? `_${error.status}` : ""}`
        : "unexpected_error";
      logger.warn("Deposit refund needs a person", { paymentId: claim.paymentId, reason });
      outcome = { paymentId: claim.paymentId, outcome: "manual", providerRefundId: null, reason };
    }

    try {
      await input.store.finishRefund(outcome);
      result[outcome.outcome] += 1;
    } catch (error) {
      // The claim stays open and moves to the manual queue when it expires.
      logger.error("Deposit refund outcome could not be stored", { paymentId: claim.paymentId, outcome: outcome.outcome, error });
      result.failed += 1;
    }
  }
  return result;
}

/** Backs the store with the service-role database functions. */
export function createRefundStore(client: SupabaseClient): RefundStore {
  return {
    async claimRefunds({ batchSize, paymentId }) {
      const { data, error } = await client.rpc("pinpoint_deposit_claim_refunds", {
        batch_size: batchSize, only_payment_id: paymentId,
      });
      if (error) throw new Error(`pinpoint_deposit_claim_refunds failed: ${error.code ?? "unknown"}`);
      return claimSchema.parse(data);
    },

    async finishRefund({ paymentId, outcome, providerRefundId, reason }) {
      const { error } = await client.rpc("pinpoint_deposit_finish_refund_dispatch", {
        target_payment_id: paymentId, outcome, refund_id: providerRefundId, manual_reason: reason,
      });
      if (error) throw new Error(`pinpoint_deposit_finish_refund_dispatch failed: ${error.code ?? "unknown"}`);
    },
  };
}
