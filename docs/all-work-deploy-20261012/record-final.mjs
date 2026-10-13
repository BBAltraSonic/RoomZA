import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name+'.json')));
const release=read('release'),smoke=read('smoke'),google=read('google-sign-in'),services=read('services'),security=read('security-comparison'),settings=read('production-settings');
assert(release.deployed&&smoke.passed&&google.passed&&services.passed&&security.noNewFindings);
assert.equal(settings.version,release.result.version);
const text=`# All completed work since Friday: production release

Released 12 October 2026 to [Pinpoint](${release.origin}), with 100% of traffic on Worker version \`${release.result.version}\`.

Deployment: \`${release.result.deployment}\`. Previous version retained for code rollback: \`${release.previousVersion}\`.

The isolated snapshot preserves Friday's application release and Sunday's nationwide South African catalogue, and adds the 46 pending source/test/tooling files for Google sign-in, Service details, and Special photo galleries. The workspace was preserved. No commit, push, reset, seed, or data import was performed.

## Verification

- 1,023 tests across 161 suites; full TypeScript check and scoped ESLint passed.
- Production dependency audit: zero vulnerabilities.
- Next.js 16.3.8/OpenNext production build, JavaScript budgets, standard server minification, discovery assets, Wrangler dry run, and current platform size checks passed.
- ${smoke.checks.length} read-only route/API checks and ${smoke.assets.length} exact served-asset hashes passed, including the existing Property links and catalogue downloads.
- The live Google button is enabled and the Coming soon label is absent. Its actual HTTP server-action submission returned 303, wrote the matching PKCE verifier cookie, preserved the requested return path, redirected through Supabase to Google, and reached Google's account-entry page without client or redirect errors.
- Four live Service API checks passed: both existing approved details are public and no-store, invalid IDs return 400, and missing IDs return 404.
- Production variables, binding names/types, compatibility date/flags, and asset-routing settings were preserved using --keep-vars.

## Database

Applied only \`20261011113405_specials_photo_galleries.sql\` after an isolated --include-all dry run; 93 migrations are installed. No applied migration was replayed or history rewritten.

The migration preserves existing content and approved snapshots, allows one to ten ordered Special photos, expands the unused-upload allowance, and checks Entry upload eligibility through the existing owner posting capability. New submissions require photos; legacy photo-less approvals remain accepted.

114 isolated PostgreSQL checks and hosted photo-boundary/permission checks passed. Full-row fingerprints and counts remain unchanged across listings, saved homes, Shopping offers, Entries, Services, media, saved Specials, and all 18,253 catalogue records. The four changed function definitions match the exact intended edits, and their grants are unchanged. These fingerprints are preservation evidence, not a full database or Storage backup.

No new security-advisor findings appeared. Existing findings and remediation links remain recorded in security-before.json and security-after.json.

## Remaining verification and rollback

Browser runs: zero. A complete Google account login, consent, final session callback, responsive visual checks, authenticated publishing, and hosted gallery uploads remain unverified. The live HTTP checks confirm delivered code and Google initiation, not those interactions.

For code rollback, use the retained previous Worker version and preserve the additive gallery migration and catalogue. A Worker rollback does not roll back the external database.

Evidence: release.json, build/check logs, migration dry-run/apply logs, database preservation records, security comparison, production settings, smoke.json, google-sign-in.json, and services.json.
`;
fs.writeFileSync(path.join(dir,'README.md'),text);
console.log(JSON.stringify({version:release.result.version,deployment:release.result.deployment,traffic:100,routes:smoke.checks.length,assets:smoke.assets.length,googleInitiationVerified:true,servicesVerified:true}));
