/**
 * The deposit sweep: the timed rules in pinpoint_deposit_sweep (expired
 * checkouts, uncontested refund requests, automatic release), then sending
 * waiting refunds to Paystack. Called from src/app/api/cron/payments/sweep.
 */
import { logger } from "@/lib/logger";

import { isLivePaystackKey } from "./paystack";
import type { DispatchResult } from "./refunds";

export type SweepCounts = { cancelled: number; refundsStarted: number; autoReleased: number };

export type DepositSweepResult = {
  ok: boolean;
  swept: SweepCounts | null;
  /** Null when refunds were not sent: Paystack not configured, a live key too early, or a failure. */
  refunds: DispatchResult | null;
};

export async function runDepositSweep(deps: {
  sweep: () => Promise<SweepCounts>;
  dispatch: () => Promise<DispatchResult>;
  secretKey: string | undefined;
}): Promise<DepositSweepResult> {
  let ok = true;
  let swept: SweepCounts | null = null;
  try {
    swept = await deps.sweep();
  } catch (error) {
    ok = false;
    logger.error("Deposit sweep failed", { error });
  }

  // Test mode only until build step 6 (docs/deposit-payments-proposal.md).
  if (!deps.secretKey || isLivePaystackKey(deps.secretKey)) {
    if (deps.secretKey) logger.error("A live Paystack key is configured before deposits are cleared for live payments");
    return { ok, swept, refunds: null };
  }

  let refunds: DispatchResult | null = null;
  try {
    refunds = await deps.dispatch();
  } catch (error) {
    ok = false;
    logger.error("Deposit refunds could not be dispatched", { error });
  }
  return { ok, swept, refunds };
}
