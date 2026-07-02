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
  requestEmailVerificationByEmail: vi.fn(),
  requestEmailVerificationForUser: vi.fn(),
  requestPasswordReset: vi.fn(),
  consumePasswordResetToken: vi.fn(),
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

vi.mock("@/features/auth/login-lockout-store", () => ({
  readLoginLockout: (email: string) => mocks.readLoginLockout(email),
  recordFailedLogin: (emailHash: string) => mocks.recordFailedLogin(emailHash),
  clearLoginFailures: (emailHash: string) => mocks.clearLoginFailures(emailHash),
}));

vi.mock("@/features/auth/password-reset-store", () => ({
  requestPasswordReset: (email: string, origin: string) => mocks.requestPasswordReset(email, origin),
  consumePasswordResetToken: (token: string, password: string) => mocks.consumePasswordResetToken(token, password),
}));

vi.mock("@/features/auth/email-verification-store", () => ({
  requestEmailVerificationByEmail: (email: string, redirectPath: string) => mocks.requestEmailVerificationByEmail(email, redirectPath),
  requestEmailVerificationForUser: (userId: string, email: string, redirectPath: string) => mocks.requestEmailVerificationForUser(userId, email, redirectPath),
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

function profileQuery(data: { role: string | null; email_verified_at?: string | null } | null) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    upsert: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
    single: vi.fn(async () => ({ data, error: null })),
  };

  return query;
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
    mocks.requestEmailVerificationByEmail.mockResolvedValue(undefined);
    mocks.requestEmailVerificationForUser.mockResolvedValue(undefined);
    mocks.requestPasswordReset.mockResolvedValue(undefined);
    mocks.consumePasswordResetToken.mockResolvedValue({ ok: true });
  });

  it("redirects a successful landlord login to the role home route", async () => {
    const query = profileQuery({ role: "landlord", email_verified_at: "2026-07-01T00:00:00.000Z" });
    mocks.createClient.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn(async () => ({ error: null })),
        getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
      },
      from: vi.fn(() => query),
    });

    await expectRedirect(
      signInAction({}, formData({ email: "landlord@example.com", password: "secret123", redirect: "/applications" })),
      "/dashboard",
    );

    expect(mocks.clearLoginFailures).toHaveBeenCalledWith("email-hash");
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
    const query = profileQuery({ role: "renter", email_verified_at: null });
    mocks.createClient.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn(async () => ({ error: null })),
        getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
      },
      from: vi.fn(() => query),
    });

    await expectRedirect(
      signInAction({}, formData({ email: "renter@example.com", password: "secret123", redirect: "/applications" })),
      "/auth/verify-email?status=pending&redirect=%2Fapplications",
    );
  });

  it("holds a successful signup with an immediate session on email verification", async () => {
    const query = profileQuery({ role: null });
    mocks.createClient.mockResolvedValue({
      auth: {
        signUp: vi.fn(async () => ({
          data: {
            user: { id: "user-1", email: "new@example.com" },
            session: { access_token: "token" },
          },
          error: null,
        })),
      },
      from: vi.fn(() => query),
    });

    await expectRedirect(
      signUpAction({}, formData({ email: "new@example.com", password: "secret123", origin: "https://roomza.test", redirect: "/dashboard" })),
      "/auth/verify-email?status=sent&redirect=%2Fdashboard",
    );
    expect(mocks.requestEmailVerificationForUser).toHaveBeenCalledWith("user-1", "new@example.com", "/dashboard");
  });

  it("returns a generic signup error when account creation fails", async () => {
    mocks.createClient.mockResolvedValue({
      auth: {
        signUp: vi.fn(async () => ({ data: { user: null, session: null }, error: { message: "Signup unavailable" } })),
      },
    });

    await expect(signUpAction({}, formData({ email: "new@example.com", password: "secret123" }))).resolves.toEqual({
      message: "Something went wrong. Please try again.",
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("returns the verification-sent message when signup requires sign-in after verification", async () => {
    const query = profileQuery({ role: null });
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
      from: vi.fn(() => query),
    });

    await expect(signUpAction({}, formData({ email: "new@example.com", password: "secret123" }))).resolves.toEqual({
      success: true,
      message: EMAIL_VERIFICATION_SENT_MESSAGE,
    });
    expect(mocks.requestEmailVerificationForUser).toHaveBeenCalledWith("user-1", "new@example.com", "/");
  });

  it("resends email verification without revealing whether the email exists", async () => {
    await expectRedirect(
      resendEmailVerificationAction(formData({ email: "new@example.com", redirect: "/applications" })),
      "/auth/verify-email?status=sent&redirect=%2Fapplications",
    );
    expect(mocks.requestEmailVerificationByEmail).toHaveBeenCalledWith("new@example.com", "/applications");
  });

  it("returns the same password-reset response after accepting a reset request", async () => {
    await expect(
      requestPasswordResetAction({}, formData({ email: "known@example.com", origin: "https://roomza.test" })),
    ).resolves.toEqual({
      success: true,
      message: PASSWORD_RESET_SUCCESS_MESSAGE,
    });
    expect(mocks.requestPasswordReset).toHaveBeenCalledWith("known@example.com", "https://roomza.test");
  });

  it("redirects after a valid password-reset token is consumed", async () => {
    await expectRedirect(
      updatePasswordAction({}, formData({ token: "token", password: "new-secret", confirmPassword: "new-secret" })),
      "/auth?reset=complete",
    );
  });

  it("rejects an invalid password-reset token without redirecting", async () => {
    mocks.consumePasswordResetToken.mockResolvedValueOnce({ ok: false });

    await expect(
      updatePasswordAction({}, formData({ token: "bad-token", password: "new-secret", confirmPassword: "new-secret" })),
    ).resolves.toEqual({
      message: PASSWORD_RESET_INVALID_MESSAGE,
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
