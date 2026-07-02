import { describe, expect, it } from "vitest";

import {
  buildPasswordResetEmail,
  createPasswordResetExpiry,
  isPasswordResetTokenUsable,
  PASSWORD_RESET_TOKEN_TTL_MS,
} from "./password-reset";

describe("password reset token rules", () => {
  const now = new Date("2026-06-30T10:00:00.000Z");

  it("creates a 60 minute expiry", () => {
    expect(createPasswordResetExpiry(now).getTime() - now.getTime()).toBe(PASSWORD_RESET_TOKEN_TTL_MS);
  });

  it("accepts only unused, unexpired reset tokens", () => {
    expect(isPasswordResetTokenUsable(null, now)).toBe(false);
    expect(isPasswordResetTokenUsable({ expiresAt: new Date(now.getTime() + 1), usedAt: null }, now)).toBe(true);
    expect(isPasswordResetTokenUsable({ expiresAt: new Date(now.getTime()), usedAt: null }, now)).toBe(false);
    expect(isPasswordResetTokenUsable({ expiresAt: new Date(now.getTime() + 1), usedAt: now }, now)).toBe(false);
  });

  it("renders a reset email with the link and 60 minute window", () => {
    const html = buildPasswordResetEmail("https://roomza.app/auth/reset-password?token=abc");
    expect(html).toContain("https://roomza.app/auth/reset-password?token=abc");
    expect(html).toContain("60 minutes");
  });
});
