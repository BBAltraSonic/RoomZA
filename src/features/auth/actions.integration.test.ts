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
    mocks.getAdminMembership.mockResolvedValue(null);
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

  it("redirects an active admin without a renter or landlord persona to the admin workspace", async () => {
    const query = profileQuery({ role: null, email_verified_at: "2026-07-01T00:00:00.000Z" });
    mocks.getAdminMembership.mockResolvedValue({ user_id: "user-1", level: "owner", revoked_at: null });
    mocks.createClient.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn(async () => ({ error: null })),
        getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
      },
      from: vi.fn(() => query),
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
    const signUp = vi.fn(async () => ({
      data: {
        user: { id: "user-1", email: "new@example.com" },
        session: { access_token: "token" },
      },
      error: null,
    }));
    mocks.createClient.mockResolvedValue({
      auth: { signUp },
      from: vi.fn(() => query),
    });

    await expectRedirect(
      signUpAction({}, formData({ email: "new@example.com", password: "secret123", origin: "https://roomza.test", redirect: "/dashboard" })),
      "/auth/verify-email?status=sent&redirect=%2Fdashboard",
    );
    expect(signUp).toHaveBeenCalledOnce();
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
