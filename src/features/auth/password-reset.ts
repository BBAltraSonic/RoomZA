export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
export const PASSWORD_RESET_SUCCESS_MESSAGE = "If an account exists for that email, a password reset link is on its way.";
export const PASSWORD_RESET_INVALID_MESSAGE = "Your reset link is invalid or expired. Request a new one.";

export type PasswordResetTokenRecord = {
  expiresAt: Date;
  usedAt: Date | null;
};

export function normalizeResetEmail(email: string) {
  return email.trim().toLowerCase();
}

export function createPasswordResetExpiry(now = new Date()) {
  return new Date(now.getTime() + PASSWORD_RESET_TOKEN_TTL_MS);
}

export function isPasswordResetTokenUsable(record: PasswordResetTokenRecord | null, now = new Date()) {
  if (!record || record.usedAt) {
    return false;
  }

  return record.expiresAt.getTime() > now.getTime();
}

export function buildPasswordResetEmail(resetUrl: string) {
  return [
    '<div style="font-family: sans-serif; line-height: 1.5;">',
    "<h1>Reset your RoomZA password</h1>",
    "<p>Use this link within 60 minutes to choose a new password.</p>",
    `<p><a href="${resetUrl}">Reset password</a></p>`,
    "<p>If you did not request this, you can ignore this email.</p>",
    "</div>",
  ].join("");
}
