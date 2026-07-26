import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { emailVerificationPathForRedirect, getOnboardingDestination, getRoleAwareRedirect, safeRedirectPath } from "@/lib/redirects";

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
