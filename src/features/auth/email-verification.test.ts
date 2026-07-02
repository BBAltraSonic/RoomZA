import { describe, expect, it } from "vitest";

import {
  buildEmailVerificationEmail,
  createEmailVerificationExpiry,
  EMAIL_VERIFICATION_TOKEN_TTL_MS,
  isEmailVerificationTokenUsable,
  normalizeVerificationEmail,
  type EmailVerificationTokenRecord,
} from "./email-verification";

describe("email verification token rules", () => {
  const now = new Date("2026-07-01T10:00:00.000Z");

  it("normalizes email addresses before lookup or token creation", () => {
    expect(normalizeVerificationEmail("  Alice@Example.COM ")).toBe("alice@example.com");
  });

  it("creates a 24 hour expiry", () => {
    expect(createEmailVerificationExpiry(now).getTime() - now.getTime()).toBe(EMAIL_VERIFICATION_TOKEN_TTL_MS);
  });

  it("accepts only unused, unexpired verification tokens", () => {
    const usable: EmailVerificationTokenRecord = { expiresAt: new Date(now.getTime() + 1), usedAt: null };
    expect(isEmailVerificationTokenUsable(null, now)).toBe(false);
    expect(isEmailVerificationTokenUsable(usable, now)).toBe(true);
    expect(isEmailVerificationTokenUsable({ expiresAt: new Date(now.getTime()), usedAt: null }, now)).toBe(false);
    expect(isEmailVerificationTokenUsable({ expiresAt: new Date(now.getTime() + 1), usedAt: now }, now)).toBe(false);
  });

  it("renders a verification email with the link and 24 hour window", () => {
    const html = buildEmailVerificationEmail("https://roomza.app/auth/verify-email?token=abc");
    expect(html).toContain("https://roomza.app/auth/verify-email?token=abc");
    expect(html).toContain("24 hours");
  });
});
