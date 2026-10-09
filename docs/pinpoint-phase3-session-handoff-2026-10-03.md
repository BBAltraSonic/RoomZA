# Phase 3 session handoff — 3 October 2026

## Copy-ready prompt for the next session

Continue the existing Phase 3 work in `C:\Users\BB\Documents\RoomZA`. The original instruction was to fully execute Phase 3 from `docs/pinpoint-phase1-ledger-2026-10-03.md`; the current execution scope is defined in `docs/pinpoint-completion-plan-2026-10-03.md`. The user subsequently requested this comprehensive handoff. Phase 3 is **not complete**. Resume the unfinished work rather than restarting Phase 1, repeating the completed rental audit, or treating all existing changes as your own.

Read this handoff, the Phase 3 section of the current completion plan, the Phase 1 ledger, and the latest Phase 3 evidence before acting. Read `AGENTS.md` and relevant installed Next.js documentation in `node_modules/next/dist/docs/` before writing code. This repo uses Next 16.3.7 and React 19.2.4. The previous session read Link, useSearchParams and native History API documentation; verify the relevant guides for any additional change.

### Authorized outcome and preservation boundaries

- Finish local implementation and verification; prepare reviewable evidence. Deployment and a public pilot remain later gates.
- Preserve the large pre-existing dirty working tree, Property links, `listingId`, saved homes, rent/buy filters, existing data and map pin/card design. Do not reset, stash everything, reformat unrelated files, recreate the shared stack, or blindly apply pending migrations.
- Do not modify the frozen Phase 1 ledger/baseline/preservation manifests. New Phase 3 records are separate. Update the current completion plan only when justified by actual results.
- Do not change `.env.local`, use production secrets locally, contact posters/businesses, or enable external email/QStash/push/scheduled effects.
- Clone migrations are authorized for the isolated rehearsal. Shared migrations and configuration changes are outside this Phase 3 work.
- The user chose to keep the existing map configuration. There is no development MapTiler key, and shared stored places were empty at the earlier checkpoint. Accepted local scope permits a documented blank basemap and suggestions backed by actual stored clone place UUIDs. Real tiles/geocoding and shared-place input remain pre-launch checks. Do not silently claim these were verified.
- No commit, push, PR or deployment has been made for this session's work.

### What we are trying to fix

Phase 3 verifies consistent discovery across Property, Shopping Specials, Tourism Specials, Event Specials and Services, in Map and Feed. It requires matching cards/pins/counts/location; URL/history/filter behavior; sign-in return; correct creation links; stale-request handling; map-free Feed loading; responsive layouts, keyboard focus and dark theme.

Three concrete product issues were found and changed:

1. Search/sort/service-type controls were local component state and could be lost on reload or Map/Feed transitions. They now use URL query parameters and browser history.
2. Property resize code restored a captured old map center after a selected-place `fitBounds`. This could interrupt the camera move. The resize now leaves the camera center alone.
3. Property could query/display the default Johannesburg viewport while the URL named a Cape Town place, before place resolution and camera bounds agreed. A selected-place resolution/viewport gate now delays that query. Failed place resolution clears results in both views.

The guest profile-menu sign-in link was also changed to retain the current path and query. **The actual post-login destination is still unfinished:** both role and persona redirect allowlists in `src/lib/redirects.ts` omit `/services`, `/post/services` and public `/specials/` detail paths. Inspect actual routes/auth flows, determine the correct bounded allowances, test them without weakening existing role restrictions, and verify the return after real authentication. A preserved hidden redirect input alone does not prove that journey.

### Current source changes owned by this session

- New `src/features/discovery/url-controls.ts` and `url-controls.test.tsx`: `useDiscoveryControls` reads `q`, valid `sort`, and valid `serviceType`; q is limited to 120 characters. Query edits replace history; sort/type push history. It subscribes to popstate and a local change event, and carries controls into view/pagination links.
- `src/features/offers/public-feed-screen.tsx`: Shopping URL controls and view/pagination preservation.
- `src/features/entries/public-feed-screen.tsx`: Tourism/Event URL controls and view/pagination preservation.
- `src/app/services/services-discovery.tsx`: URL-backed query, sorting and service-type filtering.
- `src/features/map-discovery/discovery-page.tsx`: URL-backed Property sort; area-resolution key/center state; initial selected-place viewport gate; invalid-place result clearing.
- `src/features/map-discovery/map-view.tsx`: resize only, removed stale `setCenter`.
- `src/components/navigation/profile-menu.tsx`: guest sign-in uses `authPathForRedirect(window.location.pathname + window.location.search)` inside the client-opened menu. Review client/server rendering assumptions if changing it.
- Existing test files amended: offers/public-feed-screen, entries/public-screens, services-discovery, map-view-loader, discovery-page.filters-url and profile-menu. Public-screen mocks now supply `useSearchParams` and reset browser history.
- New clone/browser harness files: `scripts/db/discovery-phase3.local.mjs`, `discovery-phase3-check.local.mjs`, `discovery-phase3-browser-source.cjs`.
- Baseline before these production edits: `docs/pinpoint-phase3-source-baseline-2026-10-03.json`, with HEAD and SHA256 of tracked/nonignored untracked files. It includes an owned temporary `scripts/ops/prepare-phase3.mjs` generator that was deliberately removed afterward; do not mistake this for a lost pre-existing file.

Review these changes against that baseline, not only `git diff`: the original checkout already contained many uncommitted changes and untracked files. No redirect allowlist fix has been made yet.

### Completed verification, with limits

- Initial existing discovery/public suite: 55 files, 244 tests passed before the later camera/gate changes.
- New hook plus public screens: 4 files, 14 tests passed.
- Expanded discovery suite: 55 passing files/246 passing tests, one new camera test failed because its mock lacked `getContainer`. The mock was corrected.
- Latest focused regression run: map-view-loader, discovery-page.filters-url and profile-menu; 3 files/42 tests passed. This includes the corrected camera regression, selected-place viewport gate and sign-in-link preservation.
- Latest `npm.cmd run typecheck`: exit 0 with the current production edits.
- Focused ESLint: no errors; one existing internal-navigation warning at `src/features/map-discovery/map-view.tsx:305` for `window.location.assign`.
- `git diff --check` is not globally clean: it reports pre-existing trailing whitespace in discovery-page.tsx (line 414 at the prior check). Verify against the Phase 3 baseline instead of erasing unrelated work.
- No new full suite or production build was run. Phase 5 is the integrated build/release gate. Do not describe the earlier full suite as covering new Phase 3 code.
- Phase 2 quality JSON records 1,297 passing tests and two skips. Its markdown and the plan's Phase 2 summary are stale; inspect the actual Phase 2 clone evidence before deciding to repeat anything. Do not expand this handoff into a fresh Phase 2 audit.

Useful bounded check commands after changes:

```powershell
npx.cmd vitest run src/features/discovery/url-controls.test.tsx src/features/map-discovery/map-view-loader.test.tsx src/features/map-discovery/discovery-page.filters-url.test.tsx src/components/navigation/profile-menu.test.tsx --maxWorkers=1 --no-file-parallelism
npm.cmd run typecheck
```

Include appropriate redirect/auth tests after the redirect repair. Do not add tests merely mirroring low-impact implementation details or endlessly repeat checks after they pass.

### Clone rehearsal architecture and guards

Use the Playwright skill at `C:/Users/BB/.agents/skills/playwright/SKILL.md` and the Supabase skill at `C:/Users/BB/.codex/plugins/cache/openai-curated-remote/supabase/1.0.0/skills/supabase/SKILL.md`. They were read and announced in this session; a new session should read the applicable instructions. Browser source is kept in the repo, copied to OS Temp, then executed by the skill's universal runner. It requires `playwright`; requiring `@playwright/test` from that runner failed resolution.

The opt-in command is:

```powershell
$env:PINPOINT_DISCOVERY_PHASE3_LOCAL = '1'
node scripts/db/discovery-phase3.local.mjs
```

Docker execution requires tool escalation. Inspect any existing process/ports first; do not start parallel rehearsals on ports 3116/55431. Do not include credential values in output.

The outer harness:

- Creates UUID-named `pinpoint-pf-<uuid>-db/auth/rest` containers, an internal network and a volume with `pinpoint.discovery.phase3.run=<tag>` labels. No container ports are published.
- Uses patched Postgres `17.6.1.113`; the existing shared `.111` database remains read-only. Shared SQL is forced into `begin read only; ... rollback`, and clone writes verify the exact per-run label/name.
- Clones source data, isolates schedules/delivery integrations and applies the explicit nine ordered Offer migrations plus three entry migrations only to the clone. Services migration already exists in the source runtime.
- Uses a loopback gateway at `127.0.0.1:55431` and an isolated Next webpack dev app at `localhost:3116`. Environment overrides use loopback demo credentials; external integration values are cleared. `.env.local` is not edited.
- Captures shared table/Auth/storage counts, Property table fingerprints, function/security/migration/cron state, container identities/configuration, and compares them afterward.
- Finally removes only its labelled containers/network/volume, restores tsconfig, removes only its unique `.next-pinpoint-verify-<uuid>` directory, and writes `docs/pinpoint-phase3-local-evidence-2026-10-03.json`.

The task harness creates four synthetic Auth users, genuine sessions and reviewer TOTP MFA, two genuine clone stored places with duplicate labels/distinct UUIDs and regions, and actually submits/approves one Shopping, Tourism, future Event and Service fixture. Synthetic content does not establish real supply or authority. Cleanup verifies captured account emails/IDs, removes only their fixtures, temporarily disables named immutable triggers only in the clone transaction, restores them, and asserts baseline counts/catalogue afterward.

### Browser matrix and what remains unproved

The browser source targets five variants × two views × widths 1218, 1440, 768, 1024, 320 and 390: 60 populated cells. It checks geometry, overlap, counts, actual clone cards/pins and creation links. Additional empty/unavailable/503-and-retry tests produce 30 state/view cells, plus URL/history, fresh-context map-free Feed scripts, duplicate-label keyboard location selection, late-response exclusion, Property full sheets/detail/reload/rent-buy behavior, and sign-in links.

The latest durable evidence records a maximum of **58 populated cells**, and the complete matrix has **not passed**. An earlier progress update described a 60-cell partial pass; do not use that update as final exit evidence. Several attempts intermittently rendered a blank page or never reached `[data-slot="pinpoint-header"][data-ready="true"]`, including Services 390 Feed. Root cause is unresolved; do not call these merely harness flakiness without diagnosing. HMR/source edits occurred during earlier runs and may be relevant. Failure capture now includes body/HTML where the executing driver has that code.

Known harness fixes already made:

- Empty-place coordinates had been reversed; fixed to a valid South African location.
- Correct Services immutable-trigger name is `service_history_immutable`.
- Shopping enrollment events can have a null offer_id; cleanup deletes only captured fixture poster IDs rather than only offer_id.
- Unavailable-state assertions now wait for settled text; retry matcher includes `Retry`.
- Delayed-area-response test starts from Feed because initial Property Map queries use bbox and may omit areaId.
- Browser finalization uses unrouteAll with ignored route errors before closing contexts.
- Property detail/sheet and five-category sign-in checks were appended, but are not yet proven by a successful final run.

The current browser source also substitutes Unsplash image requests with local SVG placeholders. That was added during a prior browser attempt and may not appear in that attempt's archived driver. Cite the actual driver source/hash in evidence, not assumptions from the current file.

The task permits at most eight browser attempts, and retries only when the driver source changes within 60 seconds. It stores each result/driver hash and the final driver's source. Early failures sometimes failed to write result JSON; a later attempt can therefore contain stale prior result data. Fix result-file lifecycle before trusting attempt-level reports. Do not increase retries or blindly rerun the full matrix to hide an unresolved problem. If using a checkpoint to avoid repeating verified populated cells, tie it to locked source hashes and clearly state exactly what was and was not rerun.

Screenshots `docs/pinpoint-phase3-<category>-1440.png`, `-320.png`, `-dark.png` are partial attempt artifacts. The failure screenshot is `docs/pinpoint-phase3-browser-failure.png`. They do not certify the whole matrix.

### Failure evidence and process handover

Preserved early failures:

- `docs/pinpoint-phase3-harness-fixture-failure.json`: reversed empty-place coordinates and incorrect Services cleanup trigger; entire labelled clone removed.
- `docs/pinpoint-phase3-harness-module-cleanup-failure.json`: Playwright module resolution and null-offer enrollment cleanup issue; entire labelled clone removed.

Both saved failures have identical sharedBefore/sharedAfter snapshots. Auto-review twice rejected Docker reruns because clone cleanup mismatches were interpreted as shared mutations. The previous session explained this, demonstrated shared preservation, hardened shared SQL/clone guards and then received escalation approval. Do not describe those failures as shared data changes or bypass review if a new action is rejected.

At handoff preparation, the main elevated tool session was 25244. Only its browser runner (PID 24756 at that instant) and browser children were stopped to honor the handoff request. The parent task was left alive so its normal failure/finally path could sign out fixtures, restore files, stop its app and clean up the clone. Do not kill the outer parent before cleanup. PIDs are historical; re-identify processes by observed command lines and labels.

The next section records the final observed cleanup result. Read it before restarting. If absent/incomplete, inspect the latest evidence and owned processes before proceeding.

### Recommended continuation order

1. Confirm the previous rehearsal's cleanup/shared preservation and that ports 3116/55431 are free. Compare the current working tree with the Phase 3 source baseline and classify only intentional changes. Verify protected env/Phase 1 files without exposing values.
2. Investigate both role/persona redirect allowlists and actual Services/public Specials sign-in return. Make the smallest justified repair and add meaningful redirect tests; exercise genuine login return rather than only hidden-input preservation.
3. Diagnose the blank-page/header-readiness failures using body/HTML, console/page errors and local app/network logs. Run stable source without concurrent HMR edits. Fix the stale browser result-file issue and make the remaining matrix trustworthy.
4. Finish the full stated matrix, including response recovery, late requests, Feed module exclusion, Property detail/full sheets, saved-home/rent-buy behavior, keyboard focus and category creation destinations. Verify actual results; do not let assertion convenience weaken scope.
5. Confirm successful fixture baseline restoration, immutable triggers, shared snapshots/config/container preservation and labelled clone removal. Final evidence must refer to the executing driver and product source hashes.
6. Write new Phase 3 verification/quality/preservation records. Update only the current completion plan's Phase 3 status/current position when its local exit criteria are genuinely met. Keep live MapTiler/geocoder/shared-place checks explicitly open. Do not rewrite historical 2/48 or 0/3 journey totals from code existence.
7. Report completed work, evidence, unresolved inputs and the next bounded phase. Do not claim staging/production, full build, real supply or live map proof from these local checks.

Windows note: `rg.exe` failed with ResourceUnavailable in this session; use PowerShell Get-ChildItem/Get-Content/Select-String if it remains unusable. Use native PowerShell for filesystem changes, verify absolute workspace-contained paths before recursive cleanup, and avoid cross-shell destructive commands.

## Final observed state at handoff

The parent rehearsal finished with exit 1 at **2026-10-03 21:46:13 SAST**. Final evidence is `docs/pinpoint-phase3-local-evidence-2026-10-03.json`, tag `pinpoint-pf-f4626e8d-fff2-4894-bc9c-d88796ad2ca6`, `passed: false`. The task stopped after the interrupted browser attempt because the unchanged failed driver is intentionally not retried. This is a failed verification result, not a failed shared-data preservation check.

Observed and checked afterward:

- `sharedBefore` and `sharedAfter` are exactly equal.
- `cloneAfterTask` equals `cloneMigrationBaseline`; fixture counts restored. (There is no JSON field named fixtureBaseline; that is a local runner variable.)
- Four captured fixture accounts and both fixture places were removed; task cleanup has no cleanupFailure. Immutable triggers and function catalogue restored.
- Clone DB/Auth/REST containers, volume and network removed; shared container identities/configuration unchanged. Clone crash-marker list is empty.
- Isolated application stopped. No listener was returned for ports 3116/55431 at the handoff check.
- An older build directory from the early failed cleanup remained: `.next-pinpoint-verify-a6fe35c7-7e35-4554-b3d8-cf0a7cfa1ce3`, created at 21:12:20. It and its two generated tsconfig include entries were owned by this session. The exact workspace-contained directory was removed. `git show HEAD:tsconfig.json` was first hashed and proved identical to the pre-session Phase 3 baseline, then restored byte-for-byte. No `.next-pinpoint-verify-*` directory remained in the final directory check.
- Baseline comparison before that final restoration found only the twelve listed production/test edits plus tsconfig and the deliberately removed owned generator. After tsconfig restoration, its hash matches baseline. New source/harness/evidence/handoff files are intentional additions. Protected Phase 1 files in that baseline were unchanged.
- Six browser attempts are recorded. Attempts 5/6 both contain 58-cell failure results; attempt 6 was interrupted and may repeat stale result JSON from attempt 5. Do not count it as a fresh 58-cell pass.

Local app logs remain in OS Temp. The latest is `C:/Users/BB/AppData/Local/Temp/entrypub-a6cb1130-6aac-4feb-936b-642dd4eff9b9-app.log`; the early module/cleanup failure log is `entrypub-f8f4f985-e4db-4079-b157-ae1aa55ef92e-app.log` in the same directory. Inspect these for the readiness issue before they expire; avoid exposing credentials if any log includes sensitive data. The skill copied-driver path in stack traces is temporary and may have been removed; the final driver's source and hash are embedded in the latest evidence.

No verification process from this rehearsal needs to be resumed. Start a new guarded clone only after inspecting the evidence and addressing the identified unfinished work. The source changes remain uncommitted for review.
