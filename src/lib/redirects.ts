import { getRoleHome, type Role } from "@/lib/roles";

const APP_ORIGIN = "https://roomza.local";

export function safeRedirectPath(value: FormDataEntryValue | string | null | undefined, fallback = "/") {
  if (typeof value !== "string") return fallback;

  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;

  try {
    const url = new URL(trimmed, APP_ORIGIN);
    if (url.origin !== APP_ORIGIN) return fallback;
    if (url.pathname.startsWith("/auth/callback") || url.pathname.startsWith("/auth/sign-out")) {
      return fallback;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function authPathForRedirect(path: string) {
  const redirect = safeRedirectPath(path, "/");
  return `/auth?redirect=${encodeURIComponent(redirect)}`;
}

export function onboardingPathForRedirect(path: string) {
  const redirect = safeRedirectPath(path, "/");
  return `/onboarding?redirect=${encodeURIComponent(redirect)}`;
}

export function emailVerificationPathForRedirect(path: string, status = "pending") {
  const redirect = safeRedirectPath(path, "/");
  return `/auth/verify-email?status=${encodeURIComponent(status)}&redirect=${encodeURIComponent(redirect)}`;
}

export function isRoleCompatibleRedirect(role: Role, path: string) {
  const { pathname } = new URL(safeRedirectPath(path, "/"), APP_ORIGIN);

  if (pathname === "/" || pathname.startsWith("/listing/") || pathname.startsWith("/messages/") || pathname.startsWith("/viewings/") || pathname === "/profile") {
    return true;
  }

  if (role === "renter") {
    return pathname === "/saved" || pathname === "/applications" || pathname === "/journey";
  }

  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

export function getRoleAwareRedirect(role: Role, requestedPath: string | null | undefined) {
  const redirect = safeRedirectPath(requestedPath, getRoleHome(role));
  return isRoleCompatibleRedirect(role, redirect) ? redirect : getRoleHome(role);
}
