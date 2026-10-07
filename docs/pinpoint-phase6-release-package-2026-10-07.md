# Pinpoint Phase 6 release package

7 October 2026, Africa/Johannesburg (SAST). Prepared by Codex for BB's review. **Release decision: blocked pending listed evidence/inputs.** Phase 6 packaging is complete; local verification, pre-launch readiness, deployment and the public pilot are separate and remain incomplete or unauthorized.

## Review index

| Record | Purpose |
| --- | --- |
| [Phase 6 baseline](pinpoint-phase6-baseline-2026-10-07.json) | Before-edit checkout/status, 1,559 file hashes, protected-file hashes, source and retained-artifact reconciliation |
| [Phase 6 preservation](pinpoint-phase6-preservation-2026-10-07.json) | After-edit ownership, preserved historical evidence/configuration, package checks and limits |
| [Operating handoff](pinpoint-phase6-operating-handoff-2026-10-07.md) | Proposed responsibilities, publication/support/incident procedures and authority boundaries |
| [Pilot readiness and gates](pinpoint-phase6-pilot-readiness-2026-10-07.md) | Permissioned-supply register, account readiness, proposed thresholds and every remaining gate |
| [Screenshot register](pinpoint-phase6-screenshots-2026-10-07.json) | Existing images with attempt IDs, executing-driver/source provenance, hashes and limitations |
| [Completion and decision handoff](pinpoint-phase6-handoff-2026-10-07.md) | Actual deliverables, bounded next action and copy-ready continuation |
| [Completion plan](pinpoint-completion-plan-2026-10-03.md) | Programme status; Phases 3/4/5 stay open |

The authoritative technical records remain the [Phase 5 manifest](pinpoint-phase5-manifest-2026-10-06.json), [migration/recovery review](pinpoint-phase5-migration-recovery-2026-10-06.md), [verification](pinpoint-phase5-verification-2026-10-06.md), [blockers](pinpoint-phase5-blockers-2026-10-06.json), [preservation](pinpoint-phase5-preservation-2026-10-06.json) and [cleanup](pinpoint-phase5-cleanup-2026-10-06.json). Their hashes are preserved in the Phase 6 baseline. This package does not replace or retrospectively improve historical results.

## Confirmed public scope

Public tabs: **Specials, Property, Services**. Actions: **Add special, Add listing, Add service**. Shopping Offers, Tourism and Events sit inside Specials. Map contains cards plus the map; Feed works without mounting MapLibre. Preserve app-owned `areaId`, display `area`, Property links/`listingId`, saved homes, rent/buy behavior and pin/card design.

Shopping and Tourism use their approved validity windows. Approved Events are visible from approval until their exact end, with **Upcoming** before the start; venue directions is primary. No Event pause/resume exists. Separate category enrollment, revision permission, exact-version review and privacy/ownership rules remain required. Material Shopping/Tourism/Event submissions hide publication until reapproval; rejection does not revive an old publication. Services uses its own approved-snapshot rules: pending edits/rejection can retain the prior approved snapshot, and withdrawal/unpublish removes it.

Services is limited to private submission → approval → public card/map pin, plus withdrawal/unpublish. Booking, conversations, provider tools, growth/recruitment and expanded alerts remain deferred. The [frozen Phase 1 ledger](pinpoint-phase1-ledger-2026-10-03.md) still carries C1 saved non-Property content, C2 analytics/activity, C3 share/report/support, C4 consent/templates and C5 geography/operations/fallback. They have not been silently excluded; gate G04 requires evidence or BB's explicit scope disposition.

## Source checkpoint and provenance

Branch `main`; HEAD `4942af29f702900146397027125e9c91617ed318`. The initial 670 expanded status entries pre-exist Phase 6. This is an **uncommitted working-tree checkpoint**, so HEAD alone cannot recreate the release. The baseline records each file hash; preservation identifies only this phase's owned documents. No commit, push or PR is authorized.

Fresh Phase 6 file verification found all **1,196 manifest files matching**, with no missing/changed or extra non-document paths. All **87 source migrations** and the manifest's **16 pending source hashes** match. The handoff's earlier 910-file checkpoint used a narrower selection; the Phase 6 count covers the whole manifest and does not imply newly verified journeys.

| Current file | SHA-256 |
| --- | --- |
| `package.json` | `8f876a70866dfc22408b7121e80280ff744ecb03e7f8a67d12ea40d4f3d11c1e` |
| `package-lock.json` | `21d5c432f2709064d62ee297f4e96c8acf71ff471f401148fd87ca101f1b82fd` |
| `next.config.ts` | `c2a228f5e884c5971b3b816ea06a75a08ec94ece8ad9c55b05c1a683235c006c` |
| `open-next.config.ts` | `8e02c850592160eb80d1aed908789f317babcb76985792a86bb79e7c0dd4b1d9` |
| `wrangler.jsonc` | `71902ea200535c52dacf25a4822752cc64f90adfd1b6904528ce23b0e68b923d` |
| `supabase/config.toml` | `14c2621c8f0a1096d43afaf362b01b97631460834842afdff9864bf89ff457bb` |

Retained snapshot: `C:\Users\BB\AppData\Local\Temp\pinpoint-phase5-build-6c257714-86eb-41ad-8c1b-49732a254b5b`. All **1,111 recorded snapshot files** and the three recorded `.next/BUILD_ID`, `.open-next/worker.js` and `.wrangler/worker-size/worker.js` hashes match; no root environment file exists. The manifest provides their full hashes. This is a temporary local rehearsal, not a durable deployable release artifact or backup.

Installed Next 16.3.7, React 19.2.4, OpenNext 1.19.11 and Wrangler 4.112.0 match the record. The workspace's preserved install has `source-map-js` **1.2.1**; fresh isolated installation of the patched lock used **1.2.2**. Source checks used the preserved workspace install. The production audit/build applies to the fresh isolated install, not an assertion that workspace dependencies were patched. Phase 6 changes no dependencies or application code.

## Evidence reusable at this checkpoint

These are retained Phase 5 executions, freshly tied to unchanged source/artifact hashes. No application suite, install/build/audit, clone rehearsal or UI check was rerun in Phase 6. An audit describes its recorded advisory snapshot and must be refreshed for a later target artifact.

| Check | Recorded result | Practical limit |
| --- | --- | --- |
| [Source quality](pinpoint-phase5-quality-2026-10-06.json) | 1,327 passed; five intentional opt-in skips; TypeScript passed | Three skipped Property runtime tests separately passed on integrated clone; B1/Offer opt-ins were not repeated |
| Lint | Zero errors; 1,145 full-run warnings; one new unused tooling import removed; final selected lint passed | 1,144 existing warnings remain; no fresh full-lint count is asserted |
| [Fresh build/audit](pinpoint-phase5-build-2026-10-06.json) | Isolated `npm ci` and production build passed; production vulnerabilities zero | Development-inclusive audit recorded 47 findings; no broad fixes applied |
| Route/root budgets | 91 routes under 1,300 KB first-load ceiling; root compressed JS 251.0 KB under 300 KB | Rebuild and remeasure for target-specific inputs or later code/dependency changes |
| Worker rehearsal | Dry-run passed, total compressed upload 2,881.94 KiB under 3,072 KiB | Approximately 190 KiB margin; no deployment; target configuration differs from inert build inputs |
| Integrated clone | Complete pending sequence, six lifecycle groups and three real Auth/REST/SQL/private-Storage/loopback-sink tests passed | Patched `.113`, disabled cron/hooks, isolated Storage/sink; injected Auth/Next adapters do not prove native cookies |
| [Database recovery](pinpoint-phase5-recovery-2026-10-06.json) | 134 table counts/fingerprints, functions/ACLs, grants/RLS/policies and 87 versions matched after restore | Transient dumps were not retained backups; no target PITR/role-credential recovery |
| [Separate byte recovery](pinpoint-phase5-storage-recovery-2026-10-06.json) | Synthetic private-PDF SHA-256 matched in empty owned volume | No hosted object recovery or combined restored signed-file API journey |

[Phase 5 prior-evidence comparisons](pinpoint-phase5-manifest-2026-10-06.json) remain valid as comparisons because current source matches. Historical Property save, inbox, Offer and Services packets contain changed source or missing Temp drivers. Tourism/Event publication matches 49/54 recorded files. Reuse unchanged recorded scope only; none closes changed integrated journeys.

The Phase 5 strict all-data comparison remains **false**: only the 21-row `landlord_trust_metrics` fingerprint changed, diagnosed against the unchanged six-hour refresh and matching timestamps. Earlier exact cache bytes were not retained. Do not restore the cache, disable the job or manufacture equality. Phase 6 preservation is a file checkpoint; shared rows, containers, jobs and target configuration were not queried again.

## Migration and runtime compatibility

Use the **single authoritative ordered sequence** in the [migration/recovery review](pinpoint-phase5-migration-recovery-2026-10-06.md#baseline-and-ordered-manifest) and its [hash/prerequisite manifest](pinpoint-phase5-manifest-2026-10-06.json). Shared local was last inventoried at 71 applied versions, 16 pending, zero runtime-only versions. Places, notification writer security, Offer intake and Services already existed there. These are inherited observations, not a Phase 6 runtime query or a target migration list.

Reconcile a named target's actual schema/history before selecting its pending files. Seventy stored statement serializations differ from source; investigate semantics rather than replaying applied versions. Apply reviewed files transactionally, keep callers quiescent across lifecycle order 15 and its helper at order 16, and cut over final application source only after all required primitives/ACLs are installed. Current final source is not compatible with absent RPCs in the 71-version shared schema. Preserve ordinary-role write revokes and current ownership/session/MFA checks. Never reproduce revoked-EXECUTE crashes on shared `.111`, relax grants, reset the stack or perform an unapproved upgrade.

## Proposed configuration reconciliation — no values changed

The source Worker name is `roomza`; it references `.open-next/worker.js`, `ASSETS`, compatibility date `2026-05-26`, `nodejs_compat` and enabled observability. Existing source public bindings identify a hosted app and Supabase endpoint. They are candidate configuration, not proof of an approved or reachable staging/production target. No target query was performed.

| Input | Proposed change or confirmation | Required evidence / gate |
| --- | --- | --- |
| App/Supabase public identity | BB names exact staging/target; reconcile `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, public key reference at build and runtime | Approved redacted value matrix, Auth callback/origin parity and target artifact; G05/G06/G10 |
| Maps/geocoder | Secure development MapTiler input; confirm target origin restrictions, app-owned place catalogue and current versioned same-origin worker assets | Real suggestions/tiles/pins/directions; G09. Preserve `.env.local`; never use production secrets locally |
| Auth/Storage/database | Confirm session/MFA settings, role memberships, private buckets/policies, hooks, cron and patched-runtime remediation | Read-only parity and isolated denials/recovery; G06/G07/G08 |
| Server-only credentials | Operations records secure references for service-role, cron, Turnstile, Redis, QStash/signing, Resend and monitoring inputs actually needed by the approved scope | Presence/owner/rotation/recovery evidence without values; G06/G08. Optional schema fields do not prove safe feature behavior |
| Delivery | Use explicit isolated test sinks during verification; later document recipients, consent/templates and enabled integrations | G04/G06; real delivery separately authorized. Queued rows are not delivered messages |
| Worker/monitoring | Confirm account/Worker/environment/domain, assets, bindings, compatibility, logs/alerts and who can stop publication | G06/G10/G12. No operational kill switch is presumed implemented |

The inert rehearsal build cannot become deployable by changing runtime bindings alone. After authorization for target preparation, make a fresh target-specific artifact in isolation using approved inputs, record source/lock/config/artifact hashes, and verify budgets/audit and target journeys. Retain the previous compatible artifact and recovery set. No deploy command is an action authorized by this package.

## Existing screenshots and known limits

The [screenshot register](pinpoint-phase6-screenshots-2026-10-07.json) indexes the archived attempt-8 category Map/dark gallery, attempt-8 failure, attempt-9 hydration failure and attempt-10 Property failure. Each entry records actual attempt, evidence/source location, executing-driver SHA-256, image SHA-256 and viewport. Use the archived attempt-8 gallery rather than assigning mixed current filenames to one attempt. Images show synthetic local content/blank basemaps; they are not approved target screenshots or current integrated acceptance.

The register contains **18 images**. Current source matches **170/175** attempt-8 product files, **173/175** attempt-9 product files and **928/931** attempt-10 recorded files; the remaining changed paths are listed explicitly. Attempts 8/9 embedded driver sources rehash correctly. Attempt 10 supplies a retained driver hash without embedded source in that result. Per-image SHA-256 values were captured in Phase 6, so byte preservation is verified now while historical attribution relies on the documented archive and driver filename rules.

| Issue / incomplete proof | Disposition |
| --- | --- |
| Phase 3 hydration stall | Attempt 9 stopped at Tourism 320px Feed after 32 populated cells; complete HTML/data with `data-ready=false`, no pending requests/page errors. Root cause unresolved; no inferred CORS cause. G01 |
| Discovery/navigation/privacy journeys | Historical attempt 8 passed 60 populated cells but stopped in response states. Later error-copy, history/reload, fresh Feed, keyboard/stale requests, Property sheets/saved homes/login returns remain open. G01 |
| Property native-cookie journey | Attempt 10 failed at two matching `Sale Agreed` labels; zero complete groups. Prepared selector repairs are syntax-only. Private files/inbox/lifecycle/dashboard/organization checks unreached. G02 |
| Changed integrated Specials/Services | Prior successes do not certify changed editors/adapters/discovery and current MFA/expiry/removal/privacy flows. G03/G04 |
| Image deletion | Storage bytes retained for duplicated listing paths; orphan garbage collection not implemented. Include in object inventory/capacity review; no shared cleanup authorized |
| Configuration/recovery/operations | Target identity/parity, runtime remediation, durable database/object recovery, actual permissioned supply and staffed owners unconfirmed. G05–G12 |

Attempts **1–10 remain exhausted**. BB chose “Keep the browser cap exhausted” on 7 October. Do not run attempt 11, another browser tool or substitute UI rehearsal, and do not repeat the cap-extension request. The prepared five-group Property continuation would not close all required journeys even if later authorized.

## Recovery and post-release verification

The [existing target recovery procedure](pinpoint-phase5-migration-recovery-2026-10-06.md#later-target-procedure-and-recovery-boundaries) governs sequencing; [operating handoff](pinpoint-phase6-operating-handoff-2026-10-07.md) assigns proposed authority. Required recovery set: retained database backup, separate object bytes/checksums, consistent cutoff, roles plus secure credential recovery, configuration references, previous compatible artifact and measured RPO/RTO. Supabase database backups omit Storage bytes and custom-role passwords; validate both separately. [Official backup documentation](https://supabase.com/docs/guides/platform/backups) was checked on 7 October. No plan entitlement or recovery capability is assumed for the unnamed target.

This checklist is dormant until separately authorized target/deployment work; every result needs target identity, timestamp, exact source/artifact hash and evidence link:

- [ ] Before cutover: approved parity, backups, isolated restore/private-file denials, runtime remediation, owners and migration window; stop if any required input fails.
- [ ] After migrations, before source cutover: actual applied versions, signatures/ACL/RLS/policies and session/MFA/private/public eligibility checks; never continue from an ambiguous partially applied state.
- [ ] Deployed artifact: correct public build/runtime inputs, routes/assets/versioned MapLibre worker files, budgets, read-only health/config and isolated sink behavior.
- [ ] Genuine desktop/phone poster → MFA reviewer → visitor journeys for Shopping/Tourism/Event/Services, expiry/removal/correction and public/private denial; Property save/direct links/rent-buy/saved homes/buyer/seller/private files/inbox/dashboard checks.
- [ ] Real places/tiles/geocoding/venue directions, refresh/history/Feed isolation, error recovery and privacy-safe monitoring/report routing.
- [ ] Test-content disposition and permissioned supply confirmed; no removal of shared content without captured IDs, dependency/media review and separate authority.
- [ ] BB records deployment result and separate public-pilot decision; Operations enables only approved schedules/integrations and observes accepted thresholds. A failed smoke/privacy/recovery check stops progression.

No completed document, hash match or successful build changes the decision **blocked pending listed evidence/inputs**.
