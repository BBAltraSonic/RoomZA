import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  claims: vi.fn(),
  requirePersona: vi.fn(),
  rpc: vi.fn(),
  rateLimit: vi.fn(),
  initializeTransaction: vi.fn(),
  createPaystackClient: vi.fn(),
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: mocks.claims } }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createUntypedClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/auth", () => ({ requirePersona: (persona: string) => mocks.requirePersona(persona) }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: (options: unknown) => mocks.rateLimit(options) }));
vi.mock("@/lib/logger", () => ({ logger: mocks.logger }));
vi.mock("./paystack", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./paystack")>()),
  createPaystackClient: (config: unknown) => mocks.createPaystackClient(config),
}));

import { saveOwnerPayoutAccount, startDepositCheckout } from "./actions";
import { PaystackError } from "./paystack";

const renterId = "10000000-0000-4000-8000-000000000001";
const sessionId = "10000000-0000-4000-8000-0000000000a1";
const applicationId = "10000000-0000-4000-8000-000000000010";
const paymentId = "10000000-0000-4000-8000-000000000020";
const reference = "dep_10000000000040008000000000000020";

function summary(checkoutUrl: string | null = null) {
  return { paymentId, state: "awaiting_payment", amountCents: 800_000, currency: "ZAR", reference, checkoutUrl };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePersona.mockResolvedValue({ user: { id: renterId, email: "renter@example.com" } });
  mocks.claims.mockResolvedValue({ data: { claims: { sub: renterId, session_id: sessionId } }, error: null });
  mocks.rateLimit.mockResolvedValue({ success: true });
  vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_test_abc");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://roomza.test");
  mocks.createPaystackClient.mockReturnValue({ initializeTransaction: mocks.initializeTransaction });
  mocks.initializeTransaction.mockResolvedValue({
    authorizationUrl: "https://checkout.paystack.com/new", accessCode: "new", reference,
  });
  mocks.rpc.mockImplementation(async (name: string) => {
    if (name === "pinpoint_deposit_start") return { data: summary(), error: null };
    if (name === "pinpoint_deposit_attach_checkout") return { data: summary("https://checkout.paystack.com/new"), error: null };
    throw new Error(`unexpected rpc ${name}`);
  });
});

afterEach(() => vi.unstubAllEnvs());

describe("startDepositCheckout", () => {
  it("should start the deposit in the database, open a Paystack checkout for the stored amount and keep its link", async () => {
    const result = await startDepositCheckout(applicationId);

    expect(result).toEqual({ success: true, data: { checkoutUrl: "https://checkout.paystack.com/new" } });
    expect(mocks.requirePersona).toHaveBeenCalledWith("renter");
    expect(mocks.rpc).toHaveBeenCalledWith("pinpoint_deposit_start", {
      actor_id: renterId, actor_session_id: sessionId, target_application_id: applicationId,
    });
    expect(mocks.createPaystackClient).toHaveBeenCalledWith({ secretKey: "sk_test_abc" });
    expect(mocks.initializeTransaction).toHaveBeenCalledWith({
      email: "renter@example.com", amountCents: 800_000, currency: "ZAR", reference,
      callbackUrl: `https://roomza.test/applications?view=progress&deposit=${paymentId}`,
      metadata: { purpose: "rental_deposit", paymentId, applicationId },
    });
    expect(mocks.rpc).toHaveBeenCalledWith("pinpoint_deposit_attach_checkout", {
      target_payment_id: paymentId, target_reference: reference, new_checkout_url: "https://checkout.paystack.com/new",
    });
  });

  it("should send the renter back to the checkout already opened for this deposit", async () => {
    mocks.rpc.mockResolvedValue({ data: summary("https://checkout.paystack.com/old"), error: null });
    await expect(startDepositCheckout(applicationId)).resolves.toEqual({
      success: true, data: { checkoutUrl: "https://checkout.paystack.com/old" },
    });
    expect(mocks.initializeTransaction).not.toHaveBeenCalled();
  });

  it("should use the link a concurrent attempt stored when Paystack refuses the repeated reference", async () => {
    let starts = 0;
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name !== "pinpoint_deposit_start") throw new Error(`unexpected rpc ${name}`);
      starts += 1;
      return { data: summary(starts === 1 ? null : "https://checkout.paystack.com/first"), error: null };
    });
    mocks.initializeTransaction.mockRejectedValue(new PaystackError("rejected", "Duplicate Transaction Reference", 400));

    await expect(startDepositCheckout(applicationId)).resolves.toEqual({
      success: true, data: { checkoutUrl: "https://checkout.paystack.com/first" },
    });
  });

  it("should fail without detail when Paystack is unavailable and no link exists", async () => {
    mocks.rpc.mockResolvedValue({ data: summary(), error: null });
    mocks.initializeTransaction.mockRejectedValue(new PaystackError("unavailable", "socket hang up"));
    const result = await startDepositCheckout(applicationId);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).not.toContain("socket hang up");
  });

  it("should reject an invalid application id before any database call", async () => {
    expect((await startDepositCheckout("not-a-uuid")).success).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("should reject a session whose claims name another person", async () => {
    mocks.claims.mockResolvedValue({ data: { claims: { sub: "someone-else", session_id: sessionId } }, error: null });
    expect((await startDepositCheckout(applicationId)).success).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("should stay closed while Paystack is not configured", async () => {
    vi.stubEnv("PAYSTACK_SECRET_KEY", "");
    expect(await startDepositCheckout(applicationId)).toEqual({
      success: false, error: "Online deposits are not available yet.",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("should refuse live keys until deposits are switched on for real", async () => {
    vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_live_abc");
    expect((await startDepositCheckout(applicationId)).success).toBe(false);
    expect(mocks.createPaystackClient).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("should open a live checkout once live payments are switched on", async () => {
    vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_live_abc");
    vi.stubEnv("PAYSTACK_LIVE_PAYMENTS", "enabled");
    expect((await startDepositCheckout(applicationId)).success).toBe(true);
    expect(mocks.createPaystackClient).toHaveBeenCalledWith({ secretKey: "sk_live_abc" });
  });

  it("should stop a renter who retries too often", async () => {
    mocks.rateLimit.mockResolvedValue({ success: false });
    expect((await startDepositCheckout(applicationId)).success).toBe(false);
    expect(mocks.rateLimit).toHaveBeenCalledWith(expect.objectContaining({ key: `deposit-checkout:${renterId}` }));
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["Deposit already paid", "Your deposit is already paid."],
    ["Application is not approved", "The landlord has not approved this application yet."],
    ["Online deposits are not enabled for this listing", "This listing does not take deposits online. Message the landlord to arrange it."],
  ])("should explain the database refusal %s", async (message, expected) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PT409", message } });
    expect(await startDepositCheckout(applicationId)).toEqual({ success: false, error: expected });
    expect(mocks.initializeTransaction).not.toHaveBeenCalled();
  });

  it("should not reveal whether someone else's application exists", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Application not found or access denied" } });
    expect(await startDepositCheckout(applicationId)).toEqual({ success: false, error: "This application is unavailable." });
  });

  it("should need an email address for the Paystack receipt", async () => {
    mocks.requirePersona.mockResolvedValue({ user: { id: renterId, email: undefined } });
    expect((await startDepositCheckout(applicationId)).success).toBe(false);
    expect(mocks.initializeTransaction).not.toHaveBeenCalled();
  });
});

describe("saveOwnerPayoutAccount", () => {
  const ownerId = "10000000-0000-4000-8000-000000000002";
  const input = { accountHolder: " Thandi Owner ", bankName: "FNB", branchCode: "250 655", accountNumber: "6200 0000 001" };
  const saved = {
    accountHolder: "Thandi Owner", bankName: "FNB", branchCode: "250655", accountLast4: "0001",
    updatedAt: "2026-11-16T08:00:00+00:00",
  };

  beforeEach(() => {
    mocks.requirePersona.mockResolvedValue({ user: { id: ownerId, email: "owner@example.com" } });
    mocks.claims.mockResolvedValue({ data: { claims: { sub: ownerId, session_id: sessionId } }, error: null });
    mocks.rpc.mockResolvedValue({ data: saved, error: null });
  });

  it("should save tidied bank details through the database and return only the masked summary", async () => {
    await expect(saveOwnerPayoutAccount(input)).resolves.toEqual({ success: true, data: saved });
    expect(mocks.requirePersona).toHaveBeenCalledWith("landlord");
    expect(mocks.rpc).toHaveBeenCalledWith("pinpoint_owner_payout_account_save", {
      actor_id: ownerId, actor_session_id: sessionId, new_account_holder: "Thandi Owner",
      new_bank_name: "FNB", new_branch_code: "250655", new_account_number: "62000000001",
    });
  });

  it("should point at each field that is wrong without touching the database", async () => {
    const result = await saveOwnerPayoutAccount({ ...input, branchCode: "123", accountNumber: "12" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(Object.keys((result.details as { fieldErrors: Record<string, string[]> }).fieldErrors).sort())
      .toEqual(["accountNumber", "branchCode"]);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("should reject a session whose claims name another person", async () => {
    mocks.claims.mockResolvedValue({ data: { claims: { sub: "someone-else", session_id: sessionId } }, error: null });
    expect((await saveOwnerPayoutAccount(input)).success).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("should limit how often bank details can be changed", async () => {
    mocks.rateLimit.mockResolvedValue({ success: false });
    expect((await saveOwnerPayoutAccount(input)).success).toBe(false);
    expect(mocks.rateLimit).toHaveBeenCalledWith({ key: `payout-account:${ownerId}`, requests: 5, window: "10 m" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("should never log the account number when the database refuses", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom 62000000001" } });
    expect(await saveOwnerPayoutAccount(input)).toEqual({ success: false, error: "We could not save your bank details. Try again." });
    const logged = JSON.stringify([...mocks.logger.error.mock.calls, ...mocks.logger.warn.mock.calls, ...mocks.logger.info.mock.calls]);
    expect(logged).not.toContain("62000000001");
    expect(logged).not.toContain("boom");
  });

  it("should ask the owner to sign in again when the database rejects the session", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Access denied" } });
    expect(await saveOwnerPayoutAccount(input)).toEqual({ success: false, error: "Sign in again before changing your bank details." });
  });

  it("should refuse a reply that carries more than the masked summary", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...saved, accountLast4: "62000000001" }, error: null });
    expect((await saveOwnerPayoutAccount(input)).success).toBe(false);
  });
});
