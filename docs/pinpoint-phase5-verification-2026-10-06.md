# Phase 5 integrated local release checkpoint

Started 6 October 2026 SAST; finalized 7 October 2026 SAST. Filenames retain the kickoff date. **Phase 5 remains incomplete:** current local quality/build/audit and guarded migration/recovery checks pass, but required browser evidence and target parity remain open. No deployment, shared migration, public pilot or attempt 11 occurred.

## Verified current checks

| Check | Result and evidence |
| --- | --- |
| Full source suite | **1,327 passed**, five intentional opt-in skips across three files; [quality record](pinpoint-phase5-quality-2026-10-06.json). The three Phase 4 runtime tests also ran and passed on the integrated clone. Notification-B1 and Offer-intake opt-ins were not repeated. |
| TypeScript | Passed on final source. |
| Full lint | Zero errors; 1,145 warnings in the recorded full run. One new unused tooling import was subsequently removed and the final selected scope passed cleanly; **1,144 existing warnings** remain, largely generated MapLibre assets and existing source/test warnings. |
| Fresh package-lock install | Final `npm ci` passed in an isolated Temp snapshot; workspace dependencies were not replaced. First sandbox install failed on npm-cache access, then a reviewed retry succeeded. |
| Production compilation/budgets | Final source compiled inside the standalone OpenNext build, which invokes `npm run build`. **91 routes** pass the 1,300 KB first-load ceiling; root initial JS is **251.0 KB compressed**, below 300 KB. |
| Production dependency audit | Passed, **zero vulnerabilities**. [Build record](pinpoint-phase5-build-2026-10-06.json). Wider install audit still reported 47 development-inclusive findings; no broad audit fix or dependency upgrade was performed. |
| Cloudflare artifact | OpenNext 1.19.11 / Wrangler 4.112.0 passed. Verified `wrangler deploy --dry-run` uploaded nothing. Total compressed upload is **2,881.94 KiB**, below 3,072 KiB; single-worker strongest-gzip check reports 2,872.1 KiB. Treat the total as the conservative size figure. |
| Ordered migrations/runtime | All **16 pending migrations** applied only to a restored patched clone, including entry publication and both Phase 4 migrations. Six lifecycle groups and three Auth/REST/private-Storage/HTTP-sink tests passed. |
| Database recovery | Fully migrated backup restored with **134 public/Auth/Storage table counts/fingerprints**, functions/ACLs, grants/RLS/policies and **87 versions** matching. Schedules remained disabled in the clone. [Recovery summary](pinpoint-phase5-recovery-2026-10-06.json). |
| Storage bytes | Synthetic private PDF archive restored into a separate empty owned volume after original deletion; SHA-256 matched. [Byte evidence](pinpoint-phase5-storage-recovery-2026-10-06.json). No hosted object/PITR recovery or restored signed-file API journey is claimed. |

Build warnings include an existing Next middleware deprecation and two duplicate-object-key warnings in bundled third-party code. They did not fail the build; no demonstrated application defect was inferred from them. The Worker is approximately 190 KiB below the configured free-plan ceiling, so any later source change requires another size check.

The retained successful snapshot and artifact hashes are in the [manifest](pinpoint-phase5-manifest-2026-10-06.json). Build inputs used inert loopback URL/key values and excluded environment files and delivery secrets. Wrangler's source config has public target bindings; this mismatch makes the rehearsal artifact **unsuitable for deployment** until approved target public configuration is reconciled. No production secret or remote target was used.

## Bounded repairs made here

- ESLint now recognizes the deliberate CommonJS rehearsal drivers; their historical source was preserved. The runtime test's never-reassigned actor list is `const`.
- `/issue4-test` retains its synthetic panel/content/layout but loads its heavy interactive detail panel through an explicit browser-only dynamic boundary. This fixes its observed 1,354.9 KB budget failure. The intermediate SSR-enabled wrapper failed the architecture rule; that failure is archived, the rule was preserved, and the corrected wrapper passes the full suite.
- Only `source-map-js` changed in the package lock, **1.2.1 → 1.2.2**, including registry URL/integrity. An unrelated optional-entry removal proposed by npm was excluded. The patched version closes the production audit finding. [Advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).
- Added guarded read-only collectors, isolated quality/build orchestration, clone recovery/Storage-byte checks and offline browser preparations. No product feature expansion or migration edit was made.

## Integrated journey coverage

The manifest compares seven earlier evidence packets against current source and distinguishes changed paths from unavailable historical Temp-driver paths. Phase 4's successful clone supplied 28 source hashes; its later Storage-cleanup change is expected harness drift. The Phase 4 implementation-preservation JSON itself has no hash map, so it cannot certify every final file. [Drift record](pinpoint-phase5-drift-2026-10-06.json).

| Journey | Reusable/current evidence | Still unverified |
| --- | --- | --- |
| Property rental/content save, direct links, saved homes | Historical rental/save proof retained; current source tests and integrated clone lifecycle/purchase proof. Property actions/form changed, so old complete browser save proof is snapshot-specific. | Native current save, rent/buy/direct-link preservation, save/remove/reload, desktop/phone milestones, native lifecycle and cookie organization revocation. |
| Purchase/platform | Genuine integrated Auth/REST/SQL interest, stale/foreign refusal, seller notes, atomic progress, private signed bytes and recipient/sink checks passed. Auth/Next adapters are injected. | Real-cookie purchase/seller/private-file/inbox flows and dashboard request-count observation. |
| Shopping Specials | Earlier permission/MFA/decisions/public/detail/feed/report proof retained; unchanged schema fragments reusable; current full source suite passed. Public adapters/editor/discovery paths have drift. | Current integrated poster → MFA review → visitor, refresh/expiry/removal, privacy and recovery browser evidence. |
| Tourism/Event Specials | Historical full clone publication/browser packet retained; 49/54 recorded hashes match. Current full suite and complete migration sequence passed. Some runner/feed/test files changed. Event approval-to-end/Upcoming rule retained. | Current integrated changed public/discovery paths and Phase 3 response/URL/navigation matrix. No new Event policy or real authority claim. |
| Services minimum discovery | Historical separate provider approval/snapshot/MFA/withdrawal journey retained; six/nine recorded hashes match. Migration already shared-local. | Changed discovery/current integrated browser states. Expanded booking/conversation/provider tools remain deferred. |

Attempts 1–10 are exhausted. [Prepared bounded scope](pinpoint-phase5-browser-scope-2026-10-06.md) corrects ambiguous progress assertions, captures browser analytics IDs and guards junction cleanup. Parent/driver/helpers passed syntax inspection only. No browser tool was launched. Attempt 10 still has zero complete browser groups; Phase 3's historical populated-cell results do not close its missing state/navigation checks or hydration diagnosis.

External substitutions remain explicit: blank basemap, real stored clone-place suggestions, placeholder images/intercepted directions in earlier browser packets; patched `.113`, disabled schedules/hooks, isolated Storage and HTTP sink in current clone; inert loopback build inputs. None proves real maps, geocoding, delivery, poster authority or target readiness.

## Preservation and resource disposition

[Preservation](pinpoint-phase5-preservation-2026-10-06.json) matches HEAD, every non-owned source/evidence file, `.env.local`, frozen Phase 1 records, source/history migrations, container identities/configuration, functions/grants/RLS/policies and schedule definitions. No reset, stash, commit, push or PR occurred.

The strict all-row fingerprint result remains **false** because the existing shared `landlord_trust_metrics` cache refreshed from 21 rows to 21 rows. [Read-only diagnosis](pinpoint-phase5-shared-cache-drift-2026-10-06.json) records successful pre-existing six-hour cron runs at 02:00 and 08:00 SAST on 7 October, with all 21 calculated/window-end timestamps at the latter refresh. This is consistent with the unchanged refresh function's delete/recalculate behavior. All other inventoried table fingerprints, including listings/images/favorites, conversations/messages and Auth/Storage, match the kickoff snapshot. We did not restore or disable that shared cache/job. Exact earlier cache row content was not retained, so this finding does not manufacture a strict full-data pass.

Clone-task before/after shared snapshots matched within its own shorter run. All labelled clone containers/networks/database/Storage volumes and the separate byte-recovery resources were removed; no rehearsal listener remained. The exact failed-install Temp snapshot was removed. The successful environment-free build snapshot is retained for artifact review; it uses its own installed dependencies and is not a running app. [Cleanup record](pinpoint-phase5-cleanup-2026-10-06.json).

## Remaining gates and next action

[Blocker record](pinpoint-phase5-blockers-2026-10-06.json) assigns each gate. BB owns explicit browser cap extension and target identity/access; Codex owns executing the exact approved scope and reconciling target evidence. The [reviewed migration/recovery plan](pinpoint-phase5-migration-recovery-2026-10-06.md) records prerequisites, source/runtime compatibility and data-preserving recovery boundaries. Shared `.111` remediation, actual staging/config parity, retained target backups/Storage objects, RPO/RTO and operating owners remain pre-launch gates.

BB explicitly chose **Keep the browser cap exhausted** on 7 October 2026. Attempt 11 remains unrun; do not repeat the approval request without new user direction. Authorized independent Phase 5 work is packaged for review, with browser and target gates retained. If BB later extends the cap, the prepared five-group scope is the concrete starting point; passing it would still not close all Phase 3/4/current integrated browser checks. No current check authorizes shared changes, deployment or a public pilot.
