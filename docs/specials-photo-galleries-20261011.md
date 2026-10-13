# Specials photo galleries

Production status: migration and application changes deployed on 12 October 2026.
See the [combined release evidence](all-work-deploy-20261012/README.md). Browser
gallery interactions and hosted upload journeys remain unverified.

Shopping, Places/Tourism and Events now support one to ten ordered photos. The first photo is the cover on result/feed cards and selected map cards. Public details use the same gallery in standalone pages, desktop panels and mobile sheets.

## Behavior

- The shared editor uploads multiple JPEG, PNG or WebP images, retains the 10 MB per-file limit, labels the cover, supports reordering/removal, and requires photo-rights confirmation. Successful uploads remain in the draft if a later upload fails.
- Drafts may be incomplete. Fresh submissions require at least one photo; existing published and previously submitted photo-less revisions remain valid. All cards and legacy detail views reserve an image area with a neutral unavailable-photo placeholder.
- Card covers use 16:9; the bounded detail gallery uses 4:3 with `object-contain` for readable posters. Native horizontal scroll snapping supports swipe without intercepting vertical detail scrolling. Buttons, arrow keys, Home/End, a position counter, non-looping boundaries and single-image behavior are covered by component tests. No autoplay or scripted travel animation is added.
- Gallery changes reset to the cover; refreshed signed URLs for the same photo IDs preserve the selected slide. Failed images keep the gallery usable.
- Save, directions, close, detail URL state, focus restoration, pricing and existing category-specific actions retain their current contracts. Property, Services and map-only navigation are preserved.

## Additive migration

`supabase/migrations/20261011113405_specials_photo_galleries.sql` increases the shared Specials validation maximum to ten and the unused upload allowance to twenty. Services retains its twenty-photo gallery and forty-unused-upload limits. The minimum is enforced only in fresh Shopping/Entry submit branches, rather than shared approval/public-read validators.

The database rehearsal exposed an existing Tourism/Event upload bug: `pinpoint_entry_subject_eligible` requires a reviewer, so ordinary posters cannot pass the old upload guard. The migration replaces that call with the existing `pinpoint_entry_active` owner capability check. Ownership, category, session eligibility, revocation and version checks remain enforced. No reviewer privilege is granted to posters.

Installed function definitions are extended with explicit prerequisite checks, preserving contact/link additions and existing grants. The migration changes no content rows, approved snapshots, policies or bucket visibility. Private storage and the existing signed URL projection remain in use. Do not apply unrelated pending worktree migrations as part of this change.

## Verification and release boundaries

Run:

```powershell
node node_modules/vitest/vitest.mjs run src/features/discovery src/features/offers src/features/entries --maxWorkers=2
node scripts/db/verify-special-galleries.mjs
node scripts/db/verify-special-galleries.mjs --without-contacts
npm run typecheck
npm run build
```

The PostgreSQL rehearsal uses the cached PGlite dependency under `.cache/discovery-cards-sql`, real current intake/permission/review/publication functions, synthetic accounts and Storage metadata. It checks legacy public and pending revisions, gallery ordering, rights, unauthorized ownership, stale versions, revoked posting capability, immutable snapshots, anonymous Storage RLS, withdrawal, category limits, quotas, grants and unchanged content fingerprints. It does not establish real Supabase Storage HTTP behavior or hosted database outcomes.

Results: 373 component/contract/regression tests passed across 52 files. The new gallery migration passed 114 isolated PostgreSQL checks with guest contacts and another 114 without them. TypeScript, targeted ESLint, production build and both client JavaScript budget checks passed. The installed Next.js build reports 16.3.7 while the package manifest requests 16.3.8; the source bundle records both versions rather than changing the dependency baseline in this task.

The packaged application artifact is a scoped source handoff: exact runtime changes against the captured pre-task workspace, added files, source hashes, migration and verification evidence. Existing edits in touched files are identified through their before/after snapshots and hashes. Its full source snapshots retain those existing edits; use the scoped patch when preparing an isolated release against the current production baseline. Concurrent Services detail and place-catalogue work appeared during verification and is excluded from this bundle. The local production build is a mixed-checkout validation artifact and must not be uploaded as an isolated release of this feature.

Production migration and deployment are separate release steps. No production database change, deployment or browser attempt is included. Responsive visual acceptance remains pending at 320, 390, 768 and 1440 px, in light/dark themes, under the existing browser authorization limit. Source tests and build checks do not establish deployed visual behavior.
