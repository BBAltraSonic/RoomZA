"use server";

import { z } from "zod";

import { actionFailure, actionSuccess, type ActionResult } from "@/lib/action-result";
import { requirePersona } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createUntypedClient } from "@/lib/supabase/admin";

import { createPaystackClient, isLivePaystackKey } from "./paystack";
import { createRefundStore, dispatchDepositRefunds } from "./refunds";
import { currentSessionId } from "./session";

/*
 * What renters and owners can do with a deposit once it is paid. The database
 * functions decide what is allowed; these actions check who is asking, pass
 * the request on, and send any refund that starts straight to Paystack.
 */

const paymentIdSchema = z.string().uuid();
const stateSchema = z.object({ state: z.string() });

type DepositRpc =
  | "pinpoint_deposit_confirm_move_in"
  | "pinpoint_deposit_request_refund"
  | "pinpoint_deposit_contest_refund"
  | "pinpoint_deposit_owner_cancel";

const refusals: Record<string, string> = {
  "Deposit cannot be released": "This deposit can no longer be confirmed.",
  "Deposit cannot be refunded": "This deposit can no longer be refunded.",
  "There is no refund request to contest": "The renter has not asked for a refund.",
  "The time to contest this refund has passed": "The 24 hours to respond have passed.",
  "Deposit cannot be cancelled": "This deposit can no longer be cancelled.",
};

const TRY_AGAIN = "Something went wrong. Try again in a moment.";

/** Best effort: if this fails the refund stays unclaimed and the sweep sends it. */
async function sendRefundNow(paymentId: string) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey || isLivePaystackKey(secretKey)) return;
  try {
    await dispatchDepositRefunds({
      paystack: createPaystackClient({ secretKey }),
      store: createRefundStore(createUntypedClient()),
      paymentId,
    });
  } catch (error) {
    logger.warn("Deposit refund was not sent straight away; the sweep will send it", { paymentId, error });
  }
}

async function runDepositAction(
  persona: "renter" | "landlord",
  rpc: DepositRpc,
  paymentId: string,
): Promise<ActionResult<{ state: string }>> {
  const target = paymentIdSchema.safeParse(paymentId);
  if (!target.success) return actionFailure("Invalid deposit.");

  const { user } = await requirePersona(persona);
  const sessionId = await currentSessionId(user.id);
  if (!sessionId) return actionFailure("Sign in again and try once more.");

  const limit = await consumeRateLimit({ key: `deposit-action:${user.id}`, requests: 20, window: "10 m" });
  if (!limit.success) return actionFailure("Too many attempts. Wait a few minutes and try again.");

  const { data, error } = await createUntypedClient().rpc(rpc, {
    actor_id: user.id, actor_session_id: sessionId, target_payment_id: target.data,
  });
  if (error) {
    if (error.code === "42501") return actionFailure("This deposit is unavailable.");
    if (error.code === "PT409") return actionFailure(refusals[error.message] ?? TRY_AGAIN);
    logger.error("Deposit action failed", { rpc, paymentId: target.data, code: error.code });
    return actionFailure(TRY_AGAIN);
  }
  const parsed = stateSchema.safeParse(data);
  if (!parsed.success) {
    logger.error("Deposit action returned an unexpected shape", { rpc, paymentId: target.data });
    return actionFailure(TRY_AGAIN);
  }
  if (parsed.data.state === "refunding") await sendRefundNow(target.data);
  return actionSuccess({ state: parsed.data.state });
}

/** Renter: "I've moved in". The owner's payout is queued. */
export async function confirmMoveIn(paymentId: string) {
  return runDepositAction("renter", "pinpoint_deposit_confirm_move_in", paymentId);
}

/**
 * Renter: cancel before the move-in date (refund starts at once) or "I'm not
 * satisfied" from the move-in date (the owner has 24 hours to contest).
 */
export async function requestDepositRefund(paymentId: string) {
  return runDepositAction("renter", "pinpoint_deposit_request_refund", paymentId);
}

/** Owner: "they did move in", within 24 hours of the renter's refund request. */
export async function contestDepositRefund(paymentId: string) {
  return runDepositAction("landlord", "pinpoint_deposit_contest_refund", paymentId);
}

/** Owner: cancel the deposit. A paid deposit goes back to the renter in full. */
export async function cancelDepositAsOwner(paymentId: string) {
  return runDepositAction("landlord", "pinpoint_deposit_owner_cancel", paymentId);
}
