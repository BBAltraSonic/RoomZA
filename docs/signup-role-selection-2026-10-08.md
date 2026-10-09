# Signup and role selection, 8 October 2026

Signup now offers Renter, Buyer, Landlord and Seller before account creation. With email confirmation disabled, the immediate Supabase session continues directly to the selected workspace rather than the verification page or a second role-choice step.

## Changes

- `src/app/auth/auth-form.tsx`: required, labelled native role selector visible only while creating an account. Existing password controls, Turnstile and policy/marketing inputs are retained.
- `src/features/auth/schemas.ts`: server-side allowlist of the four existing marketplace roles; missing and privileged roles are rejected before signup.
- `src/features/auth/actions.ts`: preserve the Auth-owned confirmation timestamp; save the chosen persona with the authenticated client's existing RLS permissions; resolve a compatible workspace/return path. An account returned without a session causes no profile, persona, policy or marketing writes.
- `src/features/auth/signup-persona.ts`: create initial persona details and primary/active persona, check errors, and preserve existing personas. Signup metadata supplies a user-selectable preference only; it does not grant administrative membership or reviewer access.
- `src/features/auth/callback.ts`: preserve a validated role preference through legacy confirmation callbacks while keeping the existing MFA and administrator checks. Password recovery retains its existing route.
- `supabase/config.toml`: document the existing `enable_confirmations = false` setting. No shared runtime or database settings were changed.

## Verification

- 75 tests across seven files passed, covering the four workspace destinations, signup role form serialization, invalid/privileged roles, enrollment failures, existing role preservation, independent poster return paths, compatible redirects, legacy callbacks, and MFA.
- `npm run typecheck` passed.
- ESLint passed for all changed auth source/test files.
- The hosted RoomZA public Auth settings endpoint returned HTTP 200 with `mailer_autoconfirm: true` and `disable_signup: false` at 12:03 SAST. Hosted email signup already bypasses confirmation; no provider configuration change is needed.
- A read-only hosted catalog query confirmed ownership-based INSERT/SELECT policies on `profile_personas` and ownership-based management policies on the four persona detail tables.
- The local Auth endpoint was unreachable and Docker Desktop's Linux engine was unavailable. No full local Auth/database signup rehearsal was performed, and no browser verification was attempted under the existing attempt cap.

## Release status and preservation

These application changes were deployed to [Pinpoint](https://roomza.pinpoint-roomza.workers.dev) on 8 October 2026 at 12:22 SAST. Version `73155824-73e7-40fe-98d8-77dd6673e870` serves 100% of traffic under deployment `4c318e6b-bc64-4871-a9e4-b10a589d1a38`. Existing accounts, data, unrelated dirty work and the Git index were preserved. No live accounts were created, no emails were sent, and no database migrations or writes were performed.

Existing confirmation links remain supported as a compatibility fallback for other environments. This fallback is reached only when Supabase supplies no immediate session; the currently verified hosted provider is configured for immediate signup sessions.

Pre-edit copies, normalized source hashes, the focused-test log and the sanitized hosted settings observation are retained under `artifacts/signup-roles-20261008/`. The copies have `.before.txt` extensions so they are excluded from TypeScript compilation.

Supabase documents the relation between Confirm email and immediate signup sessions in its [signup reference](https://supabase.com/docs/reference/javascript/auth-signup). The installed Next.js 16.3.7 forms and authentication guides were consulted before editing.

## Production deployment evidence

The release was built from the exact retained source of the previously deployed controls repair, version `06dae702-320f-4660-86dd-89850eb64782`. The four modified signup runtime files matched their pre-edit versions in that snapshot. Only those files and the new persona enrollment helper changed application behavior; updated tests were included for review. Other workspace edits were excluded.

The isolated production build passed TypeScript and both client JavaScript budgets. Worker dry-run measured 3,000.8 KiB against the 3,072 KiB budget; Wrangler upload measured 3,010.70 KiB. Existing dependency/bundler warnings remain in logs. A dependency junction initially caused Windows native-image module resolution errors during packaging; the failed artifact was not uploaded. Rebuilding with same-volume hardlinks to the verified release dependencies succeeded. Persistent webpack caching was disabled only in the isolated build configuration to fit available disk space; the workspace configuration was preserved.

All 25 read-only live checks passed, including auth/password pages, discovery pages, API reads, private-file denial and protected-route auth redirects. All 39 served initial JavaScript and MapLibre worker assets matched the local artifact by SHA-256. The served auth chunk contains the signup role control. All eight existing Worker binding names/types, public variable values and compatibility settings were preserved. Hosted Auth settings again confirmed `mailer_autoconfirm: true` and `disable_signup: false`.

Before/after aggregate counts match: 5 Auth users, 5 profiles, 4 personas, 1 listing, 1 saved home, 1 application and 87 migrations. These are bounded aggregate checks, not row-content fingerprints or a full signup transaction. No browser/signup fixture was run and no email was sent by these checks.

The prior production version remains available as a rollback candidate. The release source manifest, build/recovery/size/deploy logs, live rollout and binding metadata, public Auth settings and HTTP/asset evidence are retained in `artifacts/signup-roles-20261008/`. Cloudflare documents variable and secret preservation in its [Wrangler deployment reference](https://developers.cloudflare.com/workers/wrangler/commands/workers/).
