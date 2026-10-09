import { beforeEach, describe, expect, it, vi } from "vitest";

import { LOGIN_FAILURE_MESSAGE } from "@/features/auth/login-lockout";
import { EMAIL_VERIFICATION_SENT_MESSAGE } from "@/features/auth/email-verification";
import { PASSWORD_RESET_INVALID_MESSAGE, PASSWORD_RESET_SUCCESS_MESSAGE } from "@/features/auth/password-reset";

type RedirectError = Error & { path: string };

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  createClient: vi.fn(),
  readLoginLockout: vi.fn(),
  recordFailedLogin: vi.fn(),
  clearLoginFailures: vi.fn(),
  getAdminMembership: vi.fn(),
  recordCurrentPolicyAcceptances: vi.fn(),
  recordSignupMarketingChoice: vi.fn(),
  cookieStore: {
    getAll: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => mocks.redirect(path),
}));

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve(mocks.cookieStore),
  headers: () => Promise.resolve(new Headers()),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mocks.createClient(),
}));

vi.mock("@/features/admin/auth", () => ({
  getAdminMembership: (userId: string) => mocks.getAdminMembership(userId),
}));

vi.mock("@/features/auth/login-lockout-store", () => ({
  readLoginLockout: (email: string) => mocks.readLoginLockout(email),
  recordFailedLogin: (emailHash: string) => mocks.recordFailedLogin(emailHash),
  clearLoginFailures: (emailHash: string) => mocks.clearLoginFailures(emailHash),
}));

vi.mock("@/features/trust/acceptance", () => ({
  recordCurrentPolicyAcceptances: (...args: unknown[]) => mocks.recordCurrentPolicyAcceptances(...args),
  recordSignupMarketingChoice: (...args: unknown[]) => mocks.recordSignupMarketingChoice(...args),
}));

import {
  requestPasswordResetAction,
  resendEmailVerificationAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
} from "@/features/auth/actions";

function redirectTo(path: string): never {
  const error = new Error("NEXT_REDIRECT") as RedirectError;
  error.path = path;
  throw error;
}

function formData(values: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) {
    form.set(key, value);
  }
  return form;
}

function expectRedirect(promise: Promise<unknown>, path: string) {
  return expect(promise).rejects.toMatchObject({ path });
}

function profileQuery(data: { role: string | null; email_verified_at?: string | null } | null, personas: Array<{ persona: string; is_primary: boolean; is_active: boolean }> = []) {
  const profileBuilder = {
    select: vi.fn(() => profileBuilder),
    eq: vi.fn(() => profileBuilder),
    upsert: vi.fn(() => profileBuilder),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
    single: vi.fn(async () => ({ data, error: null })),
  };

  const personaBuilder = {
    select: vi.fn(() => personaBuilder),
    eq: vi.fn(() => personaBuilder),
    order: vi.fn(() => Promise.resolve({ data: personas, error: null })),
    insert: vi.fn(async (): Promise<{ error: { message: string } | null }> => ({ error: null })),
  };

  return {
    profileBuilder,
    personaBuilder,
    from: vi.fn((table: string) => {
      if (table === "profile_personas") return personaBuilder;
      return profileBuilder;
    }),
  };
}

describe("auth server action workflows", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    mocks.redirect.mockImplementation(redirectTo);
    mocks.cookieStore.getAll.mockReturnValue([]);
    mocks.readLoginLockout.mockResolvedValue({
      ok: true,
      emailHash: "email-hash",
      record: null,
      status: { locked: false, lockedUntil: null },
    });
    mocks.recordFailedLogin.mockResolvedValue(true);
    mocks.clearLoginFailures.mockResolvedValue(undefined);
    mocks.getAdminMembership.mockResolvedValue(null);
    mocks.recordCurrentPolicyAcceptances.mockResolvedValue(undefined);
    mocks.recordSignupMarketingChoice.mockResolvedValue(undefined);
  });

  it("returns an eligible account without Property personas to its poster workspace", async () => {
    const { from } = profileQuery({ role: null, email_verified_at: "2026-07-01T00:00:00.000Z" });
    mocks.createClient.mockResolvedValue({
      auth: { signInWithPassword: vi.fn(async () => ({ error: null })), getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })) }, from,
    });
    await expectRedirect(signInAction({}, formData({ email: "poster@example.com", password: "secret123", redirect: "/post/offers" })), "/post/offers");
  });

  it.each(["/post/entries/tourism", "/post/services", "/post/services/55555555-5555-4555-8555-555555555555"])("returns a confirmed account without a Property persona to %s", async (destination) => {
    const { from } = profileQuery({ role: null, email_verified_at: "2026-07-01T00:00:00.000Z" });
    mocks.createClient.mockResolvedValue({
      auth: { signInWithPassword: vi.fn().mockResolvedValue({ error: null }), getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1", email_confirmed_at: "2026-07-01T00:00:00.000Z" } } }), mfa: { getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal1" } }) } },
      from,
    });
    await expectRedirect(signInAction({}, formData({ email: "poster@example.com", password: "secret123", redirect: destination })), destination);
  });

  it("uses Auth confirmation when a poster's profile verification marker is stale", async () => {
    const { from } = profileQuery({ role: null, email_verified_at: null });
    mocks.createClient.mockResolvedValue({
      auth: { signInWithPassword: vi.fn(async () => ({ error: null })), getUser: vi.fn(async () => ({ data: { user: { id: "user-1", email_confirmed_at: "2026-10-02T00:00:00Z" } } })) }, from,
    });
    await expectRedirect(signInAction({}, formData({ email: "poster@example.com", password: "secret123", redirect: "/post/offers" })), "/post/offers");
  });

  it("preserves an explicit poster return for an admin without Property personas", async () => {
    const { from } = profileQuery({ role: null, email_verified_at: "2026-07-01T00:00:00.000Z" });
    mocks.getAdminMembership.mockResolvedValue({ user_id: "user-1", level: "admin", revoked_at: null });
    mocks.createClient.mockResolvedValue({
      auth: { signInWithPassword: vi.fn(async () => ({ error: null })), getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })) }, from,
    });
    await expectRedirect(signInAction({}, formData({ email: "admin@example.com", password: "secret123", redirect: "/post/offers" })), "/post/offers");
  });

  it("redirects a successful landlord login to the role home route", async () => {
    const { from } = profileQuery(
      { role: "landlord", email_verified_at: "2026-07-01T00:00:00.000Z" },
      [{ persona: "landlord", is_primary: true, is_active: true }],
    );
    mocks.createClient.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn(async () => ({ error: null })),
        getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
      },
      from,
    });

    await expectRedirect(
      signInAction({}, formData({ email: "landlord@example.com", password: "secret123", redirect: "/applications" })),
      "/dashboard",
    );

    expect(mocks.clearLoginFailures).toHaveBeenCalledWith("email-hash");
  });

  it("redirects an active admin without a renter or landlord persona to the admin workspace", async () => {
    const { from } = profileQuery({ role: null, email_verified_at: "2026-07-01T00:00:00.000Z" });
    mocks.getAdminMembership.mockResolvedValue({ user_id: "user-1", level: "owner", revoked_at: null });
    mocks.createClient.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn(async () => ({ error: null })),
        getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
      },
      from,
    });

    await expectRedirect(
      signInAction({}, formData({ email: "owner@example.com", password: "secret123", redirect: "/admin" })),
      "/admin",
    );
    expect(mocks.getAdminMembership).toHaveBeenCalledWith("user-1");
  });

  it("fails closed before login when production rate limiting is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await expect(signInAction({}, formData({ email: "person@example.com", password: "secret123" }))).resolves.toEqual({
      message: "Too many requests. Try again later.",
    });
    expect(mocks.readLoginLockout).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("returns a non-enumerating login failure and records the failed attempt", async () => {
    mocks.createClient.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn(async () => ({ error: { message: "Invalid credentials" } })),
      },
    });

    await expect(signInAction({}, formData({ email: "person@example.com", password: "wrong-password" }))).resolves.toEqual({
      message: LOGIN_FAILURE_MESSAGE,
    });
    expect(mocks.recordFailedLogin).toHaveBeenCalledWith("email-hash");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("redirects a successful login to verification when the app email marker is missing", async () => {
    const { from } = profileQuery({ role: "renter", email_verified_at: null });
    mocks.createClient.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn(async () => ({ error: null })),
        getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
      },
      from,
    });

    await expectRedirect(
      signInAction({}, formData({ email: "renter@example.com", password: "secret123", redirect: "/applications" })),
      "/auth/verify-email?status=pending&redirect=%2Fapplications",
    );
  });

  it.each([
    ["renter", "/?welcome=renter"],
    ["buyer", "/?welcome=buyer"],
    ["landlord", "/dashboard"],
    ["seller", "/dashboard"],
  ])("creates a %s workspace without an email verification step", async (role, destination) => {
    const { from, profileBuilder, personaBuilder } = profileQuery({ role: null });
    const signUp = vi.fn(async () => ({
      data: {
        user: { id: "user-1", email: "new@example.com", email_confirmed_at: "2026-10-08T00:00:00Z" },
        session: { access_token: "token" },
      },
      error: null,
    }));
    mocks.createClient.mockResolvedValue({
      auth: { signUp },
      from,
    });

    await expectRedirect(
      signUpAction({}, formData({ email: "new@example.com", password: "secret123", confirmPassword: "secret123", role, acceptPolicies: "on" })),
      destination,
    );
    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ data: { signup_role: role } }) }));
    expect(profileBuilder.upsert).toHaveBeenCalledWith(expect.objectContaining({ email_verified_at: "2026-10-08T00:00:00Z" }), { onConflict: "id" });
    expect(personaBuilder.insert).toHaveBeenCalledWith({ profile_id: "user-1", persona: role, is_primary: true, is_active: true });
    expect(from).toHaveBeenCalledWith(`${role}_profile_details`);
  });

  it("returns to onboarding when role persistence fails", async () => {
    const { from, personaBuilder } = profileQuery({ role: null });
    personaBuilder.insert.mockResolvedValueOnce({ error: { message: "Database unavailable" } });
    mocks.createClient.mockResolvedValue({
      auth: { signUp: vi.fn(async () => ({ data: { user: { id: "user-1", email: "new@example.com", email_confirmed_at: "2026-10-08T00:00:00Z" }, session: { access_token: "token" } }, error: null })) }, from,
    });
    await expectRedirect(signUpAction({}, formData({ email: "new@example.com", password: "secret123", confirmPassword: "secret123", role: "seller", acceptPolicies: "on", redirect: "/dashboard" })), "/onboarding?error=save&redirect=%2Fdashboard");
  });

  it("returns a generic signup error when account creation fails", async () => {
    mocks.createClient.mockResolvedValue({
      auth: {
        signUp: vi.fn(async () => ({ data: { user: null, session: null }, error: { message: "Signup unavailable" } })),
      },
    });

    await expect(signUpAction({}, formData({ email: "new@example.com", password: "secret123", confirmPassword: "secret123", role: "renter", acceptPolicies: "on" }))).resolves.toEqual({
      message: "Something went wrong. Please try again.",
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("returns the verification-sent message when signup requires sign-in after verification", async () => {
    const { from } = profileQuery({ role: null });
    mocks.createClient.mockResolvedValue({
      auth: {
        signUp: vi.fn(async () => ({
          data: {
            user: { id: "user-1", email: "new@example.com" },
            session: null,
          },
          error: null,
        })),
      },
      from,
    });

    await expect(signUpAction({}, formData({ email: "new@example.com", password: "secret123", confirmPassword: "secret123", role: "renter", acceptPolicies: "on" }))).resolves.toEqual({
      success: true,
      message: EMAIL_VERIFICATION_SENT_MESSAGE,
    });
    expect(from).not.toHaveBeenCalled();
    expect(mocks.recordCurrentPolicyAcceptances).not.toHaveBeenCalled();
    expect(mocks.recordSignupMarketingChoice).not.toHaveBeenCalled();
  });

  it("rejects signup when the retyped password does not match", async () => {
    await expect(
      signUpAction({}, formData({
        email: "new@example.com",
        password: "secret123",
        confirmPassword: "different123",
        role: "renter",
        acceptPolicies: "on",
      })),
    ).resolves.toEqual({ message: "Passwords do not match." });

    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it.each(["admin", "owner", "reviewer", "", null])("rejects a missing or privileged signup role %s", async (role) => {
    const input = formData({ email: "new@example.com", password: "secret123", confirmPassword: "secret123", acceptPolicies: "on" });
    if (role !== null) input.set("role", role);
    await expect(signUpAction({}, input)).resolves.toEqual({ message: "Choose a valid account role." });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("preserves a compatible poster return path after signup", async () => {
    const { from } = profileQuery({ role: null });
    mocks.createClient.mockResolvedValue({
      auth: { signUp: vi.fn(async () => ({ data: { user: { id: "user-1", email: "new@example.com", email_confirmed_at: "2026-10-08T00:00:00Z" }, session: { access_token: "token" } }, error: null })) }, from,
    });
    await expectRedirect(signUpAction({}, formData({ email: "new@example.com", password: "secret123", confirmPassword: "secret123", role: "seller", acceptPolicies: "on", redirect: "/post/entries/event" })), "/post/entries/event");
  });

  it("does not send a renter into the provider dashboard", async () => {
    const { from } = profileQuery({ role: null });
    mocks.createClient.mockResolvedValue({
      auth: { signUp: vi.fn(async () => ({ data: { user: { id: "user-1", email: "new@example.com", email_confirmed_at: "2026-10-08T00:00:00Z" }, session: { access_token: "token" } }, error: null })) }, from,
    });
    await expectRedirect(signUpAction({}, formData({ email: "new@example.com", password: "secret123", confirmPassword: "secret123", role: "renter", acceptPolicies: "on", redirect: "/dashboard" })), "/");
  });

  it("resends email verification via Supabase without revealing whether the email exists", async () => {
    const resend = vi.fn(async () => ({ data: {}, error: null }));
    mocks.createClient.mockResolvedValue({ auth: { resend } });

    await expectRedirect(
      resendEmailVerificationAction(formData({ email: "new@example.com", redirect: "/applications" })),
      "/auth/verify-email?status=sent&redirect=%2Fapplications",
    );
    expect(resend).toHaveBeenCalledWith(
      expect.objectContaining({ type: "signup", email: "new@example.com" }),
    );
  });

  it("returns the same password-reset response after requesting a Supabase reset link", async () => {
    const resetPasswordForEmail = vi.fn(async () => ({ data: {}, error: null }));
    mocks.createClient.mockResolvedValue({ auth: { resetPasswordForEmail } });

    await expect(
      requestPasswordResetAction({}, formData({ email: "known@example.com", origin: "https://roomza.test" })),
    ).resolves.toEqual({
      success: true,
      message: PASSWORD_RESET_SUCCESS_MESSAGE,
    });
    expect(resetPasswordForEmail).toHaveBeenCalledWith(
      "known@example.com",
      expect.objectContaining({ redirectTo: expect.stringContaining("/auth/callback") }),
    );
  });

  it("redirects after updating the password from a recovery session", async () => {
    const updateUser = vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null }));
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
        updateUser,
      },
    });

    await expectRedirect(
      updatePasswordAction({}, formData({ password: "new-secret", confirmPassword: "new-secret" })),
      "/auth?reset=complete",
    );
    expect(updateUser).toHaveBeenCalledWith({ password: "new-secret" });
  });

  it("rejects a password update without a recovery session", async () => {
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null } })),
        updateUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      },
    });

    await expect(
      updatePasswordAction({}, formData({ password: "new-secret", confirmPassword: "new-secret" })),
    ).resolves.toEqual({
      message: PASSWORD_RESET_INVALID_MESSAGE,
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
