import { getRoleHome, type Role } from "@/lib/roles";
import { getPersonaHome, type MarketplacePersona } from "@/lib/personas";

const APP_ORIGIN = "https://roomza.local";

export function safeRedirectPath(
  value: FormDataEntryValue | string | null | undefined,
  fallback = "/",
) {
  if (typeof value !== "string") return fallback;

  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//"))
    return fallback;

  try {
    const url = new URL(trimmed, APP_ORIGIN);
    if (url.origin !== APP_ORIGIN) return fallback;
    if (
      url.pathname.startsWith("/auth/callback") ||
      url.pathname.startsWith("/auth/sign-out")
    ) {
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

export function isOfferWorkspacePath(path: string) {
  const { pathname } = new URL(safeRedirectPath(path, "/"), APP_ORIGIN);
  return pathname === "/post/offers" || pathname.startsWith("/post/offers/");
}

export function isEntryWorkspacePath(path: string) {
  const { pathname } = new URL(safeRedirectPath(path, "/"), APP_ORIGIN);
  return pathname === "/post/entries" || pathname.startsWith("/post/entries/");
}

export function isPosterWorkspacePath(path: string) {
  return isOfferWorkspacePath(path) || isEntryWorkspacePath(path) || isServiceWorkspacePath(path);
}

export function isServiceWorkspacePath(path: string) {
  const { pathname } = new URL(safeRedirectPath(path, "/"), APP_ORIGIN);
  return pathname === "/post/services" || pathname.startsWith("/post/services/");
}

function isPublicDiscoveryPath(pathname: string) {
  return pathname === "/services" ||
    /^\/specials\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pathname);
}

export function onboardingPathForRedirect(path: string) {
  const redirect = safeRedirectPath(path, "/");
  return `/onboarding?redirect=${encodeURIComponent(redirect)}`;
}

export function emailVerificationPathForRedirect(
  path: string,
  status = "pending",
) {
  const redirect = safeRedirectPath(path, "/");
  return `/auth/verify-email?status=${encodeURIComponent(status)}&redirect=${encodeURIComponent(redirect)}`;
}

export function mfaPathForRedirect(path: string) {
  const redirect = safeRedirectPath(path, "/");
  return `/auth/mfa?redirect=${encodeURIComponent(redirect)}`;
}

export function isRoleCompatibleRedirect(role: Role, path: string) {
  const { pathname } = new URL(safeRedirectPath(path, "/"), APP_ORIGIN);

  if (
    pathname === "/" ||
    pathname.startsWith("/listing/") ||
    pathname.startsWith("/live-tours/") ||
    pathname.startsWith("/messages/") ||
    pathname.startsWith("/viewings/") ||
    pathname === "/offers" || pathname.startsWith("/offers/") ||
    pathname === "/profile" ||
    pathname === "/post/offers" || pathname.startsWith("/post/offers/") ||
    isPosterWorkspacePath(path) ||
    isPublicDiscoveryPath(pathname)
  ) {
    return true;
  }

  if (role === "renter") {
    return (
      pathname === "/saved" ||
      pathname === "/applications" ||
      pathname === "/journey"
    );
  }

  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

export function getRoleAwareRedirect(
  role: Role,
  requestedPath: string | null | undefined,
) {
  const redirect = safeRedirectPath(requestedPath, getRoleHome(role));
  return isRoleCompatibleRedirect(role, redirect)
    ? redirect
    : getRoleHome(role);
}

export function getOnboardingDestination(
  role: Role,
  requestedPath: string | null | undefined,
) {
  const redirect = safeRedirectPath(requestedPath, getRoleHome(role));
  if (redirect === "/") {
    return role === "renter" ? "/?welcome=renter" : "/dashboard";
  }
  return getRoleAwareRedirect(role, redirect);
}

export function isPersonaCompatibleRedirect(
  persona: MarketplacePersona,
  path: string,
) {
  const { pathname } = new URL(safeRedirectPath(path, "/"), APP_ORIGIN);
  if (
    pathname === "/" ||
    pathname.startsWith("/listing/") ||
    pathname.startsWith("/live-tours/") ||
    pathname.startsWith("/messages/") ||
    pathname.startsWith("/viewings/") ||
    pathname === "/offers" || pathname.startsWith("/offers/") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/settings") ||
    pathname === "/post/offers" || pathname.startsWith("/post/offers/") ||
    isPosterWorkspacePath(path) ||
    isPublicDiscoveryPath(pathname)
  ) {
    return true;
  }
  if (persona === "renter")
    return (
      pathname === "/saved" ||
      pathname === "/applications" ||
      pathname === "/journey"
    );
  if (persona === "buyer")
    return pathname === "/saved" || pathname.startsWith("/purchases");
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

export function getPersonaAwareRedirect(
  persona: MarketplacePersona,
  requestedPath: string | null | undefined,
) {
  const redirect = safeRedirectPath(requestedPath, getPersonaHome(persona));
  return isPersonaCompatibleRedirect(persona, redirect)
    ? redirect
    : getPersonaHome(persona);
}

export function getPersonaOnboardingDestination(
  persona: MarketplacePersona,
  requestedPath: string | null | undefined,
) {
  const redirect = safeRedirectPath(requestedPath, getPersonaHome(persona));
  if (redirect === "/") {
    return persona === "renter" || persona === "buyer"
      ? `/?welcome=${persona}`
      : "/dashboard";
  }
  return getPersonaAwareRedirect(persona, redirect);
}
