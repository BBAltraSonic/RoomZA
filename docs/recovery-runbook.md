# RoomZA Production Recovery Runbook

Quick-reference procedures for common production incidents.

## Bad Migration

1. **Identify**: Check Supabase logs → Postgres for migration errors.
2. **Rollback**: Write a reverse migration undoing the broken DDL (e.g., `DROP TABLE`, `DROP POLICY`, `ALTER TABLE DROP COLUMN`).
3. **Apply**: Use Supabase SQL Editor or `supabase db push` to apply the rollback.
4. **Verify**: Confirm the schema matches the expected state by running `SELECT * FROM pg_tables WHERE schemaname = 'public'`.
5. **Post-mortem**: Document what went wrong and add a test to prevent recurrence.

## Broken Auth Redirects

1. **Symptoms**: Users stuck on callback page, infinite redirect loops, "invalid redirect" errors.
2. **Check**: Supabase Dashboard → Auth → URL Configuration. Confirm:
   - Site URL matches the production domain (e.g., `https://roomza.co.za`).
   - Redirect URLs include production, preview, and local variants.
3. **Fix**: Update the redirect allowlist in Supabase Auth settings.
4. **Verify**: Test signup/login flow in an incognito browser.

## Failed Email Delivery

1. **Symptoms**: Users not receiving confirmation or notification emails.
2. **Check**:
   - Supabase Dashboard → Auth → Email Templates — verify SMTP is configured.
   - Resend dashboard — check delivery logs for bounces, blocks, or rate limits.
   - Verify `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in Vercel environment.
3. **Fix**:
   - If SMTP misconfigured: update SMTP settings in Supabase Auth.
   - If Resend rate-limited: wait for limit reset or contact Resend support.
   - If DNS issue: verify SPF/DKIM/DMARC records for the sender domain.
4. **Verify**: Send a test email from the Resend dashboard.

## Storage Access Issue

1. **Symptoms**: Images not loading, document uploads failing, 403 or 404 on storage URLs.
2. **Check**:
   - Supabase Dashboard → Storage — verify bucket existence and public/private settings.
   - `listing-images` must be **Public**.
   - `application-documents` must be **Private**.
   - Check storage RLS policies: `SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage'`.
3. **Fix**:
   - If bucket missing: recreate via SQL or dashboard.
   - If RLS too restrictive: adjust storage policies.
   - If CORS issue: update Supabase storage CORS settings.
4. **Verify**: Upload and retrieve a test file via the app.

## Accidental Public Data Exposure

1. **Immediate**: Assess scope — which data was exposed and for how long.
2. **Contain**:
   - If RLS was disabled: `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;` immediately.
   - If a policy is too permissive: `DROP POLICY` the offending policy and create a corrected one.
   - If a private bucket was made public: change bucket visibility in Supabase Dashboard → Storage.
3. **Audit**: Check Supabase Postgres logs for any unauthorized access during the exposure window.
4. **Notify**: If personal data (IDs, payslips) was exposed, notify affected users per POPIA requirements.
5. **Prevent**: Add the missing RLS policy to a migration file and commit. Run Supabase Security Advisor to catch similar gaps.
