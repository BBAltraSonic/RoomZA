# Shopping Offer private intake verification — 30 September 2026

Owner: Build. Existing uncommitted RoomZA checkout; inspected once and preserved. Product confirmed that eligible signed-in accounts can become posters. [The reviewed intake contract](pinpoint-offer-intake-contract.md) defines eligibility, account ownership, immutable submissions and concurrency. No numbered acceptance item is newly closed.

| Environment | Verified result | Limit |
| --- | --- | --- |
| Local | Additive migration applied; signed-in poster API/RLS checks; SQL review/access checks; simultaneous version conflict; fixture history and guarded cleanup. | Positive review uses simulated aal2 claims and disposable verified-factor rows. Local Auth TOTP enrollment is disabled. Anonymous HTTP RPC denial crashes this local runtime; inherited-anon SQL permission checks pass. |
| Code only | 134 focused tests in 12 files, full typecheck and lint (12 existing warnings, zero errors); whitespace/diff checks. | Adapter guards are mocked in focused tests. Full suite/build/dependency audit and browser journeys were not run. |
| Staging | None. | Migration/access rehearsal needs isolated accounts, actual MFA and safe runtime/delivery controls. |
| Production | Not accessed. | No deployment, secrets or production parity claim. |

## Changes

Migration `20260930164313_pinpoint_offer_intake.sql` adds account-owned poster capability, private drafts with mutation versions, immutable submitted revisions and append-only transition events. Anonymous roles receive no new table/function grants. Authenticated table access is SELECT-only under owner/reviewer RLS. Service-role clients also have no direct new-table writes. Private definer functions perform controlled atomic mutations; public invoker wrappers use authenticated identity/session context. No approval function, approved pointer, public projection, offer route, browser screen or delivery schedule is added.

Eligibility is rechecked in the database from Auth email confirmation, permanent-account status, live session, ban/suspension state, profile and required policy reacceptance. Enrollment is independent of renter/landlord roles; revocation cannot be undone by reenrollment. Review checks current admin membership, eligibility, aal2 and the existing TOTP thresholds: one factor for admin, two for owner. A missing aal fails closed. Server-only adapters reuse `requireUser` / `requireAdmin` and the cookie client, without passing actor/capability flags or using a service client for mutations.

Offer mutations lock the row, recheck authorization after waiting and compare the expected version. A version conflict returns `PT409` / HTTP 409 so it is not retried as a transient server error. Submission freezes the stored draft, requires a new revision ID, validates content and resolves the stored place/point bounds. Retrying a still-pending revision does not duplicate the snapshot or event. A later private save cannot change its submitted content. Rejection appends actor/time/reason and clears the pending pointer. Withdrawal clears pending review; resubmission requires a fresh revision. All these operations remain private. Exact public expiry still exists only in the earlier lifecycle model.

## Local verification and containment

`scripts/db/offer-intake.local.test.ts` is opt-in: `$env:PINPOINT_OFFERS_LOCAL='1'; npm.cmd test -- scripts/db/offer-intake.local.test.ts`. It reads only `.env.local`, requires exactly `http://127.0.0.1:54321` and default demo anon/service JWTs, blocks fetches outside that origin, clears delivery credentials and pauses/restores all three database cron jobs. Admin-created disposable `@pinpoint.invalid` accounts are email-confirmed without outbound messages; fixture email subscriptions are disabled. No app server, queue, push, poster contact, real shop or actual geocoder request is involved.

The final passing scenario used four disposable Auth accounts, one synthetic place, one offer and three revisions. It produced one enrollment event per enrolled poster and nine offer transition events: create, save, submit, private save, reject, submit, withdraw, resubmit and one winning concurrent save. [The source-hashed evidence](pinpoint-offer-intake-local-evidence.json) captures identities, stored history and complete before/after counts.

Verified assertions:

- An ordinary signed-in account cannot create until explicit enrollment; reenrollment does not duplicate history. Poster B cannot read/change Poster A's offer, revisions or events. Anonymous table reads are denied.
- Direct authenticated INSERT/UPDATE/DELETE is denied on all four new tables. RLS is enabled; final stored function bodies match the migration source. Updates to revision content and deletion of audit events are also denied by immutable triggers under a privileged SQL connection.
- Incomplete content and injected unknown fields are rejected. Valid content persists; stale writes conflict. Retried submission preserves ID, content, version and history; later private edits remain isolated.
- Ordinary poster review and real aal1 admin review are denied. SQL with explicit simulated aal2 context tests current membership, one/two-factor thresholds and rejection provenance; revoking membership is effective without token refresh. Reviewer table reads do not expose private drafts.
- Withdrawal prevents a delayed review and reuse of its revision. A fresh resubmission is recorded. Two simultaneous authenticated saves at version 8 yield exactly one version-9 success and one HTTP 409 conflict, with one new event.
- Account suspension, poster revocation, unconfirmed email, anonymous-account status, Auth ban and deleted session deny the relevant reads/mutations. Reenrollment does not undo poster revocation. Fixture notification count stays zero.

Cleanup signs out clients, guards captured account UUIDs against exact fixture emails and checks offer ownership. Inside one administrator transaction it temporarily disables only the two new immutable-history triggers (and the last-owner trigger for the disposable admin membership), deletes the guarded fixture history in dependency order and restores those triggers. Auth account deletion then cascades its ordinary fixture profile/subscription rows. No application API has this cleanup power.

Every public-table count plus `auth.users` and `storage.objects` matches baseline afterward; schedules and relevant triggers are restored. Core counts remain 75 Auth users/profiles, 300 listings, 2,104 images, 100 favorites/applications, 25 viewings, 40 conversations, 228 messages, zero notifications and zero places/offers/poster capabilities. Local migration history now contains 70 versions. Counts and body comparison do not establish staging object parity or a restore drill.

## Runtime failures and remaining gates

Two early anonymous RPC attempts triggered a Postgres signal-11 crash and recovery. The logged operation was the call to the revoked enrollment function. The behavior matches [Supabase Postgres issue 2112](https://github.com/supabase/postgres/issues/2112), which reports crashes in the reserved-role permission-denied hook. A PL/pgSQL wrapper did not fix it. Interrupted cleanup was recovered using captured UUID/email guards; schedules and core counts were restored. Later failed test assertions also cleaned up; none is counted as a pass.

Permissions were not weakened. The final harness creates an inherited-anon probe role and grants it to the local verification connection **inside a rolled-back transaction** to test the same function revoke outside that hook. Anonymous HTTP RPC denial remains **blocked**, not passed. Attempts to override the hook per connection were rejected and did not alter configuration. Local TOTP enrollment returned `mfa_totp_enroll_not_enabled`; successful reviewer checks therefore use explicitly simulated SQL MFA context. A real MFA enrollment/challenge/session review journey remains open.

Local security advisors returned no warning/error findings after the final function corrections. Focused regression: 134/134 tests in 12 files; the opt-in local scenario separately passed 1/1. Full typecheck passed. Full lint passed with the same 12 warnings. `git diff --check` and new-file whitespace checks passed. The original lifecycle sources/tests and Property/B1 evidence are preserved.

Next manageable step: prepare a safe local or staging runtime for a real admin MFA review rehearsal and anonymous HTTP denial check, preserving the current data and grants. Then wire the first poster draft/submission screen to this intake contract. Approval/publication still needs real stored South African place provenance, media ownership/publishing permission, shop/address review and the public eligibility/action contract before it is exposed. B1 browser/staging checks and Steps 1.2–1.4 remain open.

## B7 continuation — real HTTP/MFA on a disposable clone

The original scenario, JSON and simulated-MFA limits above remain dated evidence. A separate [B7 verification record](pinpoint-offer-review-b7-verification.md) and [new JSON](pinpoint-offer-review-b7-local-evidence.json) now document 17 passing real Auth/PostgREST HTTP/MFA cases on a pinned patched local logical clone. Actual TOTP enrollment/challenge supplies the review sessions; no synthetic factor rows, edited JWT claims or inherited-anon SQL probes are used. Anonymous RPC denial retains the revokes, admin/owner factor thresholds pass, revoked membership and suspended accounts are denied, and an actual MFA rejection persists. Guarded cleanup restores baselines and removes the clone; all shared containers/configuration/counts/security/schedules are preserved.

The shared stack remains on affected Postgres `.111` with TOTP disabled. Cookie/browser review and staging remain unverified. The next manageable build step is the private poster draft/submission screen; approval/publication retains its separate place, media, permission and public eligibility gates. Release 1 stays at 2/48, with B1 and Steps 1.2–1.4 open.
