import { createPaystackClient } from "@/features/payments/paystack";
import { createDepositWebhookStore, handlePaystackWebhook } from "@/features/payments/webhook";
import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";
import { createUntypedClient } from "@/lib/supabase/admin";

/**
 * Paystack webhook (docs/deposit-payments-proposal.md, "Server pieces").
 * Set this URL in the Paystack dashboard for the test and live integrations.
 * The body is read as text so the signature is checked on the exact bytes sent.
 */
export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const rawBody = await request.text();
  const secretKey = process.env.PAYSTACK_SECRET_KEY || undefined;

  const result = await handlePaystackWebhook(
    { rawBody, signature: request.headers.get("x-paystack-signature") },
    {
      secretKey,
      paystack: createPaystackClient({ secretKey: secretKey ?? "" }),
      // Built lazily so a misconfigured service key still answers 503, not a crash.
      store: {
        recordCharge: (input) => createDepositWebhookStore(createUntypedClient()).recordCharge(input),
        recordProviderRefund: (input) => createDepositWebhookStore(createUntypedClient()).recordProviderRefund(input),
        flagRefund: (input) => createDepositWebhookStore(createUntypedClient()).flagRefund(input),
      },
    },
  );

  if (result.status === 200) return apiSuccess({ outcome: result.outcome }, { requestId });
  return apiFailure({ code: result.code, message: result.message }, result.status, { requestId });
}
