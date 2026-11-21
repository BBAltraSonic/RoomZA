/**
 * Paystack, called with fetch and Web Crypto so it runs on Cloudflare Workers
 * without Paystack's Node library. Amounts are whole cents (Paystack's
 * "subunits") throughout.
 *
 * Checked against Paystack's OpenAPI spec (github.com/PaystackOSS/openapi,
 * dist/paystack.yaml) and its documentation snippets (PaystackOSS/doc-code-snippets)
 * on 2026-11-15. See docs/deposit-payments-proposal.md, "Provider facts used".
 */
import * as z from "@/lib/zod";

const API_BASE = "https://api.paystack.co";
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * `rejected`: Paystack answered and said no (4xx), e.g. a refund larger than
 * the pending balance. Retrying the same request will not help.
 * `unavailable`: no usable answer (network, timeout, 5xx, unexpected body).
 */
export class PaystackError extends Error {
  constructor(
    readonly kind: "rejected" | "unavailable",
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "PaystackError";
  }
}

export function isLivePaystackKey(secretKey: string): boolean {
  return secretKey.startsWith("sk_live_");
}

/**
 * Whether deposits may move money with this key. A test key always may. A live
 * key also needs PAYSTACK_LIVE_PAYMENTS=enabled, which is set only once the
 * go-live checklist in docs/deposit-payments-proposal.md is done.
 */
export function paystackKeyCleared(secretKey: string | undefined, liveSwitch: string | undefined): secretKey is string {
  if (!secretKey) return false;
  return !isLivePaystackKey(secretKey) || liveSwitch === "enabled";
}

const HEX_SHA512 = /^[0-9a-f]{128}$/i;

/**
 * Paystack signs each webhook with `x-paystack-signature`: the hex HMAC-SHA512
 * of the raw request body under the account's secret key. Verify against the
 * exact bytes received, before parsing.
 */
export async function verifyPaystackSignature(
  rawBody: string,
  signature: string | null,
  secretKey: string,
): Promise<boolean> {
  if (!signature || !HEX_SHA512.test(signature)) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["verify"],
  );
  const signatureBytes = new Uint8Array(signature.length / 2);
  for (let index = 0; index < signatureBytes.length; index += 1) {
    signatureBytes[index] = Number.parseInt(signature.slice(index * 2, index * 2 + 2), 16);
  }
  // subtle.verify compares in constant time.
  return crypto.subtle.verify("HMAC", key, signatureBytes, encoder.encode(rawBody));
}

const eventEnvelope = z.object({ event: z.string().min(1), data: z.unknown() });
const chargeData = z.object({ reference: z.string().min(1) });
const refundData = z.object({
  transaction_reference: z.string().min(1),
  refund_reference: z.coerce.string().min(1),
  // Paystack's own samples send this as a number in one event and a string in another.
  amount: z.coerce.number().int().nonnegative(),
});

const refundTroubleData = z.object({ transaction_reference: z.string().min(1) });

/** Refund events that mean Paystack could not complete the refund on its own. */
const REFUND_TROUBLE_EVENTS = new Set(["refund.failed", "refund.needs-attention"]);

export type PaystackEvent =
  | { kind: "charge_success"; reference: string }
  | { kind: "refund_trouble"; event: string; transactionReference: string }
  | { kind: "refund_processed"; transactionReference: string; refundReference: string; amountCents: number }
  | { kind: "other"; event: string };

/** Reads only what RoomZA acts on. Returns null for a body it cannot read. */
export function parsePaystackEvent(rawBody: string): PaystackEvent | null {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return null;
  }
  const envelope = eventEnvelope.safeParse(json);
  if (!envelope.success) return null;

  if (envelope.data.event === "charge.success") {
    const data = chargeData.safeParse(envelope.data.data);
    return data.success ? { kind: "charge_success", reference: data.data.reference } : null;
  }
  if (envelope.data.event === "refund.processed") {
    const data = refundData.safeParse(envelope.data.data);
    return data.success
      ? {
          kind: "refund_processed",
          transactionReference: data.data.transaction_reference,
          refundReference: data.data.refund_reference,
          amountCents: data.data.amount,
        }
      : null;
  }
  if (REFUND_TROUBLE_EVENTS.has(envelope.data.event)) {
    const data = refundTroubleData.safeParse(envelope.data.data);
    return data.success
      ? { kind: "refund_trouble", event: envelope.data.event, transactionReference: data.data.transaction_reference }
      : null;
  }
  return { kind: "other", event: envelope.data.event };
}

const failureBody = z.object({ message: z.string() });

function successBody<T extends z.ZodTypeAny>(data: T) {
  return z.object({ status: z.literal(true), data });
}

const initializeData = z.object({
  authorization_url: z.string().url().startsWith("https://"),
  access_code: z.string().min(1),
  reference: z.string().min(1),
});

const verifyData = z.object({
  id: z.number().int(),
  status: z.string(),
  reference: z.string(),
  amount: z.number().int().positive(),
  currency: z.string(),
  fees: z.number().int().nonnegative().nullable().optional(),
  channel: z.string().nullable().optional(),
  paid_at: z.string().nullable().optional(),
});

const refundCreateData = z.object({
  id: z.number().int(),
  status: z.string(),
  amount: z.number().int().nonnegative(),
});

export interface InitializeTransactionInput {
  email: string;
  amountCents: number;
  currency: "ZAR";
  reference: string;
  callbackUrl: string;
  metadata: Record<string, string>;
}

export interface InitializedTransaction {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export interface VerifiedTransaction {
  id: number;
  /** "success" is the only status that means the money arrived. */
  status: string;
  reference: string;
  amountCents: number;
  currency: string;
  /** The processing fee Paystack kept, or null when it did not report one. */
  feeCents: number | null;
  channel: string | null;
  paidAt: string | null;
}

export interface CreatedRefund {
  id: number;
  /** pending, processing, processed, failed or needs-attention. */
  status: string;
  amountCents: number;
}

export interface PaystackClient {
  initializeTransaction(input: InitializeTransactionInput): Promise<InitializedTransaction>;
  verifyTransaction(reference: string): Promise<VerifiedTransaction>;
  createRefund(input: { reference: string; amountCents: number; merchantNote?: string }): Promise<CreatedRefund>;
}

function assertPositiveCents(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive whole number of cents`);
  }
}

export function createPaystackClient(config: { secretKey: string; fetch?: typeof fetch }): PaystackClient {
  const fetchImpl = config.fetch ?? fetch;

  async function call<T extends z.ZodTypeAny>(
    method: "GET" | "POST",
    path: string,
    schema: T,
    body?: unknown,
  ): Promise<z.infer<T>> {
    let response: Response;
    try {
      response = await fetchImpl(`${API_BASE}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${config.secretKey}`,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new PaystackError("unavailable", error instanceof Error ? error.message : "Request failed");
    }

    let json: unknown = null;
    try {
      json = await response.json();
    } catch {
      // Leave json null; handled below.
    }

    if (response.status >= 400 && response.status < 500) {
      const failure = failureBody.safeParse(json);
      throw new PaystackError("rejected", failure.success ? failure.data.message : "Request rejected", response.status);
    }
    if (!response.ok) {
      throw new PaystackError("unavailable", `Paystack returned ${response.status}`, response.status);
    }
    const parsed = successBody(schema).safeParse(json);
    if (!parsed.success) {
      throw new PaystackError("unavailable", "Paystack returned an unexpected response", response.status);
    }
    // zod 4 can't resolve the envelope's `data` key while T is still generic.
    return (parsed.data as { data: z.infer<T> }).data;
  }

  return {
    async initializeTransaction(input) {
      assertPositiveCents(input.amountCents, "Amount");
      const data = await call("POST", "/transaction/initialize", initializeData, {
        email: input.email,
        amount: input.amountCents,
        currency: input.currency,
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata: input.metadata,
      });
      return { authorizationUrl: data.authorization_url, accessCode: data.access_code, reference: data.reference };
    },

    async verifyTransaction(reference) {
      const data = await call("GET", `/transaction/verify/${encodeURIComponent(reference)}`, verifyData);
      return {
        id: data.id,
        status: data.status,
        reference: data.reference,
        amountCents: data.amount,
        currency: data.currency,
        feeCents: data.fees ?? null,
        channel: data.channel ?? null,
        paidAt: data.paid_at ?? null,
      };
    },

    async createRefund(input) {
      assertPositiveCents(input.amountCents, "Refund");
      const data = await call("POST", "/refund", refundCreateData, {
        transaction: input.reference,
        amount: input.amountCents,
        currency: "ZAR",
        ...(input.merchantNote ? { merchant_note: input.merchantNote } : {}),
      });
      return { id: data.id, status: data.status, amountCents: data.amount };
    },
  };
}
