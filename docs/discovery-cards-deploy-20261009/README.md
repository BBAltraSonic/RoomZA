# Specials and Services production release

Deployed 9 October 2026 to https://roomza.pinpoint-roomza.workers.dev at 100% traffic.

- Worker version: b94188ba-9263-4880-bb75-2c736496e1f5
- Deployment: 5665638e-bbfe-4e4e-a1f4-000d6cc6c660
- Rollback candidate: 987dbb29-6e57-4b05-81f3-1e87b801680a
- Database migration: 20261009124326_discovery_cards_media_saves.sql
- Migration SQL SHA-256: 88159b3562414877975b72aeee72c3008cc9cc6c4022cb92853f309abf6be725
- Browser attempts: zero; user chose to leave visual verification pending.

## Scope

Shopping, Tourism and Events use the reference-style Special cards, optional uploaded banners, optional/free ZAR prices and discounts, shared countdowns/progress, urgency markers, expanded map cards, independent save/share/directions actions and a separate saved Specials collection. Services reuse DiscoveryCard with an ordered gallery of up to 20 uploaded photos and retain the live Call action. Uploaded files remain private, immutable, target-owned and revision-scoped; submission/review require photo rights, and public responses resolve published references only.

The release uses the verified last-deployed viewport source as its base. Root adapters already contained separate unshipped guest-contact changes; those input/consent/publication changes were removed only in the isolated snapshot. Display helpers remain for optional compatible contact data. Property/listing files and the separate mobile-sheet changes retain their last-deployed contents. Existing workspace dirty work was not reset or deployed. The guest-contact migration was not applied.

The card SQL extends either the legacy or contact-aware installed validators without changing their contact requirements. Any future guest-contact migration must be rebased to preserve these media/price validator extensions. Do not blindly push the pending guest-contact migration. The card migration filename now matches the actual hosted ledger timestamp; no migration history was rewritten. The compiled snapshot retains its original source filename in historical hashes.

## Verified

- 329 tests in 47 focused suites passed in the isolated snapshot.
- Typecheck, targeted lint (zero errors; two existing test unused-variable warnings), production dependency audit passed.
- Production/OpenNext build passed; first-load budgets passed for 91 routes, with the root initial JS at 251.5 KB compressed against a 300 KB budget.
- Both legacy and contact-aware isolated PostgreSQL validators passed ownership/RLS, scope, immutable submitted references, review/public visibility, prices/free/discounts, duplicate saves/counts, unavailable saved records, ordered galleries and upcoming Events.
- Standard Terser minification of the generated server bundle preserved function/class names; the existing Worker size gate passed at 3067.6 KiB gzip (level 9). Wrangler reports 12965.54 KiB uncompressed / 3078.39 KiB gzip. Cloudflare's current platform limit is 64 MiB uncompressed, per https://developers.cloudflare.com/workers/platform/limits/ ; the project compressed-size gate was retained.
- Cloudflare accepted the Worker with a reported startup time of 38 ms. Compatibility date/flags and all eight binding names/types were preserved, with --keep-vars; no secret values were recorded.
- Read-only live smoke checks passed: 35 routes/APIs and 44 served asset hashes. Confirmed new card/save/upload/review/legend markers in served bundles, all four map viewport APIs, Services and legacy feeds, Property rent/buy APIs, private saved-state caching, media guest denial and protected auth redirects.
- Hosted RPCs return an anonymous empty saved state and empty presentation for an empty request. The discovery-media bucket is private. Counts remained listings 3, saved homes 1, offers 2, entries 4, services 2; new media and saves started at zero. No production fixtures, uploads or saves were created.

## Remaining verification

Responsive browser comparison at 320, 390, 768 and 1440 px, dark mode, long titles, image failures and expanded cards remains pending at the user's request. Source/build/HTTP/hash checks do not prove rendered behavior or interactive journeys. A signed-in Storage/upload/review/publication journey still needs a migrated non-production environment.

The security advisor's additional notices are expected: discovery_media intentionally has no direct table policies/grants, while scoped SECURITY DEFINER RPCs enforce owner/reviewer/publication access. Public presentation and anonymous saved-state RPC grants are intentional. See security-before.json and security-after.json; Supabase guidance: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy and https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable . Existing leaked-password protection and unrelated advisories were unchanged.

## Evidence and rollback

release.json records source hashes, input hashes, checks, snapshot, migration and Worker version. smoke.json records route/asset evidence; production-settings.json records the confirmed deployment and sanitized binding types. Validation and deploy logs are retained here.

For an explicitly authorized rollback, use: npx wrangler rollback 987dbb29-6e57-4b05-81f3-1e87b801680a --message=rollback-specials-cards-20261009 . A Worker rollback retains the additive database tables, immutable uploads and saves; it does not undo the database migration. Do not drop the media/save data to roll back the UI.

The scoped source artifact contains the isolated release changes and evidence, not environment files or secrets. It is intended for the recorded baseline and requires reconciliation with any later dirty work.

Scoped deployed source: [ZIP](C:/Users/BB/Documents/RoomZA/artifacts/discovery-cards/specials-services-deployed-20261009.zip).
