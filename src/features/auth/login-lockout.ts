export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_DURATION_MS = 15 * 60 * 1000;
export const LOGIN_FAILURE_MESSAGE = "Invalid email or password.";

export type LoginAttemptRecord = {
  attemptCount: number;
  lockedUntil: Date | null;
};

export type LoginLockoutStatus = {
  locked: boolean;
  lockedUntil: Date | null;
};

export function normalizeLoginIdentifier(identifier: string) {
  return identifier.trim().toLowerCase();
}

export function getLoginLockoutStatus(record: LoginAttemptRecord | null, now = new Date()): LoginLockoutStatus {
  const lockedUntil = record?.lockedUntil ?? null;

  if (!lockedUntil || lockedUntil.getTime() <= now.getTime()) {
    return { locked: false, lockedUntil: null };
  }

  return { locked: true, lockedUntil };
}

export function nextFailedLoginAttempt(record: LoginAttemptRecord | null, now = new Date()): LoginAttemptRecord {
  const lockout = getLoginLockoutStatus(record, now);
  if (lockout.locked) {
    return {
      attemptCount: record?.attemptCount ?? MAX_FAILED_LOGIN_ATTEMPTS,
      lockedUntil: lockout.lockedUntil,
    };
  }

  const lockoutExpired = Boolean(record?.lockedUntil && record.lockedUntil.getTime() <= now.getTime());
  const previousAttemptCount = record && !lockoutExpired ? record.attemptCount : 0;
  const attemptCount = previousAttemptCount + 1;
  const lockedUntil = attemptCount >= MAX_FAILED_LOGIN_ATTEMPTS
    ? new Date(now.getTime() + LOGIN_LOCKOUT_DURATION_MS)
    : null;

  return { attemptCount, lockedUntil };
}
