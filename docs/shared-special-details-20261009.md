# Shared Specials details, 9 October 2026

The application was subsequently deployed with the combined October 8–9 release at 19:50 SAST on 9 October. Guest contacts are now installed too, preserving the media/link validator extensions. See [combined release evidence](all-work-deploy-20261009/README.md). The separate migration-only release notes below describe the earlier checkpoint.

Events, Tourism (the internal `tourism` category, currently labelled Places) and Shopping now use one `SpecialDetailContent` and availability/action controller. Map preview title/image links and results title/image links open the same details. Existing standalone detail URLs render that content too.

## Interaction

- `detailId` augments the current category URL without dropping location, bounds, search, sorting or pagination. Reload and Back/Forward restore the selected details.
- Desktop details replace the results rail while preserving its mounted scroll region and the map. Mobile uses a modal sheet with safe-area spacing, one content scroll region and an action footer. Close and Escape restore focus to the opener or its corresponding results link if the preview was removed.
- Category adapters retain full event/experience descriptions, approved venue/address, SAST dates, published price/media, and Shopping benefit/terms/attribution/reporting. No missing price, photo or external destination is invented.
- Book and Visit use the exact approved HTTPS destinations in new tabs. Their primary-action order is Book, Visit, Directions. Public consented contacts, saved state and canonical sharing are retained.
- Directions fetches and validates the existing category JSON response before opening Maps. Requests use server-relative monotonic expiry, cancellation, latest-request guards and 12-second timeouts. Stale/unavailable detail content fails closed, and actions are disabled during availability checks.

## Posting and database compatibility

`visitUrl` and `bookingUrl` are optional content fields, validated as absolute HTTPS URLs up to 2,048 characters without embedded credentials. Empty form values omit the fields. Draft editing, preview, submitted snapshots and review expose both links.

The additive migration `20261009151629_shared_special_details_links.sql` extends the installed Shopping/Entry validators and Shopping public-snapshot field check, preserving earlier media/contact additions and all existing rows. The ordinary submission, permission, approval and withdrawal flows remain responsible for publication. Existing approved revisions do not change when a private draft is saved; a new submitted revision requires approval.

The migration was applied to the linked RoomZA production database on 9 October 2026, after separate migration authorization. The existing discovery-media migration is required. Guest contacts are optional: installed contact fields/validation are retained, while databases without that separate release receive only the Specials links extension. Application deployment remains separate and has not been performed for this task.

## Verification

- 118 focused tests across 18 files passed, including shared map/results content, mobile modal dismissal, focus restoration, reload/Back/Forward, category mismatch, superseded requests, timeouts, expiry, exact external destinations, directions validation and draft link save/preview.
- 52 isolated PostgreSQL checks passed using the actual intake, permission, reviewer approval and public-projection functions with synthetic accounts and a stored place. Coverage includes Events, Tourism and Shopping with/without links, immutable snapshots, pending edits and withdrawal. The rehearsal uses the cached PGlite runtime and does not access hosted data.
- Targeted ESLint and production build/type/bundle checks are recorded in `.cache/shared-details-lint.log` and `.cache/shared-details-build.log`. Source hashes used for the final build are retained in `.cache/shared-details-build-sources.json`.
- Browser attempts: zero. Responsive visual comparison at 320, 390, 768 and 1440px, light/dark themes and real keyboard journeys remain pending under the existing browser-attempt cap. Component tests and build results do not establish deployed visual behavior.
- Property and Services were not changed for this task. The pre-existing dirty checkout and concurrent work were preserved; this build is a validation artifact, not a scoped release artifact.

Contained database verification: `node scripts/db/verify-special-details.mjs`.

## Production migration verification

- Applied only `20261009151629_shared_special_details_links.sql` to `qleeedwnnfvmfjjymoco`, using an isolated migration manifest. The dry run named exactly that file, and the final dry run reports the remote database up to date for this manifest.
- SHA-256: `95bfe3b00f07b69074e92ef71b2f1dd7ba2732a6c7c5fc70cd27846cf0244650`. Production history records the exact local version and name.
- Rehearsal passed 52 checks with guest contacts and another 52 without them. The latter matches the current production prerequisites. Production read-only validator checks accepted older content without links, retained exact destinations, and rejected invalid schemes, credentials, whitespace, missing destinations and oversized/non-string values.
- Eleven protected tables retained identical row counts and complete-row fingerprints: Property listings, Shopping offers/revisions/decisions, Entries/revisions/public projections, Services/submissions, saved Specials and media. No content rows were written by the migration or verification.
- Existing private function grants were preserved; the new validator is invoker-only and unavailable to `anon`/`authenticated`. Security-advisor findings were identical before and after. The project remained `ACTIVE_HEALTHY`.
- Original function definitions, migration history and data fingerprints are retained in `.cache/shared-specials-migration-release-20261009/before.json`. Post-migration evidence and read-only SQL are in `verification.json` and `production-checks.sql` in that directory. These are schema-recovery and verification records, not a full data backup.
- The separate guest-contact migration remains unapplied. Its replacement validators must be reconciled with the already installed media/link extensions before that future release; do not push all pending worktree migrations blindly. Property and Services schema changes were excluded here.
- No app deployment or browser attempt was made.

Production-compatible contained verification: `node scripts/db/verify-special-details.mjs --without-contacts`.
