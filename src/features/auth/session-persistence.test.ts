import { describe, expect, it } from "vitest";

import { authCookieOptions, isSupabaseAuthCookie, REMEMBER_ME_SESSION_MAX_AGE_SECONDS } from "./session-persistence";

describe("auth session persistence", () => {
  it("identifies Supabase auth cookies", () => {
    expect(isSupabaseAuthCookie("sb-project-auth-token")).toBe(true);
    expect(isSupabaseAuthCookie("sb-project-auth-token.0")).toBe(true);
    expect(isSupabaseAuthCookie("sb-project-code-verifier")).toBe(false);
    expect(isSupabaseAuthCookie("other")).toBe(false);
  });

  it("adds a 30 day max age when remember me is selected", () => {
    expect(authCookieOptions(true)).toMatchObject({
      maxAge: REMEMBER_ME_SESSION_MAX_AGE_SECONDS,
      path: "/",
      httpOnly: false,
      sameSite: "lax",
    });
  });

  it("leaves auth cookies as session cookies without remember me", () => {
    expect(authCookieOptions(false).maxAge).toBeUndefined();
  });

  it("keeps Supabase auth cookies browser-readable for SSR client session refresh and MFA", () => {
    expect(authCookieOptions(false).httpOnly).toBe(false);
  });
});
