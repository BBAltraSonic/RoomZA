import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export const REMEMBER_ME_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function isSupabaseAuthCookie(name: string) {
  return name.startsWith("sb-") && name.includes("auth-token");
}

export function authCookieOptions(remember: boolean): Partial<ResponseCookie> {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: remember ? REMEMBER_ME_SESSION_MAX_AGE_SECONDS : undefined,
  };
}
