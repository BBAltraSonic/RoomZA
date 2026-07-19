import type { AdminLevel } from "./types";

export function requiredAdminFactors(level: AdminLevel) {
  return level === "owner" ? 2 : 1;
}

export function adminMfaDestination(input: { level: AdminLevel; verifiedFactors: number; assuranceLevel: "aal1" | "aal2" | null }) {
  if (input.verifiedFactors < requiredAdminFactors(input.level)) return "/admin/security/mfa/setup";
  if (input.assuranceLevel !== "aal2") return "/admin/security/mfa/challenge";
  return null;
}

export function canManageAdminMembership(level: AdminLevel) {
  return level === "owner";
}

export function canSuspendTarget(targetHasActiveAdminMembership: boolean) {
  return !targetHasActiveAdminMembership;
}

export function isSuspensionActive(suspension: { restored_at?: string | null; suspended_until?: string | null }, now = new Date()) {
  return !suspension.restored_at && (!suspension.suspended_until || new Date(suspension.suspended_until) > now);
}

export function isSensitiveGrantActive(grant: { revoked_at?: string | null; expires_at: string }, now = new Date()) {
  return !grant.revoked_at && new Date(grant.expires_at) > now;
}

export function boundedAdminLimit(limit?: number) {
  return Math.min(100, Math.max(1, limit ?? 50));
}

export function shouldEnterAdminWorkspace(input: { hasActiveMembership: boolean; hasPersona: boolean; requestedPath: string }) {
  return input.hasActiveMembership && (!input.hasPersona || input.requestedPath === "/onboarding" || input.requestedPath.startsWith("/admin"));
}

export function adminMfaEnrollmentError(message: string) {
  if (/missing sub claim|invalid claim/i.test(message)) {
    return "Your sign-in session needs to be refreshed before MFA can start.";
  }
  return "We could not start MFA. Sign in again and retry.";
}
