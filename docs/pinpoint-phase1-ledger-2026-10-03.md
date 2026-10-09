# Pinpoint Phase 1 scope, baseline and evidence ledger

Date: 3 October 2026, SAST. Owner: Codex. Authority: BB's confirmed scope in the [six-phase plan](pinpoint-completion-plan-2026-10-03.md) and the instruction to fully execute **Phase 1**. This ledger completes the scope/preservation checkpoint; it does not execute Phases 2–6 or certify a release.

## Agreed scope and precedence

- Today's finish line is implementation, local verification and a concrete release package for BB's review. Deployment, external contact, supply recruitment and the public pilot require their later gates.
- The public tabs are **Specials, Property, Services**; their creation actions are **Add special, Add listing, Add service**. Shopping Offers, Tourism and Events belong within Specials. Local-provider Services is included and enabled locally; the historical later-Services assumption is superseded.
- Map shows result cards and their map. Feed shows cards without mounting MapLibre. Category/view changes carry the selected app-owned place. Preserve Property `listingId`, old direct links, saved homes, rent/buy state and existing records.
- Tourism uses continuous exact SAST start/end windows, normalized to UTC. Availability is `startsAt <= now < endsAt`. Venue directions is its primary action.
- Events are poster-style Specials. Approved Events are discoverable from approval until the exact end, labelled **Upcoming** before the start. The start changes the label/state, not first visibility. No earlier publication cutoff or pause/resume feature is included.
- Both entry categories require separate category enrollment, revision-bound poster permission and actual reviewer place/media/authority evidence. Shopping Offer enrollment does not grant Tourism/Event permission. Material resubmission hides publication until reapproval; rejection must not revive the older version. Renewals need fresh review. Withdrawal and ineligibility stop discovery/actions without relying on schedules.
- Services retains its separately documented approved-snapshot behavior: a pending edit/rejection can preserve its prior approved snapshot. Do not accidentally apply that behavior to Tourism/Event material submissions.
- Real supply/authority is a pilot input. Synthetic clone fixtures prove software behavior only. No production secrets, blind migration application, reset, shared stack upgrade or permission weakening is authorized.

The [historical pivot](pinpoint-pivot-plan.md) retains **2/48** closed acceptance items and **0/3** complete historical new-category journeys as a historical count. Those numbers are not today's three-tab completion percentage, and this checkpoint does not recalculate or close historical boxes. The current task register below is separate. Historical enquiry/ticket actions, four top-level categories, undecided Event cutoff and delayed Services assumptions are superseded by the decisions above. Services booking/request/conversation expansion in historical Step 8 is not part of the confirmed minimum provider discovery slice.

## Preserved checkout and environment

The immutable [baseline manifest](pinpoint-phase1-baseline-2026-10-03.json) was captured at **12:12:05 SAST** (`2026-10-03T10:12:05.925Z`). Checkout: `C:\Users\BB\Documents\RoomZA`, branch `main`, HEAD `4942af29f702900146397027125e9c91617ed318`. No branch, commit, reset or stash was made.

The manifest records **1,401 file hashes**, 70 tracked modified files and 428 untracked files using expanded paths. The inventory includes the newly added Phase 1 collector; therefore **427 untracked files pre-existed this checkpoint**. Existing completion/pivot/contract/handoff documents were already untracked. All existing application code, migrations, assets, evidence and dependency files are preserved. The old [six-phase source snapshot](pinpoint-six-phase-source-baseline.json) is retained unchanged rather than overwritten.

Node is `v24.18.0`; installed Next is `16.3.7`. `.env.local` is verified to target loopback Supabase `http://127.0.0.1:54321`; no development MapTiler key is present. Production environment content was not read. Only environment presence/loopback checks and configuration fingerprints are saved, never secrets. The collector reads Docker configuration internally and records hashes/IDs/images, not environment values.

Nine existing shared Supabase containers were inventoried. Database remains `public.ecr.aws/supabase/postgres:17.6.1.111`; Auth remains `gotrue:v2.189.0`, with current TOTP enrollment and verification enabled. Earlier handoffs describing disabled TOTP are historical. The known shared denial/crash risk was **not probed**; no revoked-RPC, fixtures, Auth sign-ins, browser journeys, schedules or delivery were exercised in this checkpoint.

All database reads use explicitly read-only transactions. Counts and sorted row fingerprints cover all public tables plus Auth users/sessions/factors and Storage objects/buckets. Separate fingerprints record public/private functions and ACL/settings, table grants/RLS, policies and cron definitions. These are preservation checks, not a new access/security audit, backup or restore rehearsal.

| Existing shared-local records | Count at baseline | Meaning |
| --- | ---: | --- |
| Listings / listing images / saved homes | 300 / 2,104 / 100 | Existing seed data; preserve IDs and content |
| Applications / viewings | 100 / 25 | Existing Property workflow records |
| Conversations / messages | 40 / 228 | Existing private communication records |
| Auth users / sessions / MFA factors | 75 / 21 / 0 | TOTP is enabled; no enrolled real-pilot reviewer is established |
| Discovery places / buyer interests / Storage objects | 0 / 0 / 0 | No stored-place, sale-interest or private-object journey follows from these counts |
| Shopping Offers / offer revisions / offer events | 0 / 0 / 0 | Shared intake schema exists, no real supply |
| Service submissions / approved services / service events | 0 / 0 / 0 | Services is enabled, no shared fixture or real provider supply |
| Notification events | 0 | No delivery verification or new notification generation |

The final [preservation comparison](pinpoint-phase1-preservation-2026-10-03.json) is the completion evidence: unchanged protected files, checkout, source migrations, shared rows/counts, migration history, containers/configuration, functions/grants/policies/schedules and local environment. Its `phase1OwnedHashes` identifies this checkpoint's edited/new files. Original hashes for the four amended existing documents remain in the baseline. `fixturesCreated` and `mutationsPerformed` are false. Only the documents, collector and two manifest files listed under `phase1OwnedPaths` belong to this work.

Reproduce the read-only comparison from this checkout with `node scripts/ops/pinpoint-phase1-baseline.mjs verify`. `capture` refuses to overwrite the dated baseline. Later feature changes will intentionally invalidate this checkpoint comparison; create a new dated baseline rather than rewriting this one.

## Migration source/runtime manifest

There are **85 migration source files**, **71 shared-local migration history rows**, **14 source-only versions**, and **no runtime-only version**. Every source file has a SHA-256 in the baseline. Shared history is fingerprinted before/after. The four recent applied versions are Places (`20260927090000`), notification server writes (`20260930142632`), Offer intake (`20260930164313`) and local Services (`20261003081807`). Services was previously enabled with explicit approval; this checkpoint applies nothing.

| Absent from shared local | Existing evidence / remaining prerequisite |
| --- | --- |
| `20261001220000` Offer review queue | Recorded clone/MFA/browser checks; ordered target application/parity pending |
| `20261002010000` Offer poster permission | Revision-bound clone proof; target parity pending |
| `20261002023000` Offer permission review | Admin evidence clone proof; target parity pending |
| `20261002040000` Offer location review | Place/shop/date clone proof; target parity pending |
| `20261002060000` Offer decisions | Atomic approval/unpublish clone proof; target parity pending |
| `20261002070000` Offer public reads | Public eligibility clone proof; target parity pending |
| `20261002070109` Offer confirmed queue | Recorded reviewer-cookie checkpoint; target parity pending |
| `20261002080000` Offer owned status | Recorded clone checkpoint; target parity pending |
| `20261002083512` Offer moderation targets | Recorded report checkpoint; target parity pending |
| `20261002120900` Notification read state | Recorded inbox clone proof; shared migration/runtime pending |
| `20261002162631` Property save | Recorded complete clone HTTP/SQL/browser proof; shared application pending |
| `20261003025344` Entry intake | Twelve real clone Auth/REST/SQL groups; shared application pending |
| `20261003032659` Entry corrections | Thirteen real clone Auth/MFA/REST/SQL groups; shared application pending |
| `20261003100134` Entry publication | Existing additive source; no completed publication verification record found |

Migration history statement serialization differs from source text for **70 of the 71 applied versions**, even after newline/outer-whitespace normalization. Services matches exactly. This is a recorded **text-comparison limitation**, not evidence of 70 semantic schema defects: CLI history can split/serialize SQL differently. The manifest preserves separate source/history hashes and comparison flags. Actual schema/config parity remains Phase 5.5; do not rewrite migration history or apply migrations to erase these flags. Version presence alone does not certify final schema parity.

## Earlier evidence mapped to its actual environment

V = verified in the named recorded environment/snapshot, I = source exists with current verification still required, O = unfinished authorized local work, B = external prerequisite blocks that check, D = explicitly outside today's finish line. V never means complete release acceptance. All earlier failure files are retained. Detailed current-source comparisons for fifteen evidence records are saved in the preservation JSON; missing top-level `passed` is kept null, not manufactured as a pass.

| Work | State and actual evidence | Limits and current disposition |
| --- | --- | --- |
| Property baseline and rental read/write journey | V, shared-local historical [Property baseline](pinpoint-property-baseline.md), including its contained rental continuation | Live stored-place/geocoder, full purchase, remaining writes, Storage and staging remain open; old snapshots are not a fresh release pass |
| Property content save | V, disposable patched clone: [complete save](pinpoint-property-save-verification.md), eleven HTTP/SQL and five native cookie/browser groups | All **10 captured source hashes still match**. Reuse this proof; shared migration is absent. Delete/publish/archive/duplicate and full buyer journey remain separate |
| Organization access | V, disposable clone: [six access groups](pinpoint-organization-access-verification.md) | Cookie/private Storage/revoked signed-URL checks remain open. Historical direct-edit gap has a separate save repair; delete gap remains |
| Notification writer B1 | V, recorded shared-local action/SQL [writer check](pinpoint-b1-local-verification.md); writer migration is applied | Sink delivery and staging remain open; never infer sent email/push from queued rows |
| Notification inbox/read state | V, disposable clone: [five cookie/browser/REST/SQL groups](pinpoint-b1-browser-verification.md) | All **14 captured hashes still match**. Read-state migration is absent shared locally; do not repeat the unchanged clone packet |
| Shopping Offer intake/review/evidence/approval | V, prior shared-local private poster check and subsequent patched-clone MFA/reviewer/evidence/decision checkpoints linked by the [historical pivot](pinpoint-pivot-plan.md) | Offer capability is independent of Tourism/Event. Several editor/adapter hashes have changed; recorded successes stand for their original snapshots. Current integrated journey and target parity remain open |
| Shopping Offer public/detail/feed/report | V, recorded clone [public eligibility](pinpoint-offer-public-read-verification.md), [HTTP/directions](pinpoint-offer-public-http-verification.md), [Feed](pinpoint-offer-feed-verification.md), [report](pinpoint-offer-report-verification.md) | Public-data/UI/redirect/config hashes have changed. Phase 5.3 must verify today's integrated source; historical proof is not current shared publication |
| Tourism/Event domain, intake and correction | V, source/domain and patched-clone [intake](pinpoint-entry-intake-verification.md), [correction](pinpoint-entry-corrections-verification.md), [adapter](pinpoint-entry-adapter-verification.md) | Intake **11** and correction **12** captured hashes match. New workspace/reviewer/permission/publication source is I; no complete native publishing-to-visitor journey established |
| Shared layout and Services | V, recorded shared-local anonymous checks and real Auth/MFA/API/SQL/browser clone [correction record](pinpoint-discovery-correction-verification.md) | Six Services evidence hashes match; clone runner and discovery component hashes changed. Blank basemap **and substituted place suggestions** were used. Services migration/TOTP enablement are shared-local, not a staging/production pass |
| Tests/build/release checks | V, prior Property/entry install/build/budget/audit checkpoints; latest recorded correction suite 1,283 passed, two skips before final camera/cache changes; focused 234/53 afterward | These are historical source checkpoints. Phase 1 runs no application suite, build, browser or advisor; Phase 5 must verify final integrated source |
| Live maps/geocoder, staging, production, real supply and pilot | B/D; no new evidence here | Development key/target access/sinks/permissioned content/named owners needed; production and pilot outside current authorization |

## Every remaining six-phase task

Each row retains the plan's task number. Owner **Codex** means implementation/checks within the authorized local scope; BB supplies external inputs and approves scope/release decisions. Operations means **BB-designated owner, not yet assigned**, never an assumed commitment by another person. Required evidence is the done-when condition. Independent source/clone work can proceed while external inputs remain pending.

| Task | State / owner | Dependency and next action / required evidence |
| --- | --- | --- |
| 2.1 Private entry workspace | I/O · Codex | Reuse verified intake/correction adapters; verify existing routes/editors with real cookie enrollment, partial save, complete submit, reload, withdrawal, reasons and 409 input preservation |
| 2.2 Entry reviewer queue/detail | I/O · Codex | 2.1 and revision-bound correction contracts; verify existing reviewer UI against genuine cookie MFA, exact submitted revision/location/dates/version and private correction reasons |
| 2.3 Permission/reviewer evidence | I/O · Codex; BB supplies real authority later | 2.2; verify existing permission/publication source and persisted revision/place/media/authority records; live mutation checks for account, session, policy, suspension, category, reviewer membership/factors |
| 2.4 Atomic entry decisions | I/O · Codex | 2.3; version-checked approve/reject/unpublish, immutable audit, one-winner races, material-submit hiding, no revival after reject/withdraw |
| 2.5 Public entry projection/action | I/O · Codex | 2.4; minimal public DTO, fresh fail-closed count/feed/detail and fixed-host verified venue directions; revoke/suspend/ineligibility removal |
| 2.6 Tourism Specials integration | O · Codex | 2.5; actual approved coordinates/card/pin parity, explicit SAST/loading/empty/error/retry and open-page start/end/removal rechecks |
| 2.7 Full Tourism journey | O · Codex | 2.1–2.6; disposable patched-clone desktop/phone native poster → MFA reviewer → anonymous visitor → withdrawal/expiry, foreign/stale denial, SQL persistence and guarded cleanup |
| 2.8 Event Specials | I/O · Codex | Confirmed scope and 2.3–2.5; approval-to-end visibility, Upcoming-before-start and exact end cutoff, separate enrollment/ownership/evidence, genuine future/live/ended browser/SQL checks |
| 3.1 Category response matrix | O · Codex | 2.6/2.8; Property, shopping/Tourism/Event Specials and Services populated/empty/unavailable/failure parity for cards/pins/counts/location |
| 3.2 URL/navigation/create links | O · Codex | Current category routes and 3.1; back/forward/direct links, filters/sort/search/sign-in return, creation destination, saved-home IDs and Property `listingId` preservation |
| 3.3 Map/Feed and stale requests | V/O · Codex | Reuse focused correction proof; current category switching must preserve place, avoid map import in Feed and deny cross-area late/aborted responses |
| 3.4 Responsive/accessibility matrix | V/O · Codex | Reuse recorded 1218/390/320px checks; finish 1218/1440/768/1024/320/390px populated categories, long labels, Property sheets, keyboard/focus/errors/dark theme |
| 3.5 Real map/place behavior | B · BB key; Codex checks | Secure development key and stored app-owned places; real suggestions/duplicate labels/legacy links/tiles/pins/bounds/directions. Accepted clone substitutions can support local scope; live proof stays pre-launch open |
| 4.1 Remaining Property writes | O · Codex | Reuse save proof and preserve revokes; inspect/repair delete, publish/unpublish, archive/restore, duplicate with session/version access and real persistence/denial checks |
| 4.2 Sale/buyer/provider journey | O · Codex | 4.1 and contained sale fixtures; real sign-in return/save/interest/follow-up, direct links, phone/desktop reload and full persistence. Existing empty buy feed is not evidence |
| 4.3 Private files and organization access | V/O · Codex | Reuse six organization groups; isolated private Storage objects/signed URLs, cookie own/authorized success, cross-owner/revoked membership denial and public privacy |
| 4.4 Notifications and safe delivery | V/O/B · Codex; BB sink/access | Reuse writer/inbox proof; reconcile read-state/runtime/recipient privacy, isolated delivery sink with actual delivery evidence and unchanged unrelated recipient data |
| 4.5 Dashboard/jobs/schema observations | O · Codex | Controlled source/clone observation; diagnose repeated dashboard requests and relevant schedules/schema differences, repair demonstrated defects, record unrelated-warning disposition |
| 5.1 Final source quality | O · Codex | Final implementation and carryover tasks below; full tests/typecheck/lint with skips/existing warnings distinguished from new failures |
| 5.2 Fresh build/budgets/audit/artifact | O · Codex | 5.1 source checkpoint; isolated install/build, JavaScript budgets, production audit and current Cloudflare Worker size; preserve dependency/cleanup evidence |
| 5.3 Integrated Auth/MFA/browser/API/SQL | O · Codex | Phases 2–4 and 5.1; current desktop/phone cross-category journeys, reload/privacy/refusal/conflicts/expiry/recovery with any service substitutions explicit |
| 5.4 Ordered migration/recovery manifest | O · Codex; BB target authorization | Baseline 14 pending versions plus later repairs; prerequisite/order/hash/rollback boundaries, no blind application. Capture verified source/target checkpoint |
| 5.5 Target parity and isolated restore | O/B · Codex; BB target access | 5.4; actual schema/config parity, backup/restore rehearsal and safe shared `.111` remediation proposal. Never reproduce the crash on shared data or relax ACLs |
| 5.6 Staging journeys/sinks | B · BB access/sinks; Codex checks | Staging environment/personas/sinks plus 5.3–5.5; real staging journeys or explicit BB scope exception. Local clone evidence does not substitute silently |
| 6.1 Reviewable release package | O · Codex | Final local Phases 2–5; source checkpoint/migrations/config/screenshots/limits/support/recovery/post-release checks with every open pre-launch gate visible |
| 6.2 Named operators and real supply | B/D · BB/designated Operations | Actual reviewers/posters/MFA/permissioned content/locations; pre-launch only. Codex can prepare checklist and confirm fixture cleanup; no recruitment/contact authorized |
| 6.3 Pilot thresholds | B/D · BB/designated Operations | 6.2 real capacity/supply; agreed review/staleness/discovery/action/error/stop thresholds. Codex records confirmed values; never invent commitments |
| 6.4 Release decision/deployment | O/D · Codex prepares; BB decides | Concrete 6.1 package; today's deliverable stops at prepared release. Deployment and deployed checks require separate authorization plus target gates |
| 6.5 Final completion ledger | O · Codex | 6.1; complete local results, evidence, open gates/owners and exact next step; public launch remains distinct |

## Historical requirements retained as explicit carryover

The six-phase plan's shorter task list must not silently drop older release requirements. These items remain open until implemented/verified or BB explicitly removes them from the release. Recording the decision dependency completes this reconciliation; it does not grant permission to declare the feature done or deferred.

| Carryover | State / owner | Dependency / disposition |
| --- | --- | --- |
| C1 Typed saved non-Property content and saved-screen/sign-in return (old 4.4) | O · Codex; BB decides any exclusion | Typed new-category IDs and 2.5/2.8/Services projection; verify save/remove/reload/expired privacy without changing saved-home or purchase-progress IDs. Include in 5.3 unless BB removes it |
| C2 Privacy-safe analytics, deduplication and factual poster activity (old 4.6–4.7) | O · Codex; BB accepts scope | Current action/read contracts; capture location/category/source/availability/views/saves/action intent without enquiry text or claiming visits/bookings. Link event persistence/activity proof to 5.3/6.1 |
| C3 Stable share/local pages and category report/correction/support (old 4.2, 5.4–5.5) | V/O · Codex; BB names support owner | Reuse Offer report proof; verify current Property/Offer links and Tourism/Event/Services direct-status, share and report handling with scoped reviewer routing; include in 3.2/5.3/6.1 |
| C4 New-category notification consent/templates (old 5.6) | O/B · Codex; BB sink/consent decisions | Review type separation from Property purchase `offer` preference matching; safe sink/unsubscribe/frequency/expiry checks before any new-category delivery. Optional promotional alerts remain opt-in and outside sending authorization |
| C5 First geography, selectable place labels, operational capacity and feature/monitoring fallback (old 0.1/0.4, 1.5–1.8, 5.7) | O/B · Codex technical; BB/designated Operations inputs | Record current place levels/duplicate-label behavior in 3.5, triage technical defects in 4.5/5.1, carry real geography/capacity/monitoring/support into 6.1–6.3. No invented owners/supply/thresholds |

Old Steps 0–2 map to this scope, 3.1–3.5 and 6.2–6.3; old Step 3 maps to 2.3–2.5/2.8 and 5.4–5.6; old Step 4 maps to Phase 2 and C1–C3; old Step 5 maps to Phase 3, 4.4, Phase 5 and C3–C5. Old Step 6 recruitment, poster share materials, monitoring, user interviews and continue/repair/expand decisions are **D**, beyond today's local finish line, owned by BB/designated Operations with actual supply, authorization and agreed thresholds as dependencies. Old Step 7 growth/alerts/acquisition and Step 8 expanded service requests/conversations/provider tools are later expansion, **D**; their discovery-only delayed-Services assumption is superseded by current local Services.

## Phase 1 exit checklist

- [x] Current checkout/uncommitted inventory and file hashes captured; existing work is not attributed to this phase.
- [x] Source/runtime migration differences, current environment and data-preservation evidence recorded without changing shared state.
- [x] Three-tab/current Services scope reconciled with historical categories; old evidence and acceptance totals retained.
- [x] Local finish line and confirmed Event/Tourism rules recorded; no new policy question or invented permission.
- [x] All 29 remaining numbered phase tasks and five historical carryovers have owner/dependency/evidence disposition; external and deferred gates remain visible.
- [x] Current plan, historical pivot, contract and handoff point to this execution ledger.

Validation: read-only baseline/preservation comparison **passed**, with all nine preservation checks true. Collector Node syntax and targeted ESLint passed. Document validation checked 91 existing relative links, all 29 task numbers exactly once, five carryovers, migration totals and exclusion of private environment files from the source inventory; the subsequently generated preservation link exists. Edited/new documents have no trailing whitespace. Repository-wide `git diff --check` exits 1 for **pre-existing** trailing whitespace in `src/features/map-discovery/discovery-page.tsx:411`; the captured file hash is unchanged and this phase does not repair it. This is not a new Phase 1 defect or a full-repository whitespace pass. No application tests/build/browser journeys were repeated for this documentation/inventory checkpoint. **Phase 1 is complete; Phases 2–6 remain open.**

Next bounded work, when Phase 2 is requested: inspect the existing entry-publication migration/adapters/reviewer UI against 2.2–2.5 and the confirmed Event rules, then complete focused source and contained real Auth/MFA/API/SQL proof before claiming publication. The 12/13-group private entry checks and unchanged Property/B1 audits need no blanket rerun.
