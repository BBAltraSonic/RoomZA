import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
  PaystackError,
  createPaystackClient,
  isLivePaystackKey,
  parsePaystackEvent,
  paystackKeyCleared,
  verifyPaystackSignature,
} from "./paystack";

const secretKey = "sk_test_0123456789abcdef";

function sign(body: string, key = secretKey) {
  return createHmac("sha512", key).update(body).digest("hex");
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function clientWith(response: Response | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  return { fetchMock, client: createPaystackClient({ secretKey, fetch: fetchMock as unknown as typeof fetch }) };
}

describe("isLivePaystackKey", () => {
  it("should tell live keys from test keys", () => {
    expect(isLivePaystackKey("sk_live_abc")).toBe(true);
    expect(isLivePaystackKey("sk_test_abc")).toBe(false);
  });
});

describe("paystackKeyCleared", () => {
  it("should always clear a test key", () => {
    expect(paystackKeyCleared("sk_test_abc", undefined)).toBe(true);
  });

  it("should refuse a live key until live payments are switched on", () => {
    expect(paystackKeyCleared("sk_live_abc", undefined)).toBe(false);
    expect(paystackKeyCleared("sk_live_abc", "true")).toBe(false);
    expect(paystackKeyCleared("sk_live_abc", "enabled")).toBe(true);
  });

  it("should refuse a missing key", () => {
    expect(paystackKeyCleared(undefined, "enabled")).toBe(false);
    expect(paystackKeyCleared("", "enabled")).toBe(false);
  });
});

describe("verifyPaystackSignature", () => {
  const body = JSON.stringify({ event: "charge.success", data: { reference: "dep_1" } });

  it("should accept the HMAC-SHA512 of the exact body under the secret key", async () => {
    await expect(verifyPaystackSignature(body, sign(body), secretKey)).resolves.toBe(true);
  });

  it("should accept an upper-case hex signature", async () => {
    await expect(verifyPaystackSignature(body, sign(body).toUpperCase(), secretKey)).resolves.toBe(true);
  });

  it("should reject a body changed after signing", async () => {
    const tampered = body.replace("dep_1", "dep_2");
    await expect(verifyPaystackSignature(tampered, sign(body), secretKey)).resolves.toBe(false);
  });

  it("should reject a signature made with another key", async () => {
    await expect(verifyPaystackSignature(body, sign(body, "sk_test_other"), secretKey)).resolves.toBe(false);
  });

  it.each([null, "", "not-hex", "ab".repeat(63)])("should reject a missing or malformed signature %#", async (signature) => {
    await expect(verifyPaystackSignature(body, signature, secretKey)).resolves.toBe(false);
  });
});

describe("parsePaystackEvent", () => {
  it("should read a successful charge", () => {
    expect(parsePaystackEvent(JSON.stringify({ event: "charge.success", data: { id: 7, reference: "dep_1" } })))
      .toEqual({ kind: "charge_success", reference: "dep_1" });
  });

  it("should read a processed refund, whose amount Paystack may send as a string", () => {
    const raw = JSON.stringify({
      event: "refund.processed",
      data: { status: "processed", transaction_reference: "dep_1", refund_reference: "132013318360", amount: "5000" },
    });
    expect(parsePaystackEvent(raw)).toEqual({
      kind: "refund_processed", transactionReference: "dep_1", refundReference: "132013318360", amountCents: 5000,
    });
  });

  it.each(["refund.failed", "refund.needs-attention"])("should read a %s refund so it can go to a person", (event) => {
    const raw = JSON.stringify({ event, data: { status: "failed", transaction_reference: "dep_1", refund_reference: null, amount: 5000 } });
    expect(parsePaystackEvent(raw)).toEqual({ kind: "refund_trouble", event, transactionReference: "dep_1" });
  });

  it("should report other events by name without reading them", () => {
    expect(parsePaystackEvent(JSON.stringify({ event: "transfer.success", data: {} })))
      .toEqual({ kind: "other", event: "transfer.success" });
  });

  it.each(["not json", "{}", JSON.stringify({ event: "charge.success", data: {} })])(
    "should return null for a body it cannot read %#",
    (raw) => {
      expect(parsePaystackEvent(raw)).toBeNull();
    },
  );
});

describe("initializeTransaction", () => {
  const input = {
    email: "renter@example.com",
    amountCents: 800_000,
    currency: "ZAR" as const,
    reference: "dep_abc",
    callbackUrl: "https://roomza.test/applications",
    metadata: { paymentId: "p1" },
  };

  it("should post the amount in cents with the secret key and return the checkout link", async () => {
    const { client, fetchMock } = clientWith(jsonResponse({
      status: true, message: "Authorization URL created",
      data: { authorization_url: "https://checkout.paystack.com/abc", access_code: "abc", reference: "dep_abc" },
    }));

    await expect(client.initializeTransaction(input)).resolves.toEqual({
      authorizationUrl: "https://checkout.paystack.com/abc", accessCode: "abc", reference: "dep_abc",
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.paystack.co/transaction/initialize");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("authorization")).toBe(`Bearer ${secretKey}`);
    expect(JSON.parse(String(init.body))).toEqual({
      email: "renter@example.com", amount: 800_000, currency: "ZAR", reference: "dep_abc",
      callback_url: "https://roomza.test/applications", metadata: { paymentId: "p1" },
    });
  });

  it("should refuse a checkout link that is not https", async () => {
    const { client } = clientWith(jsonResponse({
      status: true, message: "ok",
      data: { authorization_url: "http://checkout.paystack.com/abc", access_code: "abc", reference: "dep_abc" },
    }));
    await expect(client.initializeTransaction(input)).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("should report a 400 as a rejection with Paystack's message", async () => {
    const { client } = clientWith(jsonResponse({ status: false, message: "Duplicate Transaction Reference" }, 400));
    const error = await client.initializeTransaction(input).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(PaystackError);
    expect(error).toMatchObject({ kind: "rejected", status: 400, message: "Duplicate Transaction Reference" });
  });

  it("should report a network failure as unavailable", async () => {
    const { client } = clientWith(new TypeError("fetch failed"));
    await expect(client.initializeTransaction(input)).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("should report a server error as unavailable", async () => {
    const { client } = clientWith(new Response("upstream down", { status: 502 }));
    await expect(client.initializeTransaction(input)).rejects.toMatchObject({ kind: "unavailable", status: 502 });
  });
});

describe("verifyTransaction", () => {
  const verified = {
    id: 302961, status: "success", reference: "dep_abc", amount: 800_000, currency: "ZAR",
    fees: 26_795, channel: "card", paid_at: "2026-11-15T10:00:00.000Z",
    customer: { email: "renter@example.com" },
  };

  it("should return the amount, currency and processing fee Paystack reports", async () => {
    const { client, fetchMock } = clientWith(jsonResponse({ status: true, message: "Verification successful", data: verified }));

    await expect(client.verifyTransaction("dep_abc")).resolves.toEqual({
      id: 302961, status: "success", reference: "dep_abc", amountCents: 800_000, currency: "ZAR",
      feeCents: 26_795, channel: "card", paidAt: "2026-11-15T10:00:00.000Z",
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.paystack.co/transaction/verify/dep_abc");
    expect(init.method).toBe("GET");
  });

  it("should leave the fee unknown when Paystack does not report it", async () => {
    const { client } = clientWith(jsonResponse({ status: true, message: "ok", data: { ...verified, fees: null } }));
    await expect(client.verifyTransaction("dep_abc")).resolves.toMatchObject({ feeCents: null });
  });

  it("should escape the reference in the path", async () => {
    const { client, fetchMock } = clientWith(jsonResponse({ status: true, message: "ok", data: verified }));
    await client.verifyTransaction("dep/../x").catch(() => undefined);
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("https://api.paystack.co/transaction/verify/dep%2F..%2Fx");
  });

  it("should treat a response without an amount as unavailable rather than guess", async () => {
    const { client } = clientWith(jsonResponse({ status: true, message: "ok", data: { ...verified, amount: undefined } }));
    await expect(client.verifyTransaction("dep_abc")).rejects.toMatchObject({ kind: "unavailable" });
  });
});

describe("createRefund", () => {
  it("should ask for a partial refund in cents against the transaction reference", async () => {
    const { client, fetchMock } = clientWith(jsonResponse({
      status: true, message: "Refund has been queued for processing",
      data: { id: 3018284, status: "pending", amount: 773_205, currency: "ZAR" },
    }));

    await expect(client.createRefund({ reference: "dep_abc", amountCents: 773_205, merchantNote: "Renter cancelled" }))
      .resolves.toEqual({ id: 3018284, status: "pending", amountCents: 773_205 });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.paystack.co/refund");
    expect(JSON.parse(String(init.body))).toEqual({
      transaction: "dep_abc", amount: 773_205, currency: "ZAR", merchant_note: "Renter cancelled",
    });
  });

  it("should report a refused refund as a rejection so it can go to the manual queue", async () => {
    const { client } = clientWith(jsonResponse({ status: false, message: "Insufficient balance for refund" }, 400));
    await expect(client.createRefund({ reference: "dep_abc", amountCents: 1 })).rejects.toMatchObject({ kind: "rejected" });
  });

  it("should refuse an amount that is not a positive whole number of cents", async () => {
    const { client, fetchMock } = clientWith(jsonResponse({}));
    await expect(client.createRefund({ reference: "dep_abc", amountCents: 0 })).rejects.toBeInstanceOf(RangeError);
    await expect(client.createRefund({ reference: "dep_abc", amountCents: 10.5 })).rejects.toBeInstanceOf(RangeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
