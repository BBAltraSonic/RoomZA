# Email verification removed from Pinpoint

Released 12 October 2026 to [Pinpoint](https://roomza.pinpoint-roomza.workers.dev). Worker version `12475926-df2b-4416-a67c-3d91d03a8fba` serves 100% of traffic; deployment `e6c26e84-0a6b-4cfd-b91f-bab9c49fc3d4`.

Signup uses the immediate Supabase session and continues to the selected workspace. Login, OAuth callbacks, onboarding, persona access, posting and admin access no longer require an email confirmation timestamp. Signup reads the trigger-created profile instead of attempting to overwrite its protected email fields. A provider response without a session offers sign-in without promising a verification email or writing account setup data as an anonymous client.

Removed the resend action, holding screen, verification success copy, profile email check, admin verification status and public email badges. Old `/auth/verify-email` bookmarks continue to their safe destination for signed-in users or to password login for guests, retaining the destination. Unsafe and looping destinations fall back safely. Password recovery, account permissions, suspensions, policy acceptance, posting capabilities and MFA remain enforced. Historical timestamp columns and API fields remain for data compatibility; no fake verification values were written.

The live Supabase Auth settings already had `mailer_autoconfirm: true` and signup enabled. The hosted audit found zero permanent accounts waiting for Auth confirmation and no email-gated row policies. No provider configuration change or account data update was required.

## Verification

- 427 tests across 58 suites passed, including signup without confirmation markers and legacy verification URL handling.
- 44 isolated PostgreSQL checks passed for permanent accounts with null email markers, guest/anonymous denial, banned and suspended accounts, expired or mismatched sessions, revoked posting capabilities, category boundaries, outstanding policy acceptance and function ACL preservation.
- Isolated release TypeScript, scoped ESLint, production dependency audit (zero vulnerabilities), Next.js/OpenNext build, JavaScript budgets, minification, discovery asset preparation and Worker packaging/size checks passed.
- 42 live read-only route/API checks and 70 exact served-asset hashes passed. Three additional legacy verification URL checks passed, including unsafe and recursive destinations. The compiled server artifact contains none of the retired prompts or email badge copy.
- All eight production bindings, public variable values, runtime compatibility and asset routing settings match the previous version. Deployment used `--keep-vars`.
- Only the 26 listed scope files and three retired files differ from the verified previous production source. No unrelated source drift or missing baseline files was found.

## Database

Applied only `20261012004142_remove_email_verification.sql` after an isolated linked `--include-all --dry-run`. Eight installed functions changed only by removal of email-confirmation predicates. Their definitions match the intended edits, and function grants and SECURITY DEFINER/INVOKER modes remain unchanged.

Full-row fingerprints and counts match before and after for profiles, Property listings, saved homes, Shopping offers, Places/Events entries, Services submissions, discovery media, saved Specials and the place catalogue. These fingerprints prove preservation of those checked records, rather than providing a complete database backup. No new security-advisor findings appeared; the 67 existing findings remain recorded with remediation links in the evidence files.

## Verification boundary and rollback

No browser signup, real-user login, production signup fixture or email was created. Live HTTP and asset checks prove delivery and the unauthenticated redirect behavior; they do not prove a complete browser signup or authenticated publishing journey.

The workspace-root TypeScript command also scans old source copies under `artifacts/releases/2026-10-07`, which still import the retired helpers. The clean isolated production source passes TypeScript and the production build; those historical copies were preserved.

Previous Worker version retained for code rollback: `8cc19081-194e-4c21-91a9-630992d97fcc`. A code rollback does not undo the database change. Original installed function definitions are retained in `rollback.sql` for a separately requested database rollback.

The working tree and existing work were preserved. No commit, push, seed or migration-history rewrite was performed. Evidence includes `release.json`, `scope.json`, test/build/packaging logs, `auth-verified.json`, `smoke.json`, database before/after/verification records, migration logs, security comparisons and production version settings.
