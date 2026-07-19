-- Migrate off custom auth token plumbing onto Supabase Auth built-ins.
--
-- Email verification now relies on Supabase's built-in "confirm email" flow
-- (signup emailRedirectTo -> /auth/callback) and password reset relies on
-- supabase.auth.resetPasswordForEmail + updateUser. The custom token tables
-- are therefore no longer written or read by the application.
--
-- Retained on purpose:
--   * public.profiles.email_verified_at  (still the app's verification gate,
--     synced from auth.users.email_confirmed_at in the callback / session load)
--   * public.auth_login_attempts + record_auth_login_failure (brute-force
--     lockout has no strong Supabase-native equivalent)

drop table if exists public.auth_email_verification_tokens;
drop table if exists public.auth_password_reset_tokens;
