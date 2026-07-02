import { describe, expect, it } from "vitest";

import {
  getLoginLockoutStatus,
  LOGIN_LOCKOUT_DURATION_MS,
  MAX_FAILED_LOGIN_ATTEMPTS,
  nextFailedLoginAttempt,
  normalizeLoginIdentifier,
  type LoginAttemptRecord,
} from "./login-lockout";

describe("login lockout logic", () => {
  const now = new Date("2026-06-30T10:00:00.000Z");

  it("normalizes login identifiers before hashing or lookup", () => {
    expect(normalizeLoginIdentifier("  Alice@Example.COM ")).toBe("alice@example.com");
  });

  it("does not lock before the fifth consecutive failure", () => {
    let record: LoginAttemptRecord | null = null;

    for (let attempt = 1; attempt < MAX_FAILED_LOGIN_ATTEMPTS; attempt += 1) {
      record = nextFailedLoginAttempt(record, now);
      expect(record.attemptCount).toBe(attempt);
      expect(record.lockedUntil).toBeNull();
      expect(getLoginLockoutStatus(record, now).locked).toBe(false);
    }
  });

  it("locks for at least fifteen minutes on the fifth consecutive failure", () => {
    let record: LoginAttemptRecord | null = null;

    for (let attempt = 0; attempt < MAX_FAILED_LOGIN_ATTEMPTS; attempt += 1) {
      record = nextFailedLoginAttempt(record, now);
    }

    if (!record) {
      throw new Error("Expected failure record to be created.");
    }

    const expectedUnlock = new Date(now.getTime() + LOGIN_LOCKOUT_DURATION_MS);
    expect(record.lockedUntil?.toISOString()).toBe(expectedUnlock.toISOString());
    expect(getLoginLockoutStatus(record, now)).toEqual({ locked: true, lockedUntil: expectedUnlock });
  });

  it("preserves the active lockout while it is still in force", () => {
    const lockedUntil = new Date(now.getTime() + LOGIN_LOCKOUT_DURATION_MS);
    const record = nextFailedLoginAttempt({ attemptCount: 5, lockedUntil }, now);

    expect(record).toEqual({ attemptCount: 5, lockedUntil });
    expect(getLoginLockoutStatus(record, new Date(lockedUntil.getTime() - 1)).locked).toBe(true);
  });

  it("allows attempts again after lockout expiry and starts a fresh failure count", () => {
    const expiredLockout = new Date(now.getTime() - 1);
    const record = nextFailedLoginAttempt({ attemptCount: 5, lockedUntil: expiredLockout }, now);

    expect(record).toEqual({ attemptCount: 1, lockedUntil: null });
    expect(getLoginLockoutStatus(record, now).locked).toBe(false);
  });
});
