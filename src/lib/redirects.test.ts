import { describe, expect, it } from "vitest";

import { getRoleAwareRedirect, safeRedirectPath } from "@/lib/redirects";

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
});

describe("getRoleAwareRedirect", () => {
  it("keeps compatible renter routes", () => {
    expect(getRoleAwareRedirect("renter", "/applications")).toBe("/applications");
    expect(getRoleAwareRedirect("renter", "/listing/abc?intent=message")).toBe("/listing/abc?intent=message");
  });

  it("keeps compatible landlord routes", () => {
    expect(getRoleAwareRedirect("landlord", "/dashboard/listings/new")).toBe("/dashboard/listings/new");
    expect(getRoleAwareRedirect("landlord", "/messages/abc")).toBe("/messages/abc");
  });

  it("falls back when the role cannot use the requested workspace", () => {
    expect(getRoleAwareRedirect("renter", "/dashboard")).toBe("/applications");
    expect(getRoleAwareRedirect("landlord", "/applications")).toBe("/dashboard");
  });
});
