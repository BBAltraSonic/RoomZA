# B7 Shopping Offer review access — 30 September 2026

Owner: Build. Checkout: existing uncommitted RoomZA working tree, inspected once and preserved. This bounded step verifies anonymous HTTP denial and actual TOTP review access on a disposable patched local clone. It adds a reusable rehearsal harness and evidence, with no application, migration, shared-stack configuration or permission change. Release 1 remains **2 of 48** complete acceptance items; no checkbox is newly closed.

| Environment | Observed result | Limit |
| --- | --- | --- |
| Disposable local clone | One contained scenario passes 17 HTTP/MFA cases, including real enrollment/challenge, admin/owner factor thresholds, current membership, suspension, reviewer reads and persisted rejection. Function bodies/ACLs and intake table RLS/policies/grants match the shared source; cleanup restores baseline. | HTTP is sent by curl inside the isolated Docker network to Auth/PostgREST. No Kong, app cookie adapter or browser journey is exercised. |
| Shared local stack | Read-only diagnosis, logical dump and before/after checks. Original containers, configuration, counts, captured Property fingerprints, migration history and security catalog remain unchanged. | Postgres remains on the affected build; TOTP remains disabled. This stack has not gained a real MFA/anonymous HTTP pass. |
| Code only | 55 focused tests in three offer/admin-policy files, full typecheck, full lint with 12 existing warnings and zero errors, harness syntax and whitespace checks. | Existing guard tests use mocks; full suite/build/dependency audit and UI remain open. The earlier 134-test run remains separate dated evidence. |
| Staging / production | Not accessed. | No deployment, hosted credentials, parity or release claim. |

## Diagnosis and data-preserving approach

The shared runtime is Postgres `public.ecr.aws/supabase/postgres:17.6.1.111` (PostgreSQL 17.6, linux/amd64), Auth `v2.189.0` and PostgREST `v14.5`, with 70 application migration versions. Its Auth container has both `GOTRUE_MFA_TOTP_ENROLL_ENABLED=false` and `GOTRUE_MFA_TOTP_VERIFY_ENABLED=false`; repository `config.toml` has no TOTP enablement section. Those defaults are documented in [Supabase CLI configuration](https://supabase.com/docs/guides/local-development/cli/config#authmfatotpenroll_enabled). Enrollment, challenge and verification follow the [TOTP API flow](https://supabase.com/docs/guides/auth/auth-mfa/totp).

The earlier signal-11 failures are preserved in the intake record. They were not deliberately retriggered on the shared instance. The current resolution of [Postgres issue 2112](https://github.com/supabase/postgres/issues/2112) identifies the supautils 3.2.0/3.2.1 permission-denial defect and fix in 3.2.2. The [amd64 bisection evidence](https://github.com/supabase/postgres/issues/2112#issuecomment-5073847071) reports clean denial on `.113`, with no working hint-setting mitigation on `.111`.

Only the disposable clone uses Postgres `17.6.1.113`, pinned and asserted against digest `sha256:4c39816ce8d9303a3aba1161c842929c73a40c7109a9ef1b644582478e31832e`. Auth and PostgREST retain the shared versions. No shared volume is attached. A labelled new volume receives a logical database dump held in process memory, with required missing cluster roles/memberships restored only in the clone. The dump is never saved on the host. Replacing the new clone's bootstrap database is narrowly scoped to its generated container name; the shared database is only read.

Before fixtures, the restore matches all public-table, Auth-user and storage-object counts, seven Property table content fingerprints, 70 migration versions, relevant triggers and all three cron definitions. Intake function bodies and ACLs match the source database; function bodies also match migration `20260930164313_pinpoint_offer_intake.sql`. The four intake tables' grants, RLS flags and policies are compared before fixtures and after cleanup. The reserved-role and hint settings remain enabled with their original values. No function or table revoke is weakened.

The result is evidence for this patched clone. It is not an in-place upgrade rehearsal, a full backup/restore drill, or proof of staging/production parity. Any eventual shared-runtime correction needs its own preserved backup, pinned-image compatibility rehearsal and explicit configuration/rollback step.

## Containment and HTTP transport

Run explicitly with `$env:PINPOINT_B7_LOCAL='1'; node scripts/db/offer-review-b7.local.mjs`. The pinned image must already be downloaded. The harness reads only `.env.local`, accepts exactly `http://127.0.0.1:54321` and demo anon/service JWTs, and checks the diagnosed source image versions before creating resources.

All three clone containers have exactly one network attachment: their own labelled internal-only Docker network. There are no published ports, app servers, storage servers, delivery workers or external network attachments. Auth SMTP points to an unreachable destination; optional external delivery credentials are cleared. Accounts are created email-confirmed through the local Auth admin API; fixture email subscriptions are disabled.

Database cron execution is disabled from clone startup, before restore. All three copied schedules are additionally paused before fixture writes and their stored active flags restored after fixture cleanup while cron execution remains disabled. The shared schedules are never paused or changed.

An initial host-port readiness attempt failed because internal-only networking did not publish reachable ports on this Docker runtime. The final harness maps SDK requests from its guarded virtual loopback origin to curl requests inside the clone network, targeting only clone Auth or PostgREST. It preserves actual HTTP status/body responses, limits request duration and does not follow redirects. These are real Auth/Data API requests, not SQL permission probes or fabricated JWT/MFA claims. TOTP codes are computed from actual Auth enrollment secrets and submitted to actual challenges. Tokens and TOTP secrets are neither printed nor persisted in evidence.

## Observed access results

| Actor / state | HTTP / persisted observation |
| --- | --- |
| Anonymous | All four public intake RPCs (`enroll`, `write`, `review_read`, `reject`) return **401 / 42501**. Catalog checks retain denied anon EXECUTE. No signal-11 or recovery markers appear in clone database stdout/stderr. |
| Ordinary account | Review/reject return **403 / 42501**; no submitted revision rows are visible. |
| Admin / owner before MFA | Their real password sessions are `aal1`; review/reject return **403 / 42501**. |
| Admin, one actual verified TOTP, `aal2` | Review returns **200** and one submitted snapshot is readable. Private draft SELECT returns zero rows. |
| Owner, one actual verified TOTP, `aal2` | Review/reject return **403 / 42501** and submitted snapshot SELECT returns zero rows. |
| Owner, two actual verified TOTPs, `aal2` | Review returns **200**; one submitted snapshot is readable and private drafts stay inaccessible. |
| Fresh admin password session | Still `aal1` despite an enrolled factor; denied. An actual challenge/verification then supplies `aal2` and review returns **200**. |
| Revoked admin membership | The same unchanged `aal2` access token immediately loses review/reject and snapshot access. No refresh is used to establish the denial. |
| Suspended admin | Real `aal2` review/reject are denied and submitted snapshot SELECT is empty. Restoring the disposable account restores review. |
| Suspended poster | Poster save and reviewer rejection mutation are denied. An eligible reviewer can still inspect the immutable pending snapshot for investigation; this existing private-read behavior is recorded explicitly. |
| Eligible real-MFA admin rejection | The rejection persists with that reviewer UUID, database timestamp, reason and version 4; the pending pointer clears. No publication or prior-version restoration occurs. |

Four disposable `@pinpoint.invalid` accounts, one synthetic place, one offer and one revision are captured in [the source-hashed JSON evidence](pinpoint-offer-review-b7-local-evidence.json). The synthetic location tests the stored relation; it supplies no real South African place provenance, shop accuracy, media ownership or publishing permission.

## Cleanup and quality

Cleanup signs out captured clients, checks exact Auth UUID/email pairs and offer ownership, and deletes fixture history in dependency order. Only the clone's immutable-history and last-owner triggers are temporarily disabled inside one guarded transaction, then restored. Auth deletion uses captured account IDs. All public-table/Auth-user/storage counts, Property fingerprints, relevant triggers and stored cron definitions return to baseline. Intake bodies/ACLs and table security remain identical.

The labelled clone containers, volume and network are then removed. The downloaded patched image remains cached for repeatable rehearsal. Shared container IDs and configuration hashes, source security catalog, all public-table/Auth-user/storage counts, Property fingerprints and cron definitions match before/after. Core shared counts remain 75 Auth users/profiles, 300 listings, 2,104 images, 100 favorites/applications, 25 viewings, 40 conversations, 228 messages and zero notifications, places, offers or poster capabilities.

Setup failures are not passes: database-login, missing bootstrap-role, JSON-ordering and host-port readiness errors stopped before fixtures and removed any created clone resources. A passing rehearsal preceded the final explicit table-policy/grant parity checks; the final JSON is emitted only after the full final scenario and cleanup succeed. Prior intake JSON and simulated-MFA evidence remain intact.

Focused command: `npm.cmd test -- src/features/offers/lifecycle.test.ts src/features/offers/intake.test.ts src/features/admin/policy.test.ts` (**55/55, three files**). Full typecheck and lint pass; lint retains 12 existing warnings. Harness syntax/targeted lint, diff and new-file whitespace checks pass. Original lifecycle/adapter/migration hashes match the earlier evidence. No full build, full suite, new browser journey or dependency audit is claimed.

Next manageable build step: the poster draft/submission screen using the existing session adapters. Keep the private workflow separate from approval/publication, which still requires real place provenance, media ownership, publishing permission and public eligibility/action checks. Shared-runtime correction, cookie/browser MFA integration and staging access remain separate packets. B1 browser/staging and Steps 1.2–1.4 remain open.
