// Password reset is handled by Supabase Auth (resetPasswordForEmail sends the
// recovery email; updateUser sets the new password from the recovery session).
// These constants are the user-facing copy for the reset request + update forms.

export const PASSWORD_RESET_SUCCESS_MESSAGE = "If an account exists for that email, a password reset link is on its way.";
export const PASSWORD_RESET_INVALID_MESSAGE = "Your reset link is invalid or expired. Request a new one.";
