# All-work production release — 13 October 2026

Released to https://roomza.pinpoint-roomza.workers.dev. App version `47d27e5a-7c64-4f3a-921f-4adb2791c086`, deployment `755d1359-3ff4-400d-acc9-de69633fceaf`, serves 100% of traffic. The dedicated `roomza-notifications` Worker is version `a3018311-3049-4996-9f22-4178051ce1a6`, deployment `18d77eda-b23a-45fa-8140-6c10af3830b1`. Previous app version `357994a7-1219-4dc8-b025-0e6654ac3f5f` is retained for code rollback.

The release includes all pending application, discovery, account, branding/color, notification, migration, and supporting documentation work. The full source was copied into an isolated release snapshot, with source hashes checked before upload. Local caches, disposable snapshots, Python bytecode, scratch output, and credentials remain ignored and preserved locally. The new notification keypair and cron credential are stored in protected ignored files and deployed as secrets. The public VAPID key is retained in configuration and the production build inputs.

## Verification

- 1,706 application tests and five notification Worker tests passed across the full run and necessary corrected rerun. Five tests were skipped. One architecture conformance test remains failing with the same seven findings as the prior production release; the exact finding objects were compared successfully. The three initial snapshot/test failures were corrected: missing design/Cloudflare adapter files and a shell unit-test mock that needed to isolate the newly added notification provider.
- Application and Worker typechecks, scoped ESLint (zero errors, two generated-type warnings), production dependency audit (zero vulnerabilities), Next.js/OpenNext production build, both JavaScript budgets, minification, asset preparation, both Worker dry runs, and the current platform size check passed. Initial discovery JS is 290.7 KB compressed against its 300 KB budget.
- 53 live read-only route/API checks and 76 exact served-asset hashes passed, including the separately checked notification service worker. Delivered bundles contain notification and existing account/discovery markers.
- All eight previous app bindings and runtime/asset settings are preserved. The app adds its notification public key and cron secret. The notification Worker has four required secrets and its internal app service binding. Its every-minute schedule and disabled public/preview subdomains were verified through the Cloudflare API.
- The deployed sign-in appearance and guest discovery were inspected in the in-app browser. The live map loaded, the current empty results state rendered, and no browser console errors were observed. Screenshots are retained.

## Database and rollout state

Only `20261013034322_built_in_notification_system.sql` and `20261013034340_notification_delivery_and_events.sql` were pending. The linked dry run listed exactly those migrations, and the linked apply completed both. Earlier migrations were already applied and were not replayed.

Existing rows across 16 checked tables retain their fingerprints, accounting for the additive columns. All 242 prior notification subscription rows are unchanged. The migration adds 99 push category preferences; these do not grant device consent or enable delivery. Account/session, listing, saved-item, media, place-catalogue, message, and notification history are preserved. These checks establish preservation, not a database backup.

Inbox is enabled. Transactional event generation, reminders, and push remain disabled as specified by the prepared rollout. Existing cron schedules remain unchanged. Queue metrics show zero pending/failed push and zero active devices. Dispatcher RPCs are service-role-only, and browser roles cannot access the three transport tables. Security advisors increased from 68 to 77 individual findings: three intentionally service-only RLS tables without browser policies and six intentional authenticated, session/ownership-checked definer RPCs. No new anonymous definer access was added.

Real-account login/Google callback, authenticated inbox/Realtime, controlled two-account/device journeys, and actual delivery with the app closed remain unverified. Activating the new event producers, reminders, and push is a separate rollout step after those checks; no test messages were sent during this release.

The bounded log-tail attempt captured no scheduled invocation. The verified schedule and bindings do not establish a successful cron execution.

For code rollback, retain the additive database schema and history. Disable any subsequently activated notification switches before reverting code; do not delete notification history, preferences, or queues.

Evidence is retained alongside this README: release manifest, migration logs, database fingerprints/security comparison, tests/build/audit/package logs, deployed settings/triggers, HTTP/asset results, service-worker hash, and browser screenshots.
