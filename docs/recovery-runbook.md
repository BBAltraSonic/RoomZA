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

Password reset, email verification, and notification emails all flow through a
**custom Resend integration** (`src/features/notifications/send.ts`) — not
Supabase Auth's built-in SMTP. If `RESEND_API_KEY` is unset, `sendEmail()`
returns early and no email is sent, while the UI still shows a success message
(anti-enumeration by design). This is the most common cause of "success banner
but no email arrived".

1. **Symptoms**: Users not receiving password-reset, verification, or notification emails.
2. **Check**:
   - Run `npm run email:check` locally (add `--env .env.production.local` for prod values) to confirm `RESEND_API_KEY` / `RESEND_FROM_EMAIL` are present.
   - Search logs for `RESEND_API_KEY is not configured`, `Resend API error`, `Email send error`, or `Password reset email send failed`.
   - Resend dashboard — check delivery logs for bounces, blocks, or rate limits.
   - Confirm the app is deployed to **Cloudflare Workers** (see `NEXT_PUBLIC_APP_URL`), so email secrets must be set as Worker secrets, not in `.env.production.local`.
3. **Fix**:
   - If the key is missing in production, set it as a Worker secret:
     - `npx wrangler secret put RESEND_API_KEY`
     - `npx wrangler secret put RESEND_FROM_EMAIL`
   - If `RESEND_FROM_EMAIL` uses an unverified domain: verify the sender domain in Resend (SPF/DKIM/DMARC), then redeploy.
   - If Resend rate-limited: wait for limit reset or contact Resend support.
4. **Verify**: `npm run email:check --send you@example.com`, then confirm the inbox (and spam).

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
