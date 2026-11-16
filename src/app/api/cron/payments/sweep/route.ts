import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { createPaystackClient } from "@/features/payments/paystack";
import { createRefundStore, dispatchDepositRefunds } from "@/features/payments/refunds";
import { runDepositSweep } from "@/features/payments/sweep";
import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";
import { createUntypedClient } from "@/lib/supabase/admin";

const sweepCounts = z.object({
  cancelled: z.number().int(),
  refundsStarted: z.number().int(),
  autoReleased: z.number().int(),
});

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  const supplied = createHash("sha256").update(request.headers.get("authorization") ?? "").digest();
  return timingSafeEqual(expected, supplied);
}

/**
 * Deposit sweep (docs/deposit-payments-proposal.md): cancels abandoned
 * checkouts, starts uncontested refunds, releases deposits the renter never
 * answered, then sends waiting refunds to Paystack. Called every few minutes by
 * the roomza-notifications worker. pg_cron also runs the timed rules on their
 * own every 15 minutes; only this route can send refunds.
 */
async function handleSweep(request: Request) {
  const requestId = getRequestId(request);
  if (!authorized(request)) {
    return apiFailure({ code: "unauthorized", message: "Unauthorized" }, 401, { requestId });
  }

  const client = createUntypedClient();
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const result = await runDepositSweep({
    secretKey,
    sweep: async () => {
      const { data, error } = await client.rpc("pinpoint_deposit_sweep");
      if (error) throw new Error(`pinpoint_deposit_sweep failed: ${error.code ?? "unknown"}`);
      return sweepCounts.parse(data);
    },
    dispatch: () => dispatchDepositRefunds({
      paystack: createPaystackClient({ secretKey: secretKey ?? "" }),
      store: createRefundStore(client),
    }),
  });

  if (!result.ok) {
    return apiFailure({ code: "server_error", message: "The deposit sweep did not finish." }, 500, { requestId });
  }
  return apiSuccess({ swept: result.swept, refunds: result.refunds }, { requestId });
}

export const GET = handleSweep;
export const POST = handleSweep;
