# B1 recipient notification inbox — 2 October 2026

Owner: Build. Checkout: preserved existing uncommitted RoomZA working tree. This extends the [original B1 local record](pinpoint-b1-local-verification.md). B1's complete release gate remains open; no numbered acceptance item is newly closed.

## Change and prerequisite

The profile notification card now opens `/profile/notifications`. The private server-rendered inbox displays minimal recipient updates, safe links to known Property conversations/listings or admin cases, SAST timestamps, unread/read status and an explicit mark-as-read action. Session identity determines the recipient. Raw payload metadata and arbitrary payload URLs are excluded from the screen. Anonymous visitors must sign in; invalid cursors and database failures have distinct states instead of appearing as an empty inbox.

Pagination orders by timestamp and ID and uses both values for the inbox cursor, preserving events whose timestamps tie. The existing notification API's timestamp-only cursor remains compatible; its recipient still comes from authentication. Mark-as-read uses the user-scoped client and recipient ownership predicate, changes only `read_at`, preserves an already-read timestamp on retry and refreshes the inbox/profile.

Read-only inspection found that the shared local `notification_events` table lacks `read_at`, although existing profile counts and the notification API already query that column. `20261002120900_notification_read_state.sql` adds the nullable timestamp without changing existing events, delivery state, grants or RLS. Generated TypeScript contracts include it. **The migration is applied only to the disposable verification clone; the shared schema is unchanged.** Shared rollout remains a prerequisite for this screen to work there.

## Verification boundary

The opt-in parent harness is `scripts/db/notification-b1-browser.local.mjs`, with a guarded temporary task selected through `PINPOINT_CLONE_TASK_PATH`. It restores a disposable Postgres `17.6.1.113` clone on an internal-only Docker network, compares source counts/catalogue/security/Property fingerprints before changes, disables copied schedules and applies only the read-state migration. The app uses a loopback Auth/REST gateway and demo credentials. External email, QStash, push, maps, LiveKit and telemetry credentials are cleared; browser and server fetch guards reject outside destinations. Fixture accounts, rental, conversation and event IDs are captured and checked before cleanup.

The first attempt stopped before producer actions: an existing message-route warm-up request exceeded Playwright's default 30-second API request timeout. [That failed evidence](pinpoint-b1-browser-warmup-failure-evidence.json) is retained separately. It produced no notification events, removed fixtures and clone resources, recorded no database crash markers and preserved shared baselines. A sequential retry allows up to 120 seconds for route compilation. An earlier offer-report clone restore segmentation fault remains a separate unresolved finding; this timeout does not establish its cause or fix.

A second [failed attempt](pinpoint-b1-browser-pagination-failure-evidence.json) passed producer persistence, phone/desktop recipient reload and client-write/read-state checks, then stopped during pagination. Its browser diagnostics recorded no errors or outside requests. Cleanup removed the captured accounts/events/Property records but the clone count check detected two listing-view analytics rows left by route warm-up. The clone, volume and network were still removed; shared counts, fingerprints, security and configuration matched. The temporary task now captures and deletes only analytics IDs matching the disposable listing, and the driver waits for the pagination destination and expected rendered item count before comparing content. This failure is not counted as a complete browser pass.

The third [failed attempt](pinpoint-b1-browser-invalid-query-failure-evidence.json) passed the producer, recipient and read-state checks, then confirmed 30/9 pagination counts and all 35 unique equal-time fixtures before its invalid-query assertion failed. Guarded cleanup, including both captured analytics IDs, restored every clone baseline and preserved the shared stack. A [focused browser diagnostic](pinpoint-b1-browser-query-diagnostic-evidence.json) then passed caller-recipient, malformed-date and incomplete-cursor cases: each rendered the correct invalid-link message and no notification list. It found two alert elements, the application alert and Next's route announcer. The driver now targets the application's alert by its text; no shipping component change was needed.

## Completed clone browser run

The corrected [complete browser run](pinpoint-b1-browser-local-evidence.json) passes all five check groups with actual Auth, cookie-authenticated Server Action HTTP, REST, SQL and headed Chromium:

| Check | Observed result |
| --- | --- |
| Authorized producers and retries | Calls and showings create exactly eight persisted events. Unrelated actions, own-listing requests and duplicate live transitions create none; terminal retries create no duplicate. Producer controls are not clicked: these are real cookie Server Action POSTs. |
| Recipient reload | Desktop and 390×844 phone reload show exactly the account's stored updates; unrelated accounts see an empty inbox. Forging an API recipient filter still returns only the session recipient. The phone screenshot was visually inspected and the viewport overflow check passes. |
| Client-write denial and read state | All three real authenticated tokens receive 403/42501 for self/cross-recipient INSERT. Forged other-recipient mark-read fails without changing its timestamp. The native own-row read button persists one read timestamp through reload, leaving the event count and delivery fields unchanged. |
| Stable paging and invalid input | Thirty-five SQL-created paging fixtures share one timestamp. The recipient's 39 rows render as 30 then nine; every paging fixture appears once. Invalid caller-recipient queries show the intended alert without a list. These supplemental fixtures are pagination evidence, separate from the eight producer events. |
| Anonymous access | The private inbox requires sign-in and the notification API returns 401. |

The run records no browser errors, outside browser requests or database crash markers. Cleanup removes all three captured accounts, all 43 captured notifications, both captured listing-view analytics rows and the captured call/showing/conversation/listing records. Every clone table/Auth/storage count and Property fingerprint matches its post-migration baseline. Label-checked clone containers, volume, network and gateway are removed; shared counts, fingerprints, schedules, configuration, original functions and table security match before/after. Neither the failed runs nor the successful clone establishes a shared-runtime or staging pass.

## Code checks

The three inbox test files pass 18 tests covering safe projection/links, malformed payloads, authentication, recipient-filter rejection, unavailable states, tied cursors, read ownership, immutable retry timestamps and safe database errors. The complete default suite passes **1,149 tests across 218 files**, with two opt-in tests/files skipped. Full typecheck and targeted lint pass.

The React checklist confirms server-side reads and minimal display data, a small client boundary for the read button, pending-state handling, semantic list/time/link controls and escaped text rendering. No raw HTML or caller-selected redirect is rendered.

The first clean release attempt was interrupted during dependency downloads, with no install/build/audit completion recorded. The terminal task was lost and Docker was stopped. The installed engine was started; only the stopped, label-matched clone and marker-verified temporary snapshot were removed. [Recovery evidence](pinpoint-release-cli-inbox-interruption-evidence.json) confirms shared counts/Property fingerprints, security and catalogue match the passing browser baseline, with shared configuration and container identities preserved through cleanup. This is recovery evidence, not a build pass. Verified inbox source hashes still match.

The subsequent [fresh release checkpoint](pinpoint-release-cli-inbox-evidence.json) passes clean installation, production build including `/profile/notifications`, both JavaScript budgets and the production-only dependency audit (zero vulnerabilities). The first-load ceiling passes across 82 routes; compressed root JavaScript remains 248.6 KB against 300 KB. The full install audit separately reports 34 issues (four low, seven moderate, 23 high), including development dependencies. Existing middleware/Edge-runtime/cache warnings remain. No package or lockfile upgrade was made.

All ten additive migrations are restricted to the release clone. Guarded cleanup removes snapshot/dependencies/cache, labelled clone containers, volume, network and gateway. Source hashes, clone baseline and shared counts/Property fingerprints, schedules, configuration, functions and table security match. No database crash markers were recorded. This CLI result is separate from the actual browser evidence and does not apply the read-state column to the shared stack.

## Remaining gates

Shared runtime/schema correction, staging migration and recipient browser replication, real safe delivery and scheduler recovery, Property Steps 1.2–1.4, and the complete Release 1 acceptance requirements remain open. Producer controls, other notification families, staging, production, real supply and external delivery are outside this contained check. Launch, outreach and pilot execution need separate authorization.
