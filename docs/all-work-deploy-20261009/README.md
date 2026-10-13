# RoomZA release: work from 8 and 9 October 2026

Production: https://roomza.pinpoint-roomza.workers.dev

Released 9 October 2026 at 19:50 SAST, at 100% traffic.

- Worker version: `fab86d64-a92f-4f2d-8a32-dccf48f2fa3a`
- Deployment: `bb5d4793-82c8-47df-8a62-1e50fa11cf00`
- Previous Worker retained for rollback: `47ca9db3-9ae2-4f20-b502-0bef475d02f8`
- Source: isolated current-workspace snapshot recorded in `release.json`; source hashes checked before and after build and before deployment. Existing workspace changes were preserved.

## Migrations

All 91 repository migrations are now applied to the linked production project `qleeedwnnfvmfjjymoco`.

Yesterday's `20261008165344_pinpoint_discovery_viewport` and today's `20261009124326_discovery_cards_media_saves` and `20261009151629_shared_special_details_links` were already applied. Only `20261009103541_guest_public_contacts` was pending and was applied in this release. No migration history was rewritten or applied migration replayed.

The pending guest migration was reconciled before application: it retains installed validator definitions and extends them with contact fields/validation, preserving media, prices and approved visit/booking links. Rehearsals passed with chronological installation, with guest contacts installed after media/links, and with the exact production validator definitions. Production read-only checks confirmed valid combined content, invalid contact/link/price rejection, the bounded guest RPC and internal permission boundaries.

Existing table counts remained unchanged: 3 Property listings, 1 saved home, 2 Shopping offers, 4 Entries, 2 Services, zero media and zero saved Specials. Complete-row fingerprints for listings, offers, entries and service submissions were unchanged after excluding only the new grandfathering field. Validator ACLs were preserved. Security-advisor findings were identical before and after.

Database evidence, original function definitions, dry-run/apply logs and verification SQL are retained under `.cache/all-work-release-20261009/`. These records are not a full data or Storage backup.

## Application scope and verification

The release includes the current application source for the October 8–9 work: mobile Property details, shared navigation and Map discovery, guest/public contacts and posting safeguards, Special cards and saves/media, shared Special details and external links, location suggestions, category workspaces and current branding. All new application source dependencies were included; logs, disposable caches, scratch images and server environment files were excluded.

- 939 tests passed across 148 suites, covering the application changes and location catalogue.
- Full TypeScript check passed. Scoped ESLint passed with zero errors and eight existing warnings.
- Production dependency audit found zero vulnerabilities.
- Next.js/OpenNext production build and both JavaScript budgets passed: 91 routes within the existing first-load budget; root initial JS 268.7 KB compressed within 300 KB.
- Standard Terser packaging preserves function/class names. A Windows command quoting failure was corrected without rebuilding or changing application source; both attempts remain in the release record.
- Wrangler dry run and package checks passed. The existing compressed budget passed at 3025.5 KiB against 3072 KiB. The package also passed Cloudflare's current 64 MiB uncompressed limit; see https://developers.cloudflare.com/workers/platform/limits/#worker-size .
- Cloudflare confirmed the new version at 100% traffic. Eight binding names/types, public variables, compatibility date/flags and asset routing settings were preserved. Deployment used `--keep-vars`; no secret values were recorded.
- Live read-only smoke checks passed for 39 routes/APIs and 67 exact asset hashes. Served bundles contain guest contact inputs/actions, shared Special details, catalogue search, Property mobile actions, Special/media/save functionality and current branding. Property rent/buy APIs, category viewport APIs, public catalogue queries, protected redirects, anonymous saves and media/private-data denials passed.

Evidence: `release.json`, `production-settings.json`, `smoke.json`, and the retained validation/deploy logs in this directory.

## Remaining checks and rollback

Browser attempts in this release: zero. Responsive visual checks and signed-in browser/upload/review/publication journeys remain pending under the existing browser-attempt cap. HTTP, component tests, compilation and asset hashes do not establish rendered behavior.

For a separately requested rollback, the previous Worker remains available. A Worker rollback retains the additive database migration and stored data. Guest publication guards remain active: older forms may need the new consented contact fields before newly publishing. Do not drop the new tables, remove publication safeguards or rewrite migration history to roll back application code.
