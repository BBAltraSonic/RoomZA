export const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const EMAIL_VERIFICATION_SENT_MESSAGE = "Check your inbox for a verification link. The link expires in 24 hours.";
export const EMAIL_VERIFICATION_INVALID_MESSAGE = "Your verification link is invalid or expired. Request a new one.";

export type EmailVerificationTokenRecord = {
  expiresAt: Date;
  usedAt: Date | null;
};

export function normalizeVerificationEmail(email: string) {
  return email.trim().toLowerCase();
}

export function createEmailVerificationExpiry(now = new Date()) {
  return new Date(now.getTime() + EMAIL_VERIFICATION_TOKEN_TTL_MS);
}

export function isEmailVerificationTokenUsable(record: EmailVerificationTokenRecord | null, now = new Date()) {
  if (!record || record.usedAt) {
    return false;
  }

  return record.expiresAt.getTime() > now.getTime();
}

export function buildEmailVerificationEmail(verificationUrl: string) {
  return [
    '<div style="font-family: sans-serif; line-height: 1.5;">',
    "<h1>Verify your RoomZA email</h1>",
    "<p>Use this link within 24 hours to finish setting up your account.</p>",
    `<p><a href="${verificationUrl}">Verify email</a></p>`,
    "<p>If you did not create a RoomZA account, you can ignore this email.</p>",
    "</div>",
  ].join("");
}
