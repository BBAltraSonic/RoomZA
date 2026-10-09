# B1 notification access correction — 30 September 2026

Owner: Build. Checkout: existing uncommitted RoomZA working tree. B1 is repaired and verified locally; its staging release gate remains open. No numbered backlog item is newly checked.

**2 October follow-up:** the [private notification inbox and disposable-clone browser record](pinpoint-b1-browser-verification.md) adds five passing real cookie/HTTP/browser/REST/SQL check groups, including phone/desktop recipient reload, persisted read state and tied-timestamp pagination. Guarded cleanup restores clone and shared baselines. It identifies a missing shared `read_at` column and tests the additive migration only in the clone. The environment table below describes the original 30 September run; shared runtime/schema correction and staging/delivery remain open.

| Environment | Evidence | Limit |
| --- | --- | --- |
| Local | Real call/showing actions, authorization RPCs, server outbox, SQL, fresh authenticated recipient clients, policy tests, migration history and guarded cleanup. | Reload means a fresh API/session read, not a browser UI reload. External delivery was suppressed. |
| Staging | None. | Needs URL, database access, isolated personas and delivery sinks for migration rehearsal, browser reload and delivery checks. |
| Production | Not accessed. | No deployment or parity claim. |
| Code only | 44 focused tests across 10 files; full lint, typecheck and diff checks. | Mocked tests are separate from the real local database run. |

## Change and writer inventory

`src/features/chat/call-actions.ts` and `src/features/showings/actions.ts` now call `recordAndEnqueueNotifications` after their signed-in authorization RPC succeeds. Recipient and target IDs still come from participant-visible stored rows. Incoming/declined/missed call and showing request/accept/decline payloads and idempotency keys retain their contracts. No Property URLs, navigation, favorites or rent/buy code changed in this run.

The writer scan also covered message, application and viewing actions (already using the outbox), live-tour audience writers (admin clients following authorized tour actions), moderation writers (admin clients), delivery-failure alerts (admin client), and document-expiry reminders (database function with client EXECUTE revoked). Live tours, jobs and admin writers were inspected, not rewritten or exercised as complete customer journeys here.

`supabase/migrations/20260930142632_notification_server_writes_only.sql` removes the permissive client INSERT policy and revokes INSERT from PUBLIC, anon and authenticated. A restrictive INSERT policy rejects client inserts even if a future grant is accidentally restored. Recipient read/update/delete policies, the account-activity restriction and service-role writes remain. There are no row updates/deletes or table rebuilds. Local history includes this migration; staging/production application is unverified. This follows [Supabase's grants and RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Correction and rollback boundary

Keep the tightened policy and corrected server outbox together when preparing an application rollback. Rolling back only to the old user-scoped call/showing writers would lose their notifications. Prefer a forward server-only correction, preserving all events and retry state; do not restore the broad authenticated INSERT grant as a workaround. No rollback, reset or deployment was performed here. Use the existing backup/restore runbook for any separately authorized environment correction.

## Verification and containment

The migration passed a transaction rehearsal that rolled back, then was applied using `migration up --local`. `supabase/tests/notification-server-writes.sql` passed on the resulting schema, rolling back its users, event, trigger effects and temporary grant. It proves server INSERT, recipient read/update, unrelated/anonymous read isolation, self/cross-recipient client INSERT denial and restrictive-policy denial independently of the revoked grant. Local security advisors returned “No issues found” at warning/error level.

`scripts/db/notification-b1.local.test.ts` is opt-in. It uses actual actions/outbox against `127.0.0.1:54321`, accepts only the default local service JWT from `.env.local`, rejects hosted credentials and blocks non-local fetches. Email/QStash use failure stubs, external credentials are cleared, fixture email subscriptions are disabled and no push path is invoked. Three cron jobs are paused through `cron.alter_job` before fixtures and restored afterward. No app server, production environment file or poster account is used.

Three disposable accounts, one rental and one conversation produced **8 persisted events**: incoming/declined calls, incoming/missed calls, two showing requests, acceptance and decline. SQL confirmed recipients, payloads and IDs. Fresh signed-in clients saw exactly their own events; an unrelated account saw none. Unauthorized actions, own-listing requests, duplicate live requests and direct cross-recipient inserts produced no extra event. Retried terminal actions produced no duplicate.

Synthetic queue failures left events persisted. Two synthetic email failures increased one event's attempt count to 2, recorded future retry times and cleared its lock without marking it sent. Re-inserting its idempotency key left the original event and retry state unchanged. Real delivery and recovery through an external scheduler were not tested. Persistence errors remain non-fatal to originating actions; action and notification writes are not one atomic transaction.

All eight events had null `sent_at` and `digest_at` before cleanup. Cleanup signs out fixture sessions; deletes captured call/showing/message/conversation records before the guarded listing; checks account emails before deletion; and compares **every public-table count plus auth.users** with baseline. All counts and three cron states were restored. Core before/after counts: 75 profiles/auth users, 300 listings, 2,104 images, 100 favorites/applications, 25 viewings, 40 conversations, 228 messages, zero calls/showings/notifications. The [JSON evidence](pinpoint-b1-local-evidence.json) contains source hashes, fixture IDs, stored events and full counts.

Harness corrections: initial setup stopped on cron-table write permissions and mandatory in-app subscription constraints; subsequent runs used the supported cron function and email-only isolation. One passing action run initially failed cleanup because a conversation referenced its listing. Captured identity guards were used for recovery, all baseline counts were restored, and the corrected complete run passed. Failed cleanup runs are not counted as passes.

Quality: **44/44** focused tests, **1/1** real local scenario, SQL policy checks, full typecheck and `git diff --check` passed. Full lint passed with the same **12 existing warnings, zero errors**. Earlier `workerPath` type errors are absent in this checkout. Full build, entire test suite and dependency audit were not run for this focused change.

## Next action

Rehearse B1 in staging with isolated accounts and delivery sinks, including browser notification reload and allowed server/denied client writes. Until those prerequisites exist, the next independent local work is private storage and organization-access fixture verification. Steps 1.2–1.4 remain open for stored-place/live geocoder and staging rental evidence, a controlled sale journey, private storage/organization access, parity and restore evidence. Do not repeat the completed rental audit.
