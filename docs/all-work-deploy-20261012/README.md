# All completed work since Friday: production release

Released 12 October 2026 to [Pinpoint](https://roomza.pinpoint-roomza.workers.dev), with 100% of traffic on Worker version `8cc19081-194e-4c21-91a9-630992d97fcc`.

Deployment: `5ebb83e2-768a-4cff-b09f-2d7ba9584aca`. Previous version retained for code rollback: `d7a8dff3-8395-48ee-93f4-ba7a539c1dd9`.

The isolated snapshot preserves Friday's application release and Sunday's nationwide South African catalogue, and adds the 46 pending source/test/tooling files for Google sign-in, Service details, and Special photo galleries. The workspace was preserved. No commit, push, reset, seed, or data import was performed.

## Verification

- 1,023 tests across 161 suites; full TypeScript check and scoped ESLint passed.
- Production dependency audit: zero vulnerabilities.
- Next.js 16.3.8/OpenNext production build, JavaScript budgets, standard server minification, discovery assets, Wrangler dry run, and current platform size checks passed.
- 42 read-only route/API checks and 70 exact served-asset hashes passed, including the existing Property links and catalogue downloads.
- The live Google button is enabled and the Coming soon label is absent. Its actual HTTP server-action submission returned 303, wrote the matching PKCE verifier cookie, preserved the requested return path, redirected through Supabase to Google, and reached Google's account-entry page without client or redirect errors.
- Four live Service API checks passed: both existing approved details are public and no-store, invalid IDs return 400, and missing IDs return 404.
- Production variables, binding names/types, compatibility date/flags, and asset-routing settings were preserved using --keep-vars.

## Database

Applied only `20261011113405_specials_photo_galleries.sql` after an isolated --include-all dry run; 93 migrations are installed. No applied migration was replayed or history rewritten.

The migration preserves existing content and approved snapshots, allows one to ten ordered Special photos, expands the unused-upload allowance, and checks Entry upload eligibility through the existing owner posting capability. New submissions require photos; legacy photo-less approvals remain accepted.

114 isolated PostgreSQL checks and hosted photo-boundary/permission checks passed. Full-row fingerprints and counts remain unchanged across listings, saved homes, Shopping offers, Entries, Services, media, saved Specials, and all 18,253 catalogue records. The four changed function definitions match the exact intended edits, and their grants are unchanged. These fingerprints are preservation evidence, not a full database or Storage backup.

No new security-advisor findings appeared. Existing findings and remediation links remain recorded in security-before.json and security-after.json.

## Remaining verification and rollback

Browser runs: zero. A complete Google account login, consent, final session callback, responsive visual checks, authenticated publishing, and hosted gallery uploads remain unverified. The live HTTP checks confirm delivered code and Google initiation, not those interactions.

For code rollback, use the retained previous Worker version and preserve the additive gallery migration and catalogue. A Worker rollback does not roll back the external database.

Evidence: release.json, build/check logs, migration dry-run/apply logs, database preservation records, security comparison, production settings, smoke.json, google-sign-in.json, and services.json.
