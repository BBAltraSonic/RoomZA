import { logger } from "@/lib/logger";
import { createUntypedClient } from "@/lib/supabase/admin";

import { createPaystackClient, paystackKeyCleared } from "./paystack";
import { createRefundStore, dispatchDepositRefunds } from "./refunds";

/**
 * Send one deposit's refund to Paystack right after the action that started
 * it. Best effort: if this fails the refund stays unclaimed and the sweep
 * sends it. Kept out of the "use server" files so it is never a callable action.
 */
export async function sendRefundNow(paymentId: string): Promise<void> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!paystackKeyCleared(secretKey, process.env.PAYSTACK_LIVE_PAYMENTS)) return;
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
