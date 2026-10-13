# Google sign-in fix — 11 October 2026

Status: deployed on 12 October 2026 as part of the combined release, Worker
`8cc19081-194e-4c21-91a9-630992d97fcc`, at 100% traffic. The live button is enabled,
and its HTTP server-action submission writes a matching PKCE cookie and reaches
Google's account-entry page. A real Google account sign-in and final session
callback remain unverified. No browser session was started.

Current evidence: [combined production release](all-work-deploy-20261012/README.md).

## Root causes and changes

- At the initial diagnosis, the source and production `/auth` rendered a disabled Google button with
  a “Coming soon” label. The button now submits a separate Google OAuth server
  action, without requiring email/password fields. It shows pending and retry
  states and prevents overlapping authentication submissions.
- The action uses the cookie-based Supabase server client, preserving the PKCE
  verifier for `/auth/callback`. It sanitizes the requested destination, uses the
  current request origin, applies the existing auth rate limiter, and redirects
  outside its error handler.
- Production denies authenticated updates to `profiles.id` and
  `profiles.email_verified_at`. The old callback upsert tries to update those
  fields and fails. The callback now reads the profile created by the existing
  `auth.users` trigger. Database permissions and records were not changed.
- The callback now respects active renter, buyer, landlord, and seller personas,
  while retaining legacy role compatibility, email verification, MFA, admin
  routing, password recovery, and first-account onboarding.

## Verification

- Live public Supabase auth settings: Google enabled, signup enabled.
- Live `/auth`: HTTP 200, disabled Google button present before this release.
- Supabase authorize endpoint with a valid SHA-256 PKCE challenge: HTTP 302 to
  `accounts.google.com`, with a configured client ID and provider callback
  `https://qleeedwnnfvmfjjymoco.supabase.co/auth/v1/callback`.
- Following that URL through ordinary HTTP requests reached Google's account
  identifier page (`/v3/signin/identifier`, HTTP 200), without
  `redirect_uri_mismatch`, `invalid_client`, or an OAuth error-page redirect.
  This checks the provider's initial response without signing in. It does not
  prove consent completion, branding verification, or the final application return.
- Read-only database inspection confirmed the protected-column grants and the
  existing `handle_new_user` profile-creation trigger.
- 96 tests passed across the auth feature, auth form, and Supabase browser/server
  clients. The server test uses the installed Supabase library to confirm that
  the verifier matches the authorize challenge, survives a second request, and
  is exchanged for session cookies using a mocked token response.
- Full TypeScript check and lint of changed files passed.

Commands:

```powershell
node node_modules/vitest/vitest.mjs run src/app/auth/auth-form.test.tsx src/features/auth src/lib/supabase/server.test.ts src/lib/supabase/browser.test.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src/features/auth/actions.ts src/features/auth/actions.integration.test.ts src/features/auth/callback.ts src/features/auth/callback.test.ts src/app/auth/actions.ts src/app/auth/auth-form.tsx src/app/auth/auth-form.test.tsx src/lib/supabase/server.test.ts
```

## Release scope and remaining verification

Production files: `src/app/auth/actions.ts`, `src/app/auth/auth-form.tsx`,
`src/features/auth/actions.ts`, `src/features/auth/callback.ts`.
Other changed files are tests and this note. Preserve the existing dirty work.

The combined production release passed 1,023 tests, typecheck, lint, dependency
audit, production build, route/asset verification and live Google initiation.
Worker bindings were preserved, and the previous version is retained for rollback.

After deployment, finish one explicitly authorized interactive Google sign-in.
Verify the allowed application callback URL, account consent, session persistence,
the requested return path, new-user onboarding, and existing-user persona routing.
The HTTP 302 check confirms provider initiation, not successful account consent or
the application's redirect allowlist.

Reference: [Supabase Google OAuth with server-side auth](https://supabase.com/docs/guides/auth/social-login/auth-google).
