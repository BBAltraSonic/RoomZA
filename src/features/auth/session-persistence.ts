import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export const REMEMBER_ME_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function isSupabaseAuthCookie(name: string) {
  return name.startsWith("sb-") && name.includes("auth-token");
}

export function authCookieOptions(remember: boolean): Partial<ResponseCookie> {
  return {
    path: "/",
    // @supabase/ssr shares the auth session between server and browser clients.
    // The browser must be able to read and refresh these cookies for MFA and
    // other authenticated client-side operations.
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: remember ? REMEMBER_ME_SESSION_MAX_AGE_SECONDS : undefined,
  };
}
