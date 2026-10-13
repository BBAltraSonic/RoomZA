# Specials cards and Property-style Services

Implemented Shopping, Tourism and Event Specials with cream cards, optional banners, integer ZAR pricing (including Free), calculated discounts, shared countdown/progress, urgency markers, expanded map cards, directions, independent contact/save/share actions and account-backed saved Specials. Services retain the existing DiscoveryCard foundation and add an ordered photo gallery. Property behavior and dirty work were preserved.

## Persistence and publication

- Optional Special banner: one JPEG/PNG/WebP up to 10 MB. Service gallery: up to 20 ordered photos with the same limits.
- New uploads receive immutable IDs and objects in the private discovery-media bucket. Owners manage their scoped draft media; reviewers can inspect submitted media; anonymous/public responses resolve currently published references only.
- Submission validators require photo rights when references are present. Existing publication revisions and version checks still govern photo and price changes. Editing a draft does not change an approved snapshot.
- Review previews display the submitted references and rights confirmation. Entry approvals record none/reviewed media state; Shopping and Service approval confirmations include photo rights.
- Saved Specials use separate ownership policies and unique user/target indexes. Saving and removal are idempotent; rapid taps are deduplicated and failed writes restore state/counts. Guest hearts preserve the current discovery URL through sign-in.
- Saved homes remain the default at /saved. /saved?tab=specials shows available cards or a content-free unavailable state for expired/unpublished records.
- Public media URLs expire after one hour. A previously issued signed URL can remain accessible until that expiry; a fresh public response will not resolve withdrawn media.

## Production release

Deployed the isolated card/media/save scope on 9 October 2026. The live Worker is b94188ba-9263-4880-bb75-2c736496e1f5. See [release evidence](discovery-cards-deploy-20261009/README.md).

The additive migration is supabase/migrations/20261009124326_discovery_cards_media_saves.sql, matching its hosted ledger version. It supports the live legacy validators and the local contact-aware validators. The separate guest-contact migration was not applied. Future guest-contact work must preserve the newly installed card validator extensions.

The original source ZIP is a historical mixed-workspace handoff, containing adapters with separate guest-contact work. The deployed source was isolated from that work and from the unshipped Property/mobile changes. Use the new release-specific source artifact and record for production evidence. Existing dirty workspace content remains preserved.

## Verified

- Focused Vitest: 317 tests in 46 files under discovery, offers and entries. Covers legacy contracts, exact/free/discount pricing, photo rights, independent actions, ordered service media, save loading races, rapid taps, failed writes, upload signature/cleanup and exact expiry/upcoming boundaries.
- Full TypeScript check: passed.
- Targeted ESLint: passed for changed cards, APIs, forms, reviews and adapters.
- git diff --check: passed (line-ending notices only).
- Production build and existing first-load/initial JavaScript budgets: final results are included in the artifact's validation log.
- Isolated PostgreSQL verification: the migration parses/applies using PGlite and real current content validators/entry approval definition. Checks ownership/RLS, reviewer visibility, immutable references, rights, scope, unique saves/counts, withdrawn media, unavailable saved records, 20-photo gallery ordering and upcoming Events. Publication eligibility fixtures stand in for the existing full production authorization graph; this is not a full Supabase Storage HTTP or production integration test.

Reproduce checks:

    npx vitest run src/features/discovery src/features/entries src/features/offers
    npm run typecheck
    npm run build
    npm install --prefix .cache/discovery-cards-sql --no-save --package-lock=false @electric-sql/pglite@0.5.8
    node scripts/db/verify-discovery-card-migration.mjs
    node scripts/ops/package-discovery-cards.mjs

## Remaining verification

Browser attempts 1–10 were exhausted in earlier work. The user-approved plan requires renewed authorization before another browser attempt; no browser attempt was made for this implementation. Responsive visual comparison remains pending at 320, 390, 768 and 1440 px, including dark mode, long titles, missing/failed images and expanded map cards. A signed-in Storage HTTP/review/public journey also remains pending in a migrated non-production environment. Source tests and build results are not visual proof.
