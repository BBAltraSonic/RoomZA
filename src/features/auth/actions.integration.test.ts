import { beforeEach, describe, expect, it, vi } from "vitest";

import { LOGIN_FAILURE_MESSAGE } from "@/features/auth/login-lockout";
import { PASSWORD_RESET_INVALID_MESSAGE, PASSWORD_RESET_SUCCESS_MESSAGE } from "@/features/auth/password-reset";

type RedirectError = Error & { path: string };

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  createClient: vi.fn(),
  rpc: vi.fn(),
  requestHeaders: new Headers(),
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
  headers: () => Promise.resolve(mocks.requestHeaders),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => { const client = await mocks.createClient(); return { ...client, rpc: client.rpc ?? mocks.rpc }; },
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
  signInAction,
  signInWithGoogleAction,
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
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    mocks.requestHeaders = new Headers();
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

  it("starts Google with a PKCE callback on the current origin and the requested return path", async () => {
    mocks.requestHeaders = new Headers({ host: "localhost:3000", "x-forwarded-proto": "http" });
    const signInWithOAuth = vi.fn(async () => ({ data: { url: "https://project.supabase.co/auth/v1/authorize?provider=google" }, error: null }));
    mocks.createClient.mockResolvedValue({ auth: { signInWithOAuth } });
    await expectRedirect(signInWithGoogleAction({}, formData({ redirect: "/saved?view=homes" })), "https://project.supabase.co/auth/v1/authorize?provider=google");
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "http://localhost:3000/auth/callback?next=%2Fsaved%3Fview%3Dhomes", skipBrowserRedirect: true },
    });
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "/auth/callback"])("rejects unsafe Google return path %s", async (path) => {
    mocks.requestHeaders = new Headers({ host: "roomza.pinpoint-roomza.workers.dev" });
    const signInWithOAuth = vi.fn(async () => ({ data: { url: "https://project.supabase.co/auth/v1/authorize" }, error: null }));
    mocks.createClient.mockResolvedValue({ auth: { signInWithOAuth } });
    await expectRedirect(signInWithGoogleAction({}, formData({ redirect: path })), "https://project.supabase.co/auth/v1/authorize");
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "https://roomza.pinpoint-roomza.workers.dev/auth/callback?next=%2F", skipBrowserRedirect: true },
    });
  });

  it("shows a recoverable Google error when the provider fails", async () => {
    mocks.requestHeaders = new Headers({ host: "roomza.local" });
    mocks.createClient.mockResolvedValue({ auth: { signInWithOAuth: vi.fn(async () => ({ data: { url: null }, error: { message: "provider failure" } })) } });
    expect(await signInWithGoogleAction({}, formData({}))).toEqual({ message: "Google sign-in could not start. Please try again." });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("handles a failed Google request without swallowing a successful redirect", async () => {
    mocks.requestHeaders = new Headers({ host: "roomza.local" });
    mocks.createClient.mockRejectedValue(new Error("network failure"));
    expect(await signInWithGoogleAction({}, formData({}))).toEqual({ message: "Google sign-in could not start. Please try again." });
    expect(mocks.redirect).not.toHaveBeenCalled();
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

  it("returns a landlord account to its requested consumer workflow", async () => {
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
      "/applications",
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

  it("continues a successful login when both email markers are missing", async () => {
    const { from } = profileQuery({ role: "renter", email_verified_at: null }, [{ persona: "renter", is_primary: true, is_active: true }]);
    mocks.createClient.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn(async () => ({ error: null })),
        getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
      },
      from,
    });

    await expectRedirect(
      signInAction({}, formData({ email: "renter@example.com", password: "secret123", redirect: "/applications" })),
      "/applications",
    );
  });

  it.each([
    ["renter", "/"],
    ["buyer", "/"],
    ["landlord", "/"],
    ["seller", "/"],
  ])("creates a %s workspace without an email verification step", async (role, destination) => {
    const { from, profileBuilder, personaBuilder } = profileQuery({ role: null });
    const signUp = vi.fn(async () => ({
      data: {
        user: { id: "user-1", email: "new@example.com", email_confirmed_at: null },
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
    expect(signUp).toHaveBeenCalledWith({ email: "new@example.com", password: "secret123" });
    expect(mocks.rpc).toHaveBeenCalledWith("ensure_marketplace_account");
    expect(profileBuilder.upsert).not.toHaveBeenCalledWith(expect.objectContaining({ id: "user-1" }), expect.anything());
    expect(profileBuilder.select).toHaveBeenCalledWith("id");
    expect(personaBuilder.insert).not.toHaveBeenCalled();
  });

  it("shows a retryable error when account capability setup fails", async () => {
    const { from } = profileQuery({ role: null });
    mocks.rpc.mockResolvedValueOnce({ error: { message: "Database unavailable" } });
    mocks.createClient.mockResolvedValue({
      auth: { signUp: vi.fn(async () => ({ data: { user: { id: "user-1", email: "new@example.com", email_confirmed_at: "2026-10-08T00:00:00Z" }, session: { access_token: "token" } }, error: null })) }, from,
    });
    await expect(signUpAction({}, formData({ email: "new@example.com", password: "secret123", confirmPassword: "secret123", acceptPolicies: "on", redirect: "/dashboard" }))).resolves.toEqual({ message: "Your account was created, but setup could not finish. Sign in to retry." });
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

  it("offers sign-in without promising an email when the provider returns no session", async () => {
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
      message: "Account setup could not finish. Try signing in with your email and password.",
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

  it.each(["admin", "owner", "reviewer", "", null])("does not use supplied legacy role %s as an authorization grant", async role => {
    const signUp = vi.fn(async () => ({ data: { user: { id: "user-1" }, session: { access_token: "token" } }, error: null }));
    const { from } = profileQuery({ role: null });
    mocks.createClient.mockResolvedValue({ auth: { signUp }, from });
    const input = formData({ email: "new@example.com", password: "secret123", confirmPassword: "secret123", acceptPolicies: "on" });
    if (role !== null) input.set("role", role);
    await expectRedirect(signUpAction({}, input), "/");
    expect(signUp).toHaveBeenCalledWith({ email: "new@example.com", password: "secret123" });
    expect(mocks.rpc).toHaveBeenCalledWith("ensure_marketplace_account");
  });

  it("preserves a compatible poster return path after signup", async () => {
    const { from } = profileQuery({ role: null });
    mocks.createClient.mockResolvedValue({
      auth: { signUp: vi.fn(async () => ({ data: { user: { id: "user-1", email: "new@example.com", email_confirmed_at: "2026-10-08T00:00:00Z" }, session: { access_token: "token" } }, error: null })) }, from,
    });
    await expectRedirect(signUpAction({}, formData({ email: "new@example.com", password: "secret123", confirmPassword: "secret123", role: "seller", acceptPolicies: "on", redirect: "/post/entries/event" })), "/post/entries/event");
  });

  it("lets a former renter enter listing management", async () => {
    const { from } = profileQuery({ role: null });
    mocks.createClient.mockResolvedValue({
      auth: { signUp: vi.fn(async () => ({ data: { user: { id: "user-1", email: "new@example.com", email_confirmed_at: "2026-10-08T00:00:00Z" }, session: { access_token: "token" } }, error: null })) }, from,
    });
    await expectRedirect(signUpAction({}, formData({ email: "new@example.com", password: "secret123", confirmPassword: "secret123", role: "renter", acceptPolicies: "on", redirect: "/dashboard" })), "/dashboard");
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
