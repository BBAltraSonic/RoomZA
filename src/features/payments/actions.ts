"use server";

import { z } from "zod";

import {
  actionFailure,
  actionSuccess,
  fieldErrorFailure,
  type ActionResult,
  type FieldErrorDetails,
} from "@/lib/action-result";
import { requirePersona } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createUntypedClient } from "@/lib/supabase/admin";

import { PaystackError, createPaystackClient, paystackKeyCleared, type PaystackClient } from "./paystack";
import { depositIdSchema } from "./schemas";
import { currentSessionId } from "./session";
import { payoutAccountSchema, payoutAccountSummarySchema, type PayoutAccountSummary } from "./payout-account";

/** What pinpoint_deposit_start and pinpoint_deposit_attach_checkout return. */
const depositSummary = z.object({
  paymentId: z.string().uuid(),
  state: z.string(),
  amountCents: z.number().int().positive(),
  currency: z.literal("ZAR"),
  reference: z.string().min(1),
  checkoutUrl: z.string().nullable(),
});
type DepositSummary = z.infer<typeof depositSummary>;

const NOT_AVAILABLE = "Online deposits are not available yet.";
const TRY_AGAIN = "We could not open the payment page. Try again in a moment.";

const startRefusals: Record<string, string> = {
  "Deposit already paid": "Your deposit is already paid.",
  "Application is not approved": "The landlord has not approved this application yet.",
  "Online deposits are not enabled for this listing":
    "This listing does not take deposits online. Message the landlord to arrange it.",
};

type StartResult = { ok: true; summary: DepositSummary } | { ok: false; error: string };

async function startDeposit(actorId: string, sessionId: string, applicationId: string): Promise<StartResult> {
  const { data, error } = await createUntypedClient().rpc("pinpoint_deposit_start", {
    actor_id: actorId, actor_session_id: sessionId, target_application_id: applicationId,
  });
  if (error) {
    if (error.code === "42501") return { ok: false, error: "This application is unavailable." };
    if (error.code === "PT409") return { ok: false, error: startRefusals[error.message] ?? TRY_AGAIN };
    logger.error("Deposit checkout could not start", { applicationId, code: error.code });
    return { ok: false, error: TRY_AGAIN };
  }
  const parsed = depositSummary.safeParse(data);
  if (!parsed.success) {
    logger.error("Deposit start returned an unexpected shape", { applicationId });
    return { ok: false, error: TRY_AGAIN };
  }
  return { ok: true, summary: parsed.data };
}

async function openCheckout(
  paystack: PaystackClient,
  input: { email: string; summary: DepositSummary; applicationId: string; appUrl: string },
): Promise<string> {
  const { summary } = input;
  const opened = await paystack.initializeTransaction({
    email: input.email,
    // The amount comes from the database, never from the browser.
    amountCents: summary.amountCents,
    currency: summary.currency,
    reference: summary.reference,
    // Paystack adds &trxref=&reference= to this. The journey screen only reads
    // state; only the webhook marks a deposit paid.
    callbackUrl: `${input.appUrl}/applications?view=progress&deposit=${summary.paymentId}`,
    metadata: { purpose: "rental_deposit", paymentId: summary.paymentId, applicationId: input.applicationId },
  });

  const { data, error } = await createUntypedClient().rpc("pinpoint_deposit_attach_checkout", {
    target_payment_id: summary.paymentId,
    target_reference: summary.reference,
    new_checkout_url: opened.authorizationUrl,
  });
  const attached = depositSummary.safeParse(data);
  if (error || !attached.success) {
    // Paystack has the transaction; the renter can still pay through this link.
    logger.warn("Deposit checkout link could not be stored", { paymentId: summary.paymentId, code: error?.code });
    return opened.authorizationUrl;
  }
  // A concurrent attempt may have stored its link first; everyone uses that one.
  return attached.data.checkoutUrl ?? opened.authorizationUrl;
}

/**
 * Renter: pay the deposit for an approved application. Returns the Paystack
 * checkout page to send the browser to. Calling it again while the deposit is
 * unpaid returns the same page.
 */
export async function startDepositCheckout(applicationId: string): Promise<ActionResult<{ checkoutUrl: string }>> {
  const target = depositIdSchema.safeParse(applicationId);
  if (!target.success) return actionFailure("Invalid application id.");

  const { user } = await requirePersona("renter");
  const sessionId = await currentSessionId(user.id);
  if (!sessionId) return actionFailure("Sign in again before paying your deposit.");
  if (!user.email) return actionFailure("Add an email address to your account to receive the payment receipt.");

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return actionFailure(NOT_AVAILABLE);
  // A live key also needs the live switch (docs/deposit-payments-proposal.md, "Going live").
  if (!paystackKeyCleared(secretKey, process.env.PAYSTACK_LIVE_PAYMENTS)) {
    logger.error("A live Paystack key is configured but live deposits are not switched on");
    return actionFailure(NOT_AVAILABLE);
  }

  const limit = await consumeRateLimit({ key: `deposit-checkout:${user.id}`, requests: 10, window: "10 m" });
  if (!limit.success) return actionFailure("Too many attempts. Wait a few minutes and try again.");

  const started = await startDeposit(user.id, sessionId, target.data);
  if (!started.ok) return actionFailure(started.error);
  if (started.summary.checkoutUrl) return actionSuccess({ checkoutUrl: started.summary.checkoutUrl });

  const paystack = createPaystackClient({ secretKey });
  try {
    const checkoutUrl = await openCheckout(paystack, {
      email: user.email, summary: started.summary, applicationId: target.data,
      appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    });
    return actionSuccess({ checkoutUrl });
  } catch (error) {
    logger.warn("Paystack checkout could not open", {
      paymentId: started.summary.paymentId,
      kind: error instanceof PaystackError ? error.kind : "unknown",
      status: error instanceof PaystackError ? error.status : undefined,
    });
  }

  // Paystack refuses a reference it has seen, which happens when two attempts
  // race. The one that won has stored its link by now.
  const retry = await startDeposit(user.id, sessionId, target.data);
  if (retry.ok && retry.summary.checkoutUrl) return actionSuccess({ checkoutUrl: retry.summary.checkoutUrl });
  return actionFailure(TRY_AGAIN);
}

/**
 * Owner: save the bank account RoomZA pays deposits into. Replaces any earlier
 * account. Returns only the masked summary; the full number is never sent back
 * or logged.
 */
export async function saveOwnerPayoutAccount(
  input: unknown,
): Promise<ActionResult<PayoutAccountSummary, FieldErrorDetails>> {
  const { user } = await requirePersona("landlord");
  const parsed = payoutAccountSchema.safeParse(input);
  if (!parsed.success) return fieldErrorFailure(parsed.error.flatten().fieldErrors as Record<string, string[]>);

  const sessionId = await currentSessionId(user.id);
  if (!sessionId) return actionFailure("Sign in again before changing your bank details.");

  const limit = await consumeRateLimit({ key: `payout-account:${user.id}`, requests: 5, window: "10 m" });
  if (!limit.success) return actionFailure("Too many changes. Wait a few minutes and try again.");

  const { data, error } = await createUntypedClient().rpc("pinpoint_owner_payout_account_save", {
    actor_id: user.id,
    actor_session_id: sessionId,
    new_account_holder: parsed.data.accountHolder,
    new_bank_name: parsed.data.bankName,
    new_branch_code: parsed.data.branchCode,
    new_account_number: parsed.data.accountNumber,
  });
  if (error) {
    if (error.code === "42501") return actionFailure("Sign in again before changing your bank details.");
    // The database message can echo the input, so only the code is logged.
    logger.error("Owner payout account could not be saved", { userId: user.id, code: error.code });
    return actionFailure("We could not save your bank details. Try again.");
  }
  const summary = payoutAccountSummarySchema.safeParse(data);
  if (!summary.success) {
    logger.error("Owner payout account save returned an unexpected shape", { userId: user.id });
    return actionFailure("We could not save your bank details. Try again.");
  }
  logger.info("Owner payout account saved", { userId: user.id });
  return actionSuccess(summary.data);
}
