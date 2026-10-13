# Guest access release notes - 9 October 2026

The guest-contact migration and current application were deployed to production on 9 October 2026. The migration was reconciled with the already installed media/price/link validators before application. See [combined release evidence](all-work-deploy-20261009/README.md). No anonymous Auth account creation or browser attempt was performed. The original implementation checks and rollout plan below are historical preparation records.

## Behavior

Guests can use the existing public discovery and detail routes for Property, Specials, Events, Tourism and Services. Consented published contacts show WhatsApp, Call and Email. Existing listings without a usable public contact say Contact details not provided. Services retain their previously public phone. Public details clear contact actions with expired, withdrawn or unavailable content; existing directions availability rules are retained.

Property keeps signed-in chat and purchase actions alongside direct contacts. Guest chat and Add listing go through sign-in with the intended path and query intact. Saved homes and publisher/account permissions retain their existing authorization gates. Visiting public routes does not call signInAnonymously.

## Data and publication

PublicContact has optional international phone, WhatsApp number and email. Consent is explicit, resets on edits, and never derives from private profile contacts. Property stores it in listing metadata. Moderated categories store it in immutable submitted/reviewed content; later draft edits cannot replace the approved snapshot.

Migration: supabase/migrations/20261009103541_guest_public_contacts.sql. It adds immutable grandfather flags, captures previous publication IDs and the already public Service phone, extends existing validators, and adds internal publication guards. New publication requires a valid public contact and consent. Legacy published listings keep their existing eligibility; changing a legacy Service phone or adding contact methods requires consent. No private profile backfill is performed.

The bounded pinpoint_property_contacts RPC supplements the existing spatial query and retains listings RLS. It exposes only consented published contacts. Existing eligibility, approval, mutation RPC and storage permissions remain authoritative.

## Validation

- Isolated PostgreSQL fixture: 53 checks passed, using PGlite 0.5.8. Applies the real guest migration against minimal fixture tables. Checks valid contacts, consent, exemptions, publication guards, Service phone changes, scheduled/expired/withdrawn/pending Shopping visibility, and guest RLS/permission boundaries. It is not a full Supabase migration rehearsal.
- Runtime install, without changing project dependencies: npm install --prefix .cache/guest-contact-db --no-package-lock --ignore-scripts @electric-sql/pglite@0.5.8
- Execute: node scripts/db/verify-guest-contacts.mjs
- Focused Vitest run: 456 tests passed across 66 files. Five additional Property direct-action guest tests passed in a subsequent targeted run (15 tests in that file); 461 distinct focused tests passed in total. Coverage includes guest contacts across five categories, rental and sale cards, upcoming Event details, expired/removed contacts, sign-in paths, saves, spatial projections and existing publisher/server authorization.
- Typecheck passed; targeted ESLint completed with zero warnings or errors. git diff --check passed.
- npm run build passed, including TypeScript, static generation and both JS budgets: 91 routes within 1300 KB; root initial JS 251.5 KB compressed within the 300 KB limit. Existing middleware deprecation warning remains. Production source files did not change during this successful build; only test files changed afterward.
- Logs are local under .cache/guest-contact*. The PGlite fixture and shared source integration are reviewable in the workspace.
- Docker is unavailable, so a full local Supabase/RPC/storage rehearsal is outstanding. Existing server authorization tests and the new fixture provide source/database invariant evidence, not production direct-request proof.
- Browser attempts remain exhausted. Fresh authorization is required for visual and signed-out browser journeys; source checks are not visual proof.

## Scoped rollout order

1. Review and rehearse the guest migration on a disposable Supabase database with existing migrations and data. Verify legacy counts, new publication rejection, real authenticated RPCs, and signed-out media/private-data denials.
2. Apply the additive guest migration as a separately authorized operation before releasing the application: owner projections require the new flag and Property discovery requires the new RPC.
3. Prepare an isolated source artifact containing only the reviewed guest changes. Preserve unrelated workspace files. Concurrent media/Special-card work currently overlaps several category schemas, editors and cards; reconcile those shared hunks and dependencies deliberately. The later discovery_cards_media_saves migration is separate from this guest release.
4. Run the focused tests, typecheck, lint and production build against that exact source artifact. Complete newly authorized browser checks across the five categories, rental/sale, saved homes, sign-in return paths, messaging, listingId, filters and map selection.
5. Deploy only after separate authorization, retaining the prior release and bindings. Verify the actual production surface and assets.

Rolling back application code preserves existing data and the additive schema. The contact publication guards remain active after an application rollback, so an older form cannot newly publish contact-free listings. Do not drop the guard or undo grandfathering to bypass that restriction.

## Change boundaries

The guest implementation owns src/features/guest-contact, the guest migration and scripts/db/verify-guest-contacts.mjs. Integration changes cover publisher forms/owner projections/review previews, Property metadata/API/map models, direct-contact card/detail slots, and auth-return navigation/tests. Existing role eligibility, approval requirements, links, listingId, filters, map selection, private profile details and saved-home storage were preserved. Initial untracked logs/image and concurrent discovery/media files were not deleted or reset.
