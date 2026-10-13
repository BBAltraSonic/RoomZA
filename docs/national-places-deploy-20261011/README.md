# Nationwide South African catalogue: production release

Released 11 October 2026 at 22:40 SAST to [Pinpoint](https://roomza.pinpoint-roomza.workers.dev), with 100% of traffic on Worker version `d7a8dff3-8395-48ee-93f4-ba7a539c1dd9`. Deployment ID: `cc6f3db4-8ef3-4b3b-9275-8c93d48eb2de`.

## Migration and data

Applied only `20261011114646_national_place_catalogue.sql` to production Supabase project `qleeedwnnfvmfjjymoco` (PostgreSQL 17.11). The isolated migration directory contained the 91 applied historical migrations and this single approved migration. The dry run and application logs confirm no other pending migration was applied, replayed or rewritten.

Imported the archive-verified manifest through the linked production management connection in 74 validated batches: **18,248 inserted records and four explicit existing-record links**, yielding 18,252 sourced records across all nine provinces. The original Emfuleni municipality record also remains, for 18,253 total base records. There are 18,259 source links and 21,925 indexed search terms. Province totals match the prepared coverage report exactly.

The imported metadata has 375 source extents and 17,877 generated viewing areas. The prepared download has 374/17,878 respectively: an original linked place retains its existing sourced extent instead of replacing it with the generated imported viewport. Existing base coordinates and bounds were preserved.

All five original place rows are byte-equivalent at the PostgreSQL JSON level, with the same UUIDs and base column shape. Full-row fingerprints and counts remain unchanged for three Property listings, one saved home, two Shopping offers and two Services submissions. These fingerprints are preservation evidence, not a full database or Storage backup.

The local environment's service credential belongs to local development. Initial RPC import attempts wrote no records; the production import used the explicitly linked management connection instead. Every batch called the same reviewed database importer. Its public execution remains denied, and all new exposed tables have RLS with public read-only policies. New functions are security invokers. The security advisor's existing findings are unchanged; no new catalogue findings appeared. Existing unrelated warnings and their remediation URLs are recorded in `security-before.json` and `security-after.json`.

## Isolated application release

The release started from the retained, verified production source snapshot. All 17 pre-edit file hashes matched that baseline; only those catalogue deltas and 19 new scoped files were overlaid. Concurrent Auth, Services, gallery and other dirty-worktree changes were excluded and preserved in the workspace. Source and public build-input hashes were checked before build and upload.

Used verified matching-lock production dependencies, including Next.js 16.3.8, with public-only build inputs. The release passed:

- 84 focused tests across 11 suites, full typecheck and scoped lint.
- Production dependency audit: zero vulnerabilities.
- OpenNext production build and JavaScript budgets: initial root client JS 264.5 KB compressed; 91 routes passed the existing first-load budget.
- Standard Terser packaging with function/class names preserved, discovery asset preparation and Wrangler dry run.
- Worker size gate: 3004.9 KiB gzip within 3072 KiB. Wrangler reported 3016.24 KiB gzip for the complete upload.

Deployment used `--keep-vars`. Post-deployment checks confirm all eight binding names/types, public variable values, compatibility date/flags and asset-routing settings were preserved. The recorded rollback version is `fab86d64-a92f-4f2d-8a32-dccf48f2fa3a`.

## Live verification

- 35 hosted database checks passed: representative cities, suburbs and rural settlements in all nine provinces, duplicate names, aliases, partial names, misspellings, and denied anonymous import execution.
- Hosted query plans use the prefix, trigram and token indexes after scoped analysis.
- 41 Worker catalogue checks passed, including regional labels/coordinates, legacy recent IDs, stable-ID reload lookup, anonymous posting login redirect, invalid input, missing catalogue results, and empty published Property results for both rent and buy in a valid distant area.
- 42 route/API checks and 69 exact served asset hashes passed, including all three existing Property links, category routes, public/guest access, protected routes, compiled catalogue markers and the published catalogue/coverage downloads.

These are separate, partly overlapping suites. Do not add their counts as unique tests. The first private-chooser HTTP assertion incorrectly expected 401 after following redirects; inspection confirmed the preserved 307 login redirect. The corrected check passes, and the original failed log is retained. No application fix or second deployment was needed.

Browser attempts: **zero**. Responsive layout, keyboard interaction in an actual browser and signed-in posting journeys still require fresh browser authorization under the existing attempt cap. Component tests and live HTTP/asset evidence do not establish visual correctness.

## Evidence and rollback

`release.json` records the isolated source/dependency snapshot, scope, hashes, gates and deployed version. Other retained evidence includes migration dry-run/apply logs, per-batch import results, before/after preservation fingerprints, permissions, province counts, index plans, security comparisons, hosted catalogue checks, smoke checks and production settings.

The public [coverage and downloads](https://roomza.pinpoint-roomza.workers.dev/data/south-africa-places.html) retain source identifiers, download dates, hashes and attribution. The implementation report at `../national-place-autocomplete-20261011.md` describes source coverage and the OSM acquisition limitation: this frozen release used provincial offline OSM exports because the complete PBF download stalled. No partial PBF was imported, and chooser searches use the local database.

For a separately requested code rollback, the previous Worker remains available. Preserve the additive catalogue and source links: new IDs may already be referenced by posts. Do not delete imported records, drop catalogue tables/extensions or rewrite migration history as part of a code rollback. [Workers rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/) do not roll back the external database.
