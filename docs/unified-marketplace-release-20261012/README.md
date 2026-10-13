# Unified marketplace accounts: production release

Released 12 October 2026 to [Pinpoint](https://roomza.pinpoint-roomza.workers.dev). Worker version `357994a7-1219-4dc8-b025-0e6654ac3f5f` serves 100% of traffic; deployment `7586504c-f3e8-457c-a075-b0f0c2fed6bd`. Previous Worker version retained for code rollback: `12475926-df2b-4416-a67c-3d91d03a8fba`.

The remaining 59 application, test, migration, documentation and local rehearsal files were overlaid onto the verified production snapshot. Earlier completed work from today remains included: Google initiation, Service details, Specials photo galleries, national place catalogue and removal of email-verification gates. Only the two stale regression test expectations were edited during this task. The existing uncommitted workspace was preserved. No commit, push, reset, seed, data import or migration-history repair was performed.

## Migration and preservation

20261012011144_unified_marketplace_accounts.sql was still needed. Its functions and profile trigger were absent, and only five persona rows existed across 11 permanent accounts. Six accounts had no personas. The linked isolated dry-run listed only that migration, and the linked apply ran only that file. All earlier migrations were already installed; include-all was unnecessary.

Live enum, columns/defaults, foreign keys, indexes, trigger interactions, function grants and existing data were inspected before applying. All 11 permanent accounts now have renter, buyer, landlord and seller workflows, one primary and one active selection, and all four detail containers. Persona rows rose from 5 to 44. Missing containers were added; every existing persona/detail row retained its full-row fingerprint. Full-row fingerprints and counts matched across 24 other checked tables, including Auth users/sessions, profiles, listings/images, saved homes, messages/conversations, applications/viewings, admin memberships, organization records, category posting capabilities, Specials, media and all 18,253 place records. These checks are preservation evidence, not a database or Storage backup.

The six installed function bodies match the migration. Organization function grants and privilege modes, all public table ACL/RLS settings and all public RLS policies remain unchanged. Hosted denial checks confirm that a sessionless authenticated caller cannot recover an account, guests cannot execute recovery, ordinary JWT roles cannot execute trusted draft creation and the private setup helper is not executable by authenticated clients. Nineteen database invariants, five hosted denial/ACL checks and two anonymous REST RPC denial checks passed.

## Enabled behavior

Signup and sign-in use one account without choosing or switching an ordinary role. Create listing opens Property, Services, Shopping Specials, Places and Events; My listings reaches their existing management workspaces. Property rent/sale drafts use the verified server session and support idempotent retries. Shopping/Places/Events category enrollment happens as part of draft creation. Revoked posting access, admin/reviewer membership, ownership, policy acceptance, suspensions, MFA and review/publication requirements remain enforced. Eligible accounts can create organizations or accept matching unexpired invitations without a legacy landlord role gate.

## Validation

- 1,692 distinct tests passed after correcting the two stale navigation assertions. The focused rerun passed 88 tests in eight suites. Five tests were skipped. One architecture conformance test remains failing with exactly the same seven findings on the current and prior production snapshots; no new architecture findings were introduced. The full-suite log and baseline comparison are retained.
- TypeScript, scoped ESLint, dependency audit (zero vulnerabilities), Next.js/OpenNext build, JavaScript budgets, server minification, discovery asset preparation, Worker dry-run packaging and current platform size gate passed.
- 50 live read-only route/API checks and 73 exact served-asset hashes passed. Shared account navigation, creation and retry markers are present in delivered bundles; account-recovery, trusted draft and category-chooser markers are present in the built server artifact.
- All 8 production bindings and runtime compatibility/asset settings match the previous version. Deployment used --keep-vars.

Security advisors increased from 67 to 68. The sole added finding concerns the intentionally authenticated SECURITY DEFINER ensure_marketplace_account() RPC. Its narrow self-only session boundary was reviewed and tested; no new anonymous definer function exposure was added. Details and the official remediation link are retained in security-comparison.json. Existing findings were preserved.

## Remaining verification

No inspected work from today remains undeployed. No production browser run, real-account signup/login or Google consent/callback, authenticated category creation, hosted upload or publication fixture was performed in this task. The existing source-matched disposable-clone record contains 56 PostgreSQL/Auth/REST/browser checks; that is local historical evidence, not hosted journey proof. Current HTTP, asset and database checks prove deployment and the stated invariants.

A code rollback should retain the additive account migration. Do not delete backfilled personas or details to roll back code: users can now use them. rollback-functions.sql preserves the historical organization function definitions for a separately considered database rollback.

Evidence: release.json, scope.json, review.md, source-diff.txt, migration dry-run/apply logs, schema/live security records, database verification and fingerprints, hosted denial checks, full and rerun test logs, architecture baseline comparison, build/packaging logs, smoke.json and production-settings.json.
