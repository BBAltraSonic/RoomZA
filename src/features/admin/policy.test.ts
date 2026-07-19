import { describe, expect, it } from "vitest";

import { csvCell, toCsv } from "./csv";
import { sanitizeAuditMetadata } from "./audit-sanitize";
import { reportSchema } from "./schemas";
import { adminMfaDestination, adminMfaEnrollmentError, boundedAdminLimit, canManageAdminMembership, canSuspendTarget, isSensitiveGrantActive, isSuspensionActive, requiredAdminFactors, shouldEnterAdminWorkspace } from "./policy";

describe("admin permission and security policy", () => {
  it("enforces the owner/admin permission matrix", () => {
    expect(canManageAdminMembership("owner")).toBe(true);
    expect(canManageAdminMembership("admin")).toBe(false);
    expect(canSuspendTarget(false)).toBe(true);
    expect(canSuspendTarget(true)).toBe(false);
  });

  it("routes MFA setup and challenge using factor-count rules", () => {
    expect(requiredAdminFactors("owner")).toBe(2);
    expect(requiredAdminFactors("admin")).toBe(1);
    expect(adminMfaDestination({ level: "owner", verifiedFactors: 1, assuranceLevel: "aal2" })).toBe("/admin/security/mfa/setup");
    expect(adminMfaDestination({ level: "admin", verifiedFactors: 1, assuranceLevel: "aal1" })).toBe("/admin/security/mfa/challenge");
    expect(adminMfaDestination({ level: "owner", verifiedFactors: 2, assuranceLevel: "aal2" })).toBeNull();
  });

  it("routes active admins without a persona or with an admin target away from role onboarding", () => {
    expect(shouldEnterAdminWorkspace({ hasActiveMembership: true, hasPersona: false, requestedPath: "/" })).toBe(true);
    expect(shouldEnterAdminWorkspace({ hasActiveMembership: true, hasPersona: true, requestedPath: "/admin" })).toBe(true);
    expect(shouldEnterAdminWorkspace({ hasActiveMembership: true, hasPersona: true, requestedPath: "/applications" })).toBe(false);
    expect(shouldEnterAdminWorkspace({ hasActiveMembership: false, hasPersona: false, requestedPath: "/admin" })).toBe(false);
  });

  it("turns missing-session MFA claims into an actionable recovery message", () => {
    expect(adminMfaEnrollmentError("invalid claim: missing sub claim")).toBe("Your sign-in session needs to be refreshed before MFA can start.");
    expect(adminMfaEnrollmentError("network unavailable")).toBe("We could not start MFA. Sign in again and retry.");
  });

  it("validates exactly one report target and detail bounds", () => {
    const base = { category: "safety", details: "A specific safety concern with enough detail." };
    expect(reportSchema.safeParse({ ...base, listingId: "0bca1133-8cec-4628-b4c6-8937d3d71f21" }).success).toBe(true);
    expect(reportSchema.safeParse({ ...base, listingId: "0bca1133-8cec-4628-b4c6-8937d3d71f21", reportedUserId: "98425013-182d-4f30-a838-a5a5e6772960" }).success).toBe(false);
    expect(reportSchema.safeParse({ ...base, details: "too short" }).success).toBe(false);
  });

  it("caps cursor-page limits and expires restrictions and grants", () => {
    const now = new Date("2026-07-13T12:00:00Z");
    expect(boundedAdminLimit()).toBe(50);
    expect(boundedAdminLimit(999)).toBe(100);
    expect(isSuspensionActive({ suspended_until: "2026-07-13T12:01:00Z" }, now)).toBe(true);
    expect(isSuspensionActive({ suspended_until: "2026-07-13T11:59:00Z" }, now)).toBe(false);
    expect(isSensitiveGrantActive({ expires_at: "2026-07-13T12:15:00Z" }, now)).toBe(true);
    expect(isSensitiveGrantActive({ expires_at: "2026-07-13T11:59:00Z" }, now)).toBe(false);
  });

  it("sanitizes audit metadata and spreadsheet cells", () => {
    expect(sanitizeAuditMetadata({ status: "open", messageBody: "private", documentUrl: "secret" })).toEqual({ status: "open" });
    expect(csvCell("=HYPERLINK(\"bad\")")).toBe('"\'=HYPERLINK(""bad"")"');
    expect(toCsv(["name"], [["a\nb"]])).toBe('"name"\r\n"a b"');
  });
});
