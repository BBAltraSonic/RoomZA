# Progress — Pinpoint six-phase completion plan

**Target date: Saturday, 3 October 2026, South African Standard Time (UTC+2).**

**Confirmed finish line:** complete implementation and local verification, then prepare the release for BB's approval. Production deployment, real-supply recruitment and a public pilot are outside today's authorized finish line. **Confirmed Events behavior:** Events are poster-style Specials; an approved event is visible from approval until its end, labelled Upcoming before its start. Venue directions remains its primary action. No separate earlier publication cutoff or pause/resume feature is introduced.

**Current position (7 October 2026 SAST):** Phase 6 packaging is completed: [release package](pinpoint-phase6-release-package-2026-10-07.md), operating handoff, permissioned-supply/criteria/gate register and [completion handoff](pinpoint-phase6-handoff-2026-10-07.md). Release decision: **blocked pending listed evidence/inputs**. Fresh file verification matches all 1,196 Phase 5 manifest files, 1,111 retained snapshot files and three artifact hashes; tests/build/audits were reused, not repeated. Phase 5 independent local work passed 1,327 tests, TypeScript, zero lint errors, isolated install/build/budgets/audit and Worker dry-run; ordered migrations/recovery were clone-only. [Phase 5 verification](pinpoint-phase5-verification-2026-10-06.md) retains the false strict all-row preservation result from the scheduled trust-metrics refresh. Phase 6 verifies files only, not fresh shared rows/runtime parity. Phases 3/4/5 and the local finish line remain incomplete. BB chose **Keep the browser cap exhausted** on 7 October: attempts 1–10 exhausted, no attempt 11 or substitute UI rehearsal, no repeated cap request. No deployment or pilot is authorized or performed.

| Phase | Outcome | Current status | Exit evidence |
| --- | --- | --- | --- |
| 1 | Reconciled scope, preserved baseline and completion checklist | Complete; dated scope/task ledger and read-only preservation checks | [Ledger](pinpoint-phase1-ledger-2026-10-03.md), [baseline](pinpoint-phase1-baseline-2026-10-03.json), [preservation](pinpoint-phase1-preservation-2026-10-03.json) |
| 2 | Tourism submission-to-publication journey inside Specials | Implemented; historical clone publication/MFA/browser packet retained, current integrated source drift recorded | Recorded publication journey and expiry/removal proof; current changed discovery/public-path checks remain open |
| 3 | Consistent discovery, locations, cards and pins across all tabs | Partial: historical 60-cell populated pass; attempt 9 hydration stall after 32 cells; all later exit checks pending, cap exhausted | [Current verification](pinpoint-phase3-verification-2026-10-03.md); accepted blank-basemap clone proof; live maps/geocoder remain pre-launch |
| 4 | Completed Property and platform release requirements | Repairs and clone API/Storage/sink checks passed; browser attempt 10 incomplete | [Current verification](pinpoint-phase4-verification-2026-10-06.md); remaining real-cookie desktop/phone and dashboard/access checks |
| 5 | Current integrated build and release verification | Independent local quality/build/audit/Worker and migration/recovery passed; incomplete browser/target gates | [Verification](pinpoint-phase5-verification-2026-10-06.md), [manifest](pinpoint-phase5-manifest-2026-10-06.json), [migration/recovery review](pinpoint-phase5-migration-recovery-2026-10-06.md), [blockers](pinpoint-phase5-blockers-2026-10-06.json) |
| 6 | Reviewable release package with pilot prerequisites | Packaging completed; operating inputs, local evidence and deployment/pilot remain open | [Release index](pinpoint-phase6-release-package-2026-10-07.md), [operating handoff](pinpoint-phase6-operating-handoff-2026-10-07.md), [readiness/gates](pinpoint-phase6-pilot-readiness-2026-10-07.md), [completion record](pinpoint-phase6-handoff-2026-10-07.md) |

Every phase distinguishes **source/unit**, **disposable clone**, **shared local**, **staging** and **production** evidence. A phase is complete only when its stated checks pass or an explicit scope decision removes an item. A skipped or externally blocked check remains visible; elapsed time does not make it complete.

## Context: what we have been doing

RoomZA already contains Property discovery, saved homes, rent/buy filters, direct listing links and renter/provider workflows. Pinpoint expands that existing app. The older pivot plan accumulated Property, notification security, Shopping Offer and Tourism/Event work; much of its newer database evidence was obtained on isolated clones rather than the shared runtime.

The user supplied a navigation-header reference and chose to apply it to existing Pinpoint. The first pass had layout overlaps, inconsistent actions and incomplete category behavior. The correction established one shared header and container: **Map = result cards plus the map; Feed = cards without a mounted map**. Changing category carries the selected location and view. Phone sorting/filters collapse behind a disclosure, and Property sheets/details remain below the header.

The confirmed top-level tabs are **Specials, Property and Services**. Their actions are **Add special, Add listing and Add service**. Tourism belongs inside Specials. Services means local providers, with **private submission → approval → public card and map pin**. Services now has draft/save/reload, permission confirmation, MFA review, immutable approved snapshots, discovery and withdrawal/unpublish. Its real Auth/MFA/API/SQL/browser journey passed on a disposable patched clone. With explicit approval, only the new Services migration and local Auth TOTP enablement were applied to the shared stack; existing records and other container identities were preserved.

The last full suite passed **1,283 tests with two skips** before the final cached-place/camera changes. The final focused run passed **234 tests in 53 files**, with typecheck passing and no focused lint errors. These results cover their recorded source snapshots; they do not certify subsequent implementation or a production release. See [the correction verification](pinpoint-discovery-correction-verification.md).

The user chose to keep the current map setup. The development MapTiler key is absent and shared `discovery_places` is empty. Clone map verification used a substituted blank style and location suggestions pointing to a real stored clone place. Real provider authentication, submission, approval and public reads were exercised; live MapTiler tiles/geocoding were not.

## Today's delivery rule and responsibilities

- **Codex / Build:** implementation, local verification, guarded fixtures/cleanup, current build checks, evidence and release preparation.
- **BB / Product:** final public scope, any unresolved Event rules, acceptance and release authorization.
- **BB or designated Operations/Admin owners:** development map configuration, target environment access, actual reviewers/posters, permissioned real content and support ownership. No other person is assumed to have accepted a role.
- Work proceeds through independent tasks while inputs are pending. Finish authorized local work today where feasible; do not bypass access controls, fabricate supply or certify a launch to meet the date.
- No shared database reset, blind dependency/stack upgrade, production-secret use locally, external contact or deployment is authorized. BB confirmed local implementation/verification and release preparation as today's scope.
- The plan does not assign speculative hourly estimates. The end-of-day report records completed phases, actual evidence, remaining tasks and the input needed for each blocker.

## Phase 1 — Reconcile scope and preserve the baseline

**Purpose:** make the finishing checklist reflect the current product and avoid repeating completed audits. **Owner:** Codex, with scope decisions from BB. **Dependency:** none.

1. Record the current checkout, uncommitted work, migration source/runtime differences, environment and existing-data preservation evidence. Do not treat the large existing working tree as new work from this plan.
2. Reconcile the older plan's four-category/later-Services assumptions with the confirmed three-tab interface and Services enablement. Retain historical records; do not recalculate the old 48-item total from code existence alone.
3. Record the confirmed finish line: implementation/local verification and a prepared release. Events joins Specials publicly as poster-style cards, visible from approval until its end and labelled Upcoming before the start.
4. Create a task/evidence ledger distinguishing implemented, verified, externally blocked and explicitly deferred work. Map earlier Shopping Offer, Property, notification and entry checks to their actual environments.
5. Preserve the confirmed Tourism rules: exact SAST start/end windows stored as UTC, venue directions, separate permission/evidence, material submissions hidden until reapproved and renewals reviewed. Events future display/end cutoff is now confirmed; pause/resume is outside this implementation.

**Done when:** the scope is recorded, the baseline is preserved, every remaining release task has an owner/dependency, and the old plan points to this current execution record. **Output:** this plan plus the [completed dated ledger](pinpoint-phase1-ledger-2026-10-03.md). **Exit evidence:** [baseline manifest](pinpoint-phase1-baseline-2026-10-03.json) and [read-only preservation comparison](pinpoint-phase1-preservation-2026-10-03.json). **Next action after this Phase 1 goal:** inspect/verify the existing Tourism/Event reviewer/publication source under Phase 2; Events rules are confirmed. Historical saved-content, analytics, support/share, consent and operating-input requirements remain explicit carryovers in the ledger rather than silently disappearing from scope.

## Phase 2 — Finish Tourism inside Specials

**Purpose:** deliver the largest unfinished customer journey. **Owner:** Codex; BB supplies actual publishing evidence for a real pilot. **Dependencies:** Phase 1 scope; existing private entry intake/review contracts. Synthetic clone verification can proceed without real pilot supply.

1. Retain and verify the existing private poster workspace: category enrollment, partial save, complete submission, reload, withdrawal, correction feedback and unsaved-input preservation on HTTP 409.
2. Build the cookie/MFA reviewer queue and detail screen against the verified submitted revision. Show the exact venue, location, dates, content and version; retain correction/rejection reasons without exposing private records publicly.
3. Persist revision-bound poster confirmation and actual reviewer place/media/authority evidence. Recheck active account/session, policy acceptance, suspension, membership and required factors at mutation time. Shopping Offer enrollment is not Tourism permission.
4. Add atomic, version-checked approval/rejection/unpublish with immutable audit evidence. Material resubmission hides the old publication; rejecting a replacement must not revive it. Withdrawal and competing reviews must not create public content from a stale revision.
5. Add a safe public projection, count/feed/detail and fresh fixed-host venue-directions action. Reads fail closed for revoked/suspended/ineligible content and use current eligibility rather than depending on scheduled jobs.
6. Integrate Tourism cards and actual approved coordinates into Specials Map/Feed. Display SAST dates, truthful scheduled/live/ended states and explicit loading/empty/error/retry behavior. Recheck open pages at start/end/removal transitions.
7. Verify desktop and phone poster → MFA reviewer → anonymous visitor → withdrawal/expiry on the patched disposable clone, including foreign-owner denial, stale conflicts and guarded cleanup.
8. Implement Event Specials using the confirmed approval-to-end visibility window, Upcoming label before the start, and exact end cutoff. Verify its distinct future/live/ended transitions. Preserve separate Event enrollment/ownership and approval evidence; no pause/resume shortcut is included.

**Done when:** a submitted Tourism revision can be genuinely approved and discovered with the correct card/pin/detail/directions, ineligible content disappears promptly, and real session/MFA/database/browser checks pass. **Outputs:** additive migrations, UI/API source, reproducible checks and a verification record. **Blockers:** actual pilot authority/media/venue evidence and any included Event policy decisions.

## Phase 3 — Finish shared discovery and real location behavior

**Purpose:** make all three tabs behave consistently and closely follow the reference header. **Owner:** Codex; BB supplies the development map configuration. **Dependencies:** Phase 2 public Tourism projection for complete Specials coverage. Layout and data-state tasks proceed independently of the map key.

1. Exercise Property, shopping Specials, Tourism Specials and Services with populated, empty, unavailable and failed responses. Cards, pins and counts must represent the same approved collection and location.
2. Verify category changes, browser back/forward, direct URLs, search/sort/filter state, sign-in return and correct category creation links. Preserve Property `listingId`, saved homes and rent/buy behavior.
3. Verify Map/Feed switching preserves the selected place; Feed must remain usable without loading MapLibre. Test stale/aborted responses and rapid place changes without cross-area pins/cards.
4. Check desktop 1218/1440px, intermediate 768/1024px and phones 320/390px, including long labels, full Property sheets, filter disclosures, keyboard focus, errors and dark theme. Fix actual overlap and inaccessible controls.
5. When a development key is supplied securely in `.env.local`, exercise real South African suggestions, stored app-owned UUIDs, duplicate labels, legacy place links, actual tiles, marker positions, bounds and directions. Keep the existing provider. Never copy a production key or invent cached places.

**Done when for today's local scope:** the category/view/viewport matrix passes using the accepted current map configuration and documented clone substitutions. **Outputs:** browser matrix and screenshots tied to source/evidence. **Pre-launch input:** live map/geocoder and new shared-local place selection need a development key; the user chose to leave configuration unchanged. Live-map verification remains open and mocked map proof does not close it.

**Continuation checkpoint:** Explicitly approved attempt 9 used stable product/driver source, passed 32 populated cells and stopped at Tourism 320px Feed waiting for header hydration. Its captured complete document had no pending HTTP requests or page errors; the prior development debug-channel mitigation is not sufficient. The Property unavailable-message browser check and all later local journeys were not reached. Recorded focused quality hashes still match the 97-test/typecheck/selected-lint source snapshot. Fixture restoration, shared snapshots/container/configuration preservation and owned-resource cleanup passed; independent checks found no remaining rehearsal processes/listeners/resources. No further browser attempt is authorized. Offline analysis points to client bootstrap not consuming its Flight queue. Enhanced failure capture is prepared; exactly attempt 10 has been requested but is not authorized. Phase 3 remains incomplete. See [attempt 9 evidence](pinpoint-phase3-attempt9-local-evidence.json) and [preservation](pinpoint-phase3-attempt9-preservation.json).

## Phase 4 — Close Property and platform requirements

**Purpose:** preserve the working Property product and finish concrete access/write gaps. **Owner:** Codex; target access/delivery sinks from BB or named Operations owner. **Dependencies:** preserved baseline; containment for any new fixtures.

1. Reuse completed rental/content-save evidence. Inspect only remaining paths and changed behavior: delete, publish/unpublish, archive/restore and duplicate. Repair any invalid direct writes using session-scoped, version-checked authorization rather than weakening table revokes.
2. Complete the controlled sale/buyer-interest/provider-follow-up journey on a disposable clone, including sign-in return, saved homes, existing direct links and phone/desktop reload persistence.
3. Finish private Storage/signed URL and organization/agent access checks: own/authorized access succeeds, cross-owner and revoked membership fail, and private records are absent from public reads.
4. Reconcile notification read-state migration/runtime and recipient privacy. Verify safe delivery through an isolated sink; do not send real email/push or contact posters as a test. Retain completed outbox/inbox evidence instead of repeating it unchanged.
5. Observe any outstanding dashboard repeated-request issue, scheduled job behavior and target-schema differences. Fix demonstrated defects and record explicit disposition for unrelated warnings.

**Done when:** the remaining Property writes and complete purchase journey pass, private access is verified, and notification/storage/platform requirements have current evidence. **Outputs:** bounded repairs, fixture IDs/cleanup and platform verification. **Blockers:** missing target access or safe delivery sink; clone success is not staging proof.

## Phase 5 — Verify the final integrated release

**Purpose:** test the final source and prepare a data-preserving release sequence. **Owner:** Codex. **Dependencies:** implementation phases complete; necessary target read access.

1. Run appropriate focused checks while implementing. At the final source checkpoint, run the full suite, typecheck and lint; distinguish opt-in skips and existing warnings from new failures.
2. Run a fresh isolated install/production build, first-load/initial JavaScript budgets and production-dependency audit. Check the current deployment artifact/Worker size if Cloudflare remains the target. Earlier build passes do not certify the new source.
3. Run integrated real-cookie/Auth/MFA/browser/API/database journeys for the current public scope on desktop/mobile. Cover reload, refusal/privacy, stale conflicts, expiry/removal, error recovery and cross-category navigation. Record any substituted external service.
4. Produce an ordered migration/source/runtime manifest with prerequisites, hashes and rollback/recovery boundaries. Apply only explicitly authorized changes; never run all pending migrations blindly.
5. Verify target schema/config parity, backup and restoration readiness on an isolated restore. Reconcile the known shared Postgres permission-denial crash risk safely; do not deliberately reproduce it on shared data or loosen ACLs to hide it.
6. Complete staging journeys with isolated personas and safe sinks when staging is available. A production-only exception requires an explicit scope decision and an honest release record.

**Done when for today's local scope:** the final source passes local quality/build/journey checks and a reviewed migration/recovery plan is prepared. **Outputs:** release manifest, test/build results and pre-launch blocker disposition. Target/staging parity and live-map evidence remain separate pre-launch checks when access/configuration is supplied.

## Phase 6 — Prepare, approve and launch the controlled pilot

**Purpose:** convert verified software into an operable release without manufacturing content or approval. **Owners:** Codex prepares; BB approves; named Operations/Admin owners run the pilot. **Dependencies:** Phases 1–5 and actual permissioned supply.

1. Produce the reviewable release package: scope, source/checkpoint, ordered migrations, environment changes, screenshots, known limits, support workflow, rollback/recovery and post-release checks.
2. Name reviewers and poster/content owners; confirm first real locations and a small set of permissioned Property/Specials/Services supply. Verify actual account/MFA access and remove any test-only public content.
3. Agree pilot thresholds with BB: approval turnaround, stale/incorrect content handling, successful discovery/action rate, errors and the condition to stop or roll back. No made-up commitments or recruitment contact is included.
4. Obtain the final release decision on the concrete package. If deployment is authorized, apply the verified target sequence, smoke-test the deployed journeys and record real production results. If today's agreed finish line is local completion/release preparation, stop at that completed deliverable and leave deployment visibly pending.
5. Publish an end-of-day completion ledger: phases done, evidence links, remaining blockers with owners, and the precise next action. Do not label the entire historical pivot or a public pilot complete solely because code/tests pass.

**Current Phase 6 disposition (7 October):** packaging/operating preparation is completed and reviewable; this does not satisfy outstanding local implementation/journey evidence or actual operating readiness. [Baseline](pinpoint-phase6-baseline-2026-10-07.json) and [preservation](pinpoint-phase6-preservation-2026-10-07.json) identify documentation-only ownership. G01–G14 retain browser, target, remediation, recovery, maps, supply, ownership/criteria and separate deployment/pilot gates, including the frozen ledger's C1–C5 carryovers. Mandatory gates remain open; release is **blocked pending listed evidence/inputs**.

**Done when for the full authorized finish line:** local implementation/evidence and release package are complete and reviewable. Production launch additionally requires successful target/deployed checks, actual supply, operating ownership and separate release authorization. **Outputs:** final local completion/handoff record and explicit pre-launch checklist; no production success is claimed.

## Input and blocker register for today

| Input/gate | Current position | Owner | Work that can continue now |
| --- | --- | --- | --- |
| Today's release finish line | Confirmed: local implementation/verification and release preparation | Codex executes; BB reviews | All local phases; no deployment |
| Events public scope | Confirmed: poster-style Specials, approval-to-end visibility and Upcoming label | Codex | Event implementation; pause/resume excluded |
| Development MapTiler key | Absent; user chose current setup | BB | All non-live-map work and clearly labelled clone map checks |
| Actual locations and permissioned content | Shared place catalogue and new Services tables empty | BB / designated Operations | Synthetic disposable clone tests; no real supply claim |
| Reviewer/poster operating owners | Must be named for the pilot | BB | Private screens/access checks with isolated clone personas |
| Staging/target access and safe delivery sinks | Not established by latest correction evidence | BB / designated Operations | Local build, manifests and clone/recovery rehearsal |
| Known shared runtime crash risk | Shared Postgres `.111`; denial checks safely isolated on pinned `.113` | Codex prepares remediation; BB authorizes target changes | Safe clone checks without weakening permissions |

## Execution ledger

- **3 October:** six-phase plan created from current source, the historical pivot/handoff and the discovery/Services correction evidence. The old acceptance total is retained as historical; no new release item is closed by writing this plan.
- **3 October scope confirmation:** BB selected local implementation/verification and release preparation. Events are Specials with future poster visibility from approval until the exact end time and an Upcoming label. Production/pilot and live-key checks remain visibly separate.
- **3 October Phase 1 completion:** reconciled scope and all remaining task owners/dependencies in the [dated ledger](pinpoint-phase1-ledger-2026-10-03.md). Captured main/HEAD, 1,401 file hashes, 85 source migrations versus 71 shared-local versions (14 absent), current TOTP enablement and read-only data/configuration fingerprints. Earlier source-hash matches and changed snapshots are distinguished. The [preservation record](pinpoint-phase1-preservation-2026-10-03.json) confirms no unrelated file/shared-data/runtime changes. Historical acceptance totals remain unchanged; no feature journey, deployment or pilot is closed by this checkpoint.
- **3 October recorded next task (historical):** Phase 2 reviewer/publication source and verification. Existing entry-publication source was implemented-but-unverified at that checkpoint; no Phase 2 completion was claimed then. Subsequent entries record actual work and verification rather than promises.
- **7 October Phase 6 packaging:** captured current source/status/artifact baseline, reused verified Phase 5 manifest/migration-recovery links, indexed historical attempt-specific screenshots and delivered release/operating/supply/criteria/gate/completion records. Application source, migrations, environment, dependencies, frozen Phase 1 records and historical evidence remain preserved. Phases 3/4/5/local verification and the programme remain incomplete; no deployment/pilot/commit/push/PR/contact. BB's exhausted browser cap is retained without another request. **Current next action:** BB reviews the package and supplies G05 named staging/target/read access and G12 operating owners/deputies; all further target changes/deployment/pilot require their explicit authority.
