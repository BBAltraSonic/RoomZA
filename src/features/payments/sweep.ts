/**
 * The deposit sweep: the timed rules in pinpoint_deposit_sweep (expired
 * checkouts, uncontested refund requests, automatic release), then sending
 * waiting refunds to Paystack. Called from src/app/api/cron/payments/sweep.
 */
import { logger } from "@/lib/logger";

import { isLivePaystackKey, paystackKeyCleared } from "./paystack";
import type { DispatchResult } from "./refunds";

export type SweepCounts = { cancelled: number; refundsStarted: number; autoReleased: number; reminders: number };

export type DepositSweepResult = {
  ok: boolean;
  swept: SweepCounts | null;
  /** Null when refunds were not sent: Paystack not configured, a live key before the live switch, or a failure. */
  refunds: DispatchResult | null;
};

export async function runDepositSweep(deps: {
  sweep: () => Promise<SweepCounts>;
  dispatch: () => Promise<DispatchResult>;
  secretKey: string | undefined;
  /** PAYSTACK_LIVE_PAYMENTS: "enabled" lets a live key send refunds. */
  liveSwitch?: string;
}): Promise<DepositSweepResult> {
  let ok = true;
  let swept: SweepCounts | null = null;
  try {
    swept = await deps.sweep();
  } catch (error) {
    ok = false;
    logger.error("Deposit sweep failed", { error });
  }

  if (!paystackKeyCleared(deps.secretKey, deps.liveSwitch)) {
    if (deps.secretKey && isLivePaystackKey(deps.secretKey)) {
      logger.error("A live Paystack key is configured but live deposits are not switched on");
    }
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
