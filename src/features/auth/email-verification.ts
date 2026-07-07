// Email verification is handled by Supabase Auth's built-in "confirm email"
// flow (signup emailRedirectTo -> /auth/callback). These constants are the
// user-facing copy for the verification holding page and resend action.

export const EMAIL_VERIFICATION_SENT_MESSAGE = "Check your inbox for a verification link. The link expires in 24 hours.";
export const EMAIL_VERIFICATION_INVALID_MESSAGE = "Your verification link is invalid or expired. Request a new one.";
