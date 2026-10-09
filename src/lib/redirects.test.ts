import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { emailVerificationPathForRedirect, getOnboardingDestination, getRoleAwareRedirect, getPersonaAwareRedirect, isEntryWorkspacePath, isOfferWorkspacePath, isPosterWorkspacePath, safeRedirectPath } from "@/lib/redirects";

describe("independent offer workspace return", () => {
  it("returns every Property persona and role to public offer details after sign-in", () => {
    const offer = "/offers/55555555-5555-4555-8555-555555555555?from=report";
    for (const persona of ["renter", "buyer", "landlord", "seller"] as const) {
      expect(getPersonaAwareRedirect(persona, offer)).toBe(offer);
    }
    for (const role of ["renter", "landlord"] as const) expect(getRoleAwareRedirect(role, offer)).toBe(offer);
    expect(getRoleAwareRedirect("renter", "/admin/reports")).toBe("/");
    expect(getPersonaAwareRedirect("buyer", "//elsewhere.invalid/offers/abc")).toBe("/");
  });
  it("preserves poster paths for each Property persona without granting other workspaces", () => {
    for (const persona of ["renter", "buyer", "landlord", "seller"] as const) {
      expect(getPersonaAwareRedirect(persona, "/post/offers/abc")).toBe("/post/offers/abc");
    }
    expect(getRoleAwareRedirect("renter", "/post/offers")).toBe("/post/offers");
    expect(isOfferWorkspacePath("/post/offers-fake")).toBe(false);
    expect(isOfferWorkspacePath("https://elsewhere.invalid/post/offers")).toBe(false);
  });
});

describe("independent Tourism/Event poster return", () => {
  it("preserves entry workspace paths for every role and persona", () => {
    const path = "/post/entries/event/55555555-5555-4555-8555-555555555555";
    for (const persona of ["renter", "buyer", "landlord", "seller"] as const) {
      expect(getPersonaAwareRedirect(persona, path)).toBe(path);
    }
    for (const role of ["renter", "landlord"] as const) expect(getRoleAwareRedirect(role, path)).toBe(path);
    expect(isEntryWorkspacePath("/post/entries-fake")).toBe(false);
    expect(isEntryWorkspacePath("https://elsewhere.invalid/post/entries")).toBe(false);
    expect(isPosterWorkspacePath("/post/entries/tourism")).toBe(true);
  });
});

describe("shared discovery sign-in return", () => {
  const destinations = [
    "/services?view=map&areaId=55555555-5555-4555-8555-555555555555&q=plumber&sort=Nearest&serviceType=Plumbing",
    "/post/services",
    "/post/services/55555555-5555-4555-8555-555555555555",
    "/specials/55555555-5555-4555-8555-555555555555?from=discovery#details",
  ];

  it("returns all Property roles and personas to bounded public and poster destinations", () => {
    for (const destination of destinations) {
      for (const persona of ["renter", "buyer", "landlord", "seller"] as const)
        expect(getPersonaAwareRedirect(persona, destination)).toBe(destination);
      for (const role of ["renter", "landlord"] as const)
        expect(getRoleAwareRedirect(role, destination)).toBe(destination);
    }
    expect(isPosterWorkspacePath("/post/services")).toBe(true);
    expect(isPosterWorkspacePath("/post/services/55555555-5555-4555-8555-555555555555")).toBe(true);
  });

  it("does not admit lookalikes, private admin paths or incompatible Property workspaces", () => {
    for (const path of ["/services-admin", "/services/private", "/post/services-fake", "/specials/admin", "/specials/55555555-5555-4555-8555-555555555555/private", "/admin/services", "/dashboard/listings/new"]) {
      expect(getRoleAwareRedirect("renter", path)).toBe("/");
      expect(getPersonaAwareRedirect("buyer", path)).toBe("/");
    }
    expect(getPersonaAwareRedirect("seller", "/applications")).toBe("/dashboard");
    expect(isPosterWorkspacePath("/post/services-fake")).toBe(false);
    expect(isPosterWorkspacePath("//elsewhere.invalid/post/services")).toBe(false);
  });
});

describe("safeRedirectPath", () => {
  it("keeps relative paths with search params", () => {
    expect(safeRedirectPath("/listing/abc?intent=apply")).toBe("/listing/abc?intent=apply");
  });

  it("rejects external and protocol-relative redirects", () => {
    expect(safeRedirectPath("https://evil.example/dashboard", "/applications")).toBe("/applications");
    expect(safeRedirectPath("//evil.example/dashboard", "/applications")).toBe("/applications");
  });

  it("rejects auth callback and sign-out loops", () => {
    expect(safeRedirectPath("/auth/callback?next=/dashboard", "/")).toBe("/");
    expect(safeRedirectPath("/auth/sign-out", "/")).toBe("/");
  });

  it("Property 8: Post-login redirect target is always a safe internal path", () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        const redirect = safeRedirectPath(value, "/applications");
        expect(redirect.startsWith("/")).toBe(true);
        expect(redirect.startsWith("//")).toBe(false);

        const url = new URL(redirect, "https://roomza.local");
        expect(url.origin).toBe("https://roomza.local");
        expect(url.pathname.startsWith("/auth/callback")).toBe(false);
        expect(url.pathname.startsWith("/auth/sign-out")).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});

describe("getRoleAwareRedirect", () => {
  it("keeps compatible renter routes", () => {
    expect(getRoleAwareRedirect("renter", "/applications")).toBe("/applications");
    expect(getRoleAwareRedirect("renter", "/listing/abc?intent=message")).toBe("/listing/abc?intent=message");
    expect(getRoleAwareRedirect("renter", "/live-tours/tour-123")).toBe("/live-tours/tour-123");
  });

  it("keeps compatible landlord routes", () => {
    expect(getRoleAwareRedirect("landlord", "/dashboard/listings/new")).toBe("/dashboard/listings/new");
    expect(getRoleAwareRedirect("landlord", "/messages/abc")).toBe("/messages/abc");
    expect(getRoleAwareRedirect("landlord", "/live-tours/tour-123")).toBe("/live-tours/tour-123");
  });

  it("falls back when the role cannot use the requested workspace", () => {
    expect(getRoleAwareRedirect("renter", "/dashboard")).toBe("/");
    expect(getRoleAwareRedirect("landlord", "/applications")).toBe("/dashboard");
  });
});

describe("getOnboardingDestination", () => {
  it("routes new personas to their first-value workspace", () => {
    expect(getOnboardingDestination("renter", "/")).toBe("/?welcome=renter");
    expect(getOnboardingDestination("landlord", "/")).toBe("/dashboard");
  });

  it("preserves compatible protected deep links", () => {
    expect(getOnboardingDestination("renter", "/saved")).toBe("/saved");
    expect(getOnboardingDestination("landlord", "/dashboard/listings/new")).toBe("/dashboard/listings/new");
  });

  it("falls back safely for incompatible or unsafe targets", () => {
    expect(getOnboardingDestination("renter", "/dashboard")).toBe("/");
    expect(getOnboardingDestination("landlord", "https://evil.example")).toBe("/dashboard");
  });
});

describe("emailVerificationPathForRedirect", () => {
  it("keeps the original safe route for post-verification continuation", () => {
    expect(emailVerificationPathForRedirect("/dashboard/listings/new", "sent")).toBe(
      "/auth/verify-email?status=sent&redirect=%2Fdashboard%2Flistings%2Fnew",
    );
  });

  it("falls back when the requested route is unsafe", () => {
    expect(emailVerificationPathForRedirect("https://evil.example/dashboard")).toBe(
      "/auth/verify-email?status=pending&redirect=%2F",
    );
  });
});
