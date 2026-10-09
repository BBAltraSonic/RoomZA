# Isolated release CLI checks — 2 October 2026

The current private poster and review/correction screens, revision-specific permission, private admin evidence, place/shop/date review, and approval/unpublication screens pass the clean install, production build and production dependency audit in an isolated source snapshot. This is disposable-clone evidence, not shared-runtime, staging, production or launch acceptance. Release 1 remains 2/48 complete.

| Check | Observed result |
| --- | --- |
| `npm ci` | Passed after adding the missing `@emnapi/runtime@1.10.0` lock entry. |
| `npm run build` | Passed; the poster, pending review and private API routes were present. |
| First-load client JavaScript | Passed for 78 routes against the existing 1,300 KB uncompressed ceiling. |
| Root initial JavaScript | 248.6 KB compressed; passed the existing 300 KB budget. |
| `npm run audit:prod` | Passed, zero production vulnerabilities. |
| Default tests, typecheck, lint | Separate recorded run: 1,109 passed, two opt-in cases skipped; typecheck passed; lint passed with twelve existing warnings. |
| `git diff --check` | Passed; Git emitted line-ending notices. |

The first clean install failed because the lockfile lacked a transitive runtime entry. A temporary normalization candidate would also have removed two existing entries and changed unrelated metadata, so it was not applied. The final repair adds only the missing entry. Reversing that insertion reproduces the original lockfile hash, and every existing package entry is unchanged. Existing checkout dependencies were not installed or replaced. See [repair evidence](pinpoint-lock-repair-evidence.json), [first failure](pinpoint-release-cli-install-failure-evidence.json), and the separate [production audit JSON](pinpoint-release-prod-audit.json).

The build used a temporary copy of source/configuration and fresh dependencies, excluding every checkout environment file. Only explicitly checked loopback demo credentials were supplied. A pinned patched local clone held the database; no user or content fixture was created. Cron execution and copied schedules were disabled, and external delivery keys were empty. The build read no production secret and made no deployment.

Build warnings remain for the existing middleware convention, a Next Edge-runtime import and webpack cache serialization. The full install audit reported development-dependency vulnerabilities; those are not covered by the production-only audit result. No blanket audit fix, forced upgrade or migration of existing middleware was performed.

Guarded cleanup removed the temporary source/dependency/cache directory, three labelled clone containers, volume, network and gateway. Shared public-table/Auth-user/storage counts, Property fingerprints, schedules, container identities/configuration, original intake function bodies/ACLs and table security matched before/after. Source hashes stayed unchanged throughout the snapshot run. No crash/recovery markers were found. [Full environment and cleanup evidence](pinpoint-release-cli-local-evidence.json).

The earlier [screen-only](pinpoint-release-cli-screen-evidence.json) and [poster-permission](pinpoint-release-cli-permission-evidence.json) passes remain separate. The latest run includes admin evidence, its private API route and all five additive clone migrations. The later [location screen checkpoint](pinpoint-release-cli-location-evidence.json) includes its private API. Next: atomic approval/invalidation, then public eligibility. Shared runtime correction, staging access, Property/access verification, Tourism/Event rules and real supplied pilot content remain open. Disposable logical restores do not close the separate fresh-migration reset/RLS release gate.

The fresh [decision-screen checkpoint](pinpoint-release-cli-decisions-evidence.json) passes the same commands, budgets and production audit. Its route manifest includes the private decisions API; source/dependency/clone cleanup passed. Next public eligibility/projection and decision visibility/management. Staging, actual supplied evidence and complete customer/category journeys remain open.


The fresh public HTTP checkpoint also passed: clean install, production build with all four public offer endpoints, the existing 78-route/1,300 KB first-load ceiling, 248.6 KB compressed root JavaScript against 300 KB, and zero production dependency vulnerabilities. [Captured evidence](pinpoint-release-cli-public-http-evidence.json). All six new migrations were clone-only; source snapshot and clone resources were removed, and shared data/configuration/security stayed unchanged. This does not close customer browser or shared/staging release gates.

The fresh [owned-status checkpoint](pinpoint-release-cli-owned-status-evidence.json) passed the same clean install/build/budget/production audit commands, with all seven additive migrations restricted to the disposable clone. Source snapshot hashes and the shared baseline matched; clone resources and the temporary snapshot were removed. A subsequent stable customer-detail checkpoint is running and is not covered by that source snapshot.


The subsequent [public detail checkpoint](pinpoint-release-cli-public-detail-evidence.json) passed clean install, production build including /offers/[id], 79-route first-load ceiling and unchanged 248.6 KB compressed root budget, plus zero production audit vulnerabilities. Temporary snapshot/dependencies and clone resources were removed; source and shared baselines were unchanged. Selected-place customer Feed and full journey/release gates remain open.


The [Feed/detail checkpoint](pinpoint-release-cli-feed-evidence.json) passed clean install, production build including both public screens and anonymous place search, 80-route first-load ceiling, unchanged 248.6 KB compressed root budget and zero production audit vulnerabilities. It includes the long-timer guard and separated Feed footer links. Temporary snapshot/dependencies and clone resources were removed; source/shared baselines stayed unchanged. Full default suite at this source checkpoint: 1,124 passed, two opt-in skips. Shared/staging/fresh migration/full journey gates remain open.


## Report sign-in return checkpoint — 2 October 2026

The [fresh return-path snapshot](pinpoint-release-cli-report-return-evidence.json) passes clean install, production build, both JavaScript budgets and production-only audit (zero vulnerabilities). It includes all nine additive clone migrations, public offer routes, both admin moderation routes and the anonymous report return-path changes. The root compressed budget remains 248.6 KB across 81 budgeted routes. Snapshot/dependencies/cache and labelled clone were removed; source hashes, shared counts/Property fingerprints, schedules and configuration matched. No crash markers were recorded in this CLI clone.

The full default suite passes 1,131 tests (two opt-in scenarios skipped). Actual browser evidence remains separate in [the report record](pinpoint-offer-report-verification.md). The additional phone visitor submission attempt hit a segmentation fault during another clone's restore, before app tests; that failure is retained. A later sequential clone restore and all six phone/desktop checks passed with no crash markers. The restore fault's cause remains unresolved. This does not change the passing CLI result or establish shared-runtime/staging/production readiness.

## Notification inbox checkpoint — 2 October 2026

The [fresh inbox source snapshot](pinpoint-release-cli-inbox-evidence.json) passes clean install, production build including `/profile/notifications`, both JavaScript budgets and production-only dependency audit (zero vulnerabilities). The first-load ceiling passes across 82 routes, with unchanged 248.6 KB compressed root JavaScript. All ten additive migrations, including the nullable read-state column, are clone-only. Snapshot/dependencies/cache and labelled clone resources were removed; source hashes, clone baseline and shared data/Property fingerprints, schedules, security and configuration match. No crash markers were recorded. The full install audit separately reports 34 issues, including development dependencies; existing middleware/Edge-runtime/cache warnings remain.

The preceding install attempt was interrupted before recording any completed command. Its stopped clone and marker-verified snapshot were removed after restarting the installed Docker engine; [recovery evidence](pinpoint-release-cli-inbox-interruption-evidence.json) preserves that distinction and verifies the shared baseline. It is not a build pass.

## Property content-save checkpoint — 2 October 2026

The [fresh Property save snapshot](pinpoint-release-cli-property-save-evidence.json), recorded at 20:24 SAST, passes clean install, production build including the version-checked edit route, both JavaScript budgets and production-only audit with zero vulnerabilities. The first-load ceiling passes across 82 routes; compressed root JavaScript is 248.6 KB. All eleven additive migrations are clone-only. Snapshot/dependencies/cache and labelled clone resources were removed; source hashes and clone/shared data, Property fingerprints, schedules, security/functions and configuration match, with no crash markers. The final-source default suite passed 1,159 tests in 219 files (two opt-in skips). Actual browser evidence is separate in [the complete content-save record](pinpoint-property-save-verification.md). Shared runtime/schema, staging and complete Property/Release 1 gates remain open.

The complete default suite at this checkpoint passes 1,149 tests, with two opt-in skips; typecheck and targeted lint pass. Five real disposable-clone cookie/HTTP/browser/REST/SQL check groups pass in [the separate inbox record](pinpoint-b1-browser-verification.md), with guarded fixture/analytics cleanup. Shared runtime/schema correction, staging, delivery, Property access and complete Release 1 acceptance remain open.

## Tourism/Event private foundation checkpoint — 3 October 2026

The [fresh entry foundation snapshot](pinpoint-release-cli-entry-foundation-evidence.json) passes clean install, production build, both JavaScript budgets and production-only audit with **zero vulnerabilities**. All thirteen additive migrations, including separate category intake and private corrections, applied only to the disposable patched clone; applied SQL hashes were captured and checked afterward. The build retains 82 budgeted routes and **248.6 KB** compressed root JavaScript. It checks the existing Property edit, Offer/public/admin/report and inbox routes. No new category application route is claimed: private entry screens are the next packet.

The install's full dependency audit reports **42 issues** (4 low, 7 moderate, 31 high), including development dependencies; production-only audit is the separately observed zero result. Existing middleware/Edge-runtime/webpack-cache warnings remain. No dependency or runtime upgrade was made for this checkpoint. Marker-checked snapshot/dependencies/cache and label-checked clone containers/network/volume/gateway were removed; source/config/script hashes, applied migration hashes, clone baseline and shared counts/Property fingerprints/functions/security/schedules/configuration matched. No crash markers were recorded.

The final entry reviewer-adapter source suite passes **1,262 tests/223 files** with two opt-in skips, **103 focused entry tests**, typecheck and targeted lint. Its first full run's asynchronous Property focus assertion failure is retained; the bounded test-only timing fix and successful final suite are documented in [the correction record](pinpoint-entry-corrections-verification.md). Twelve real intake and thirteen genuine MFA review/correction clone groups remain separate from this CLI build proof. Private cookie/browser, publication evidence/approval, public category journeys, shared runtime/schema, staging, Storage, real supply and pilot gates remain open.
