# Phase 3 continuation verification

Phase 3 is **not complete**. BB explicitly approved exactly one additional browser attempt, numbered 9, on 4 October 2026 SAST. It failed after 32 populated cells at Tourism's 320px Feed hydration. Its cleanup and preservation checks passed. The extended cap is exhausted; no further browser attempt is authorized.

## Source repairs

- Bounded auth redirect allowances now include Services discovery, Services/Entries private poster paths and UUID-only public Specials detail paths. Query/hash state survives. Role-restricted Property destinations, confirmation and MFA gates remain enforced. Password-action and callback tests cover the new destinations, rejection of lookalikes and MFA refusal. Genuine post-login browser return is still unverified.
- The development-only separate React debug channel is disabled in `next.config.ts`, keeping debug records in the RSC payload. Attempt 7 captured an unhydrated Services phone Feed with complete document state, no pending HTTP requests and no page error. Installed Next code documents missing debug chunks as hydration-blocking. Attempt 8 passed the same cell and the full 60-cell populated matrix after this repair. Attempt 9 stalled with the mitigation enabled; it does not reliably prevent hydration stalls. The exact root cause remains unresolved. Production configuration is unchanged.
- Property Map now presents the same actionable unavailable-location message as Feed instead of the generic listings error. Results still clear on failed place resolution. Tests cover both views and refusal to query an unrelated viewport. This repair was made **after** attempt 8 and has source-test coverage only.
- The prior URL-backed discovery controls, selected-place query gate, camera resize repair and sign-in-link changes remain in place. Existing Property pin/card design and unrelated working-tree changes were preserved.

## Browser evidence

Attempt 7 stopped after 58 populated cells at Services 390px Feed. Its unique attempt ID prevents reuse of a stale result. See [attempt 7 evidence](pinpoint-phase3-attempt7-local-evidence.json) and [failure capture](pinpoint-phase3-attempt7-failure.json).

Attempt 8 used clone tag `pinpoint-pf-86f7bbe1-eb8d-4879-a06d-af7d8f24365e` and attempt ID `1718859e-6a44-48e0-b303-3f18197583cd`. Its executing driver SHA256 is `049708ae6a7bd20548d6b6e572424ad80e96b44ab89d6f94a3ac9c76be6ff7f3`; the exact driver source is embedded in the evidence. Product hashes were unchanged during this run.

| Scope | Observed result |
| --- | --- |
| Property, Shopping, Tourism, Event, Services × Map/Feed × 1218, 1440, 768, 1024, 320, 390px | All 60 populated cells passed; no recorded overflow/overlap, matching clone card/pin IDs and counts, correct creation destinations and phone disclosures |
| Dark theme | Five category checks passed |
| Property Feed | Empty, unavailable, controlled failure and retry passed |
| Property Map | Empty passed; unavailable-state copy assertion failed |
| Remaining response states and later journeys | Not reached; no pass claimed |

There are 64 recorded matrix cells: 60 populated and four response-state cells. Retry is checked within the failed-response case rather than counted as another cell. At the failed Property Map assertion, cards/pins had cleared and the UI displayed `Couldn't load listings. Retry`; the expected actionable place-selection message was absent.

Accepted substitutions were a blank MapTiler style, suggestions referencing genuine stored clone UUIDs, controlled 503 failures and placeholder images for external seed photos. Auth sessions, reviewer MFA, submission/approval and public collection reads used the disposable database. Synthetic content does not establish real supply or authority. Live tiles, live geocoding, shared-place input, staging and production are unverified.

See [attempt 8 evidence](pinpoint-phase3-attempt8-local-evidence.json), [latest local evidence](pinpoint-phase3-local-evidence-2026-10-03.json) and [diagnosis](pinpoint-phase3-diagnostics-2026-10-03.json). The latest evidence correctly retains `passed: false`. Screenshots are populated/dark partial-run artifacts, not proof of the unfinished journeys or the subsequent error-copy repair.

## Current source quality and preservation

### Attempt 9 — explicitly authorized continuation

Attempt 9 used clone `pinpoint-pf-1ed8c84c-8095-431d-a2eb-a25e6eb7c47b` and unique attempt ID `04010de4-8213-4492-8f0d-d976116f0d89`. Its executing driver SHA256 was `1a22a9d560db35350116ac05f8ca6be2c2bc37180793b293771bd9b1f7511044`; the exact source and authorization are embedded in [attempt 9 evidence](pinpoint-phase3-attempt9-local-evidence.json). The driver now asserts the mobile sorting disclosure's expanded state at widths below 1024px and its hidden state at desktop widths, replacing a swallowed desktop click timeout. That later section was not reached.

All 12 Property and 12 Shopping populated cells, plus Tourism's eight desktop/intermediate populated cells, passed. Four category dark checks ran within those cells. Tourism 320px Feed returned HTTP 200 but timed out waiting 120 seconds for `data-ready="true"`. Captured state shows a complete document, `data-ready="false"`, no pending HTTP requests and no page errors. See [diagnostics](pinpoint-phase3-attempt9-diagnostics.json) and [failure screenshot](pinpoint-phase3-attempt9-failure.png). No response-state, URL/history, fresh Feed, keyboard/stale-response, Property sheet, saved-home or login-return check was reached. Attempt 8's 60-cell result remains historical evidence; it is not a completed attempt 9 matrix.

Product source and executing driver hashes remained stable. Captured fixture accounts/places were removed, immutable triggers/catalogue and clone counts/fingerprints were restored, shared snapshots/configuration/container identities stayed unchanged, and owned containers/network/volume/build directory were removed with no crash markers. Independent post-cleanup checks found no rehearsal listeners/processes or labelled Docker resources. The [attempt 9 preservation record](pinpoint-phase3-attempt9-preservation.json) compares this continuation against its own [baseline](pinpoint-phase3-attempt9-baseline.json), without attributing earlier dirty-tree work to this run. Earlier screenshots were retained in `pinpoint-phase3-attempt8-artifacts/` before current screenshots were written.

The current source passes **97 tests in 10 focused files**, `npm.cmd run typecheck`, and lint on the selected repaired files with no errors. The [quality record](pinpoint-phase3-quality-2026-10-03.json) includes commands, scope and current hashes. No full suite or production build was repeated; those remain Phase 5 gates. Wider earlier lint retains an existing internal-navigation warning in `map-view.tsx:305`; `git diff --check` retains pre-existing trailing whitespace in `discovery-page.tsx`.

The [preservation record](pinpoint-phase3-preservation-2026-10-03.json) confirms unchanged HEAD, `.env.local`, frozen Phase 1 records, tsconfig and the unrelated listing grid. Shared before/after snapshots are identical; shared containers/configuration are unchanged. Clone fixture counts match the migration baseline, captured fixture accounts/places were removed, and immutable triggers/function catalogue were restored. Owned clone containers, network, volume and build directories were removed; no clone crash markers or rehearsal port listeners remained. No commit, push, PR, shared migration, external delivery or deployment was made.

The original interrupted result remains separately preserved in [interrupted evidence](pinpoint-phase3-interrupted-evidence-2026-10-03.json). Source ownership is checked against both the [original baseline](pinpoint-phase3-source-baseline-2026-10-03.json) and [continuation baseline](pinpoint-phase3-continuation-baseline-2026-10-03.json), preserving the large pre-existing dirty tree.

## Outstanding local exit checks

1. Browser-verify the repaired Property Map unavailable message and finish all category/view empty, unavailable and failure/retry states.
2. Verify URL reload/history/search/sort/service-type controls and category/view/location preservation.
3. Verify fresh-context Feed excludes MapLibre, duplicate-label keyboard selection and late/aborted response exclusion.
4. Verify Property full sheets/detail, `listingId` reload, rent/buy and genuine saved-home save/reload/remove persistence.
5. Verify genuine password login returns to all five categories, public Tourism/Event detail and Services poster workspace, including a roleless poster.
6. Retain stable source/driver hashes and successful cleanup/shared preservation with any further attempt.

The additional authorized attempt has been used and failed. The next technical task is to resolve the captured development hydration stall before requesting any further bounded browser verification. All six outstanding local exit checks remain open; no unproved product repair is inferred from the timeout. Live map/geocoder/shared-place checks remain pre-launch inputs regardless of local matrix success. No staging or production checks were run.

### Offline follow-up — 4 October 2026 SAST

[Offline analysis](pinpoint-phase3-attempt9-offline-analysis.json) parsed the two saved Flight data segments and validated all 20 client-module import rows. The captured Flight queue retained three entries; installed `app-index.js` consumes and empties that queue when its initializer runs. This points to startup not reaching that initializer at capture time. It does not identify the blocking script/dependency. The HTML contains no `beforeInteractive` queue, and the exact bootstrap asset responses were not retained in attempt 9.

The current driver is now prepared to retain unique attempt-labelled bootstrap response bodies/hashes/metadata and capture bootstrap globals, Flight push identity/types, webpack chunk/module IDs and script attributes on failure. Node syntax passed; product source remains unchanged. This preparation has no browser proof and does not authorize another attempt. The exact executing attempt-9 driver remains embedded in its evidence; the prepared driver has a different hash. Exactly one further attempt, numbered 10, has been requested and remains pending.
