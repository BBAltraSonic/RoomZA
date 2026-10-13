# Built-in notifications, 13 October 2026

## Implementation

The existing event history and email transport remain in place. New database producers record domain changes and notifications in the same transaction. The inbox has a live unread badge, a desktop panel, a mobile sheet, filters, read/archive controls, and an authenticated history page.

Push is an independent delivery ledger per device. Subscriptions require explicit permission and an active account session. Device keys stay server-side. A shared device can be rebound after the new signed-in user demonstrates possession of its subscription keys; old-account deliveries fail recipient checks. The service worker clears old-account notifications when identity changes and caches no app pages.

Automatic reminders use versioned source references. Reconciliation cancels changed schedules and checks completion, cancellation, reply, expiry, saved state, account restrictions, and preferences before dispatch. Missed reminder windows expire rather than replaying after downtime.

## Coverage matrix

| Source | Recipient | Category / destination | Producer |
| --- | --- | --- | --- |
| Messages and call sessions | Other conversation participant | Messages / conversation | Transactional source trigger |
| Profile contact requests | Recipient | Messages / sender profile or notification history | Source trigger; full request text and handled action |
| Applications | Listing owner; applicant for confirmation and decisions | Applications / listing or applications | Source trigger |
| Purchase interest | Seller; buyer for decisions | Listings and saved items / listing | Source trigger |
| Viewing proposals and bookings | Applicant/buyer and listing owner | Viewings and tours / listing | Source trigger; slot reschedule reconciliation |
| Live tours | Host, saved-home users, matching registered search subscribers | Viewings and tours / listing | Source trigger |
| Property publication | Listing owner | Listings and saved items / listing | Status transition trigger |
| Services, Shopping, Places, Events | Poster | Listings and saved items / private listing workspace | Submission/review/decision event triggers |
| Publishing permission changes | Poster | Account / My listings | Poster permission trigger |
| Reviews and report decisions | Review subject/author or reporter | Reviews or account / private profile pages | Meaningful status transition trigger |
| Security and verification | Account owner or listing owner | Security or verification / settings | Security/verification event trigger |
| Organization invitations and membership | Registered invitee, inviter on acceptance, or member | Account / organization | Source trigger; transaction-specific change keys |
| Saved homes and Specials | Saving user | Listings and saved items / relevant details | Meaningful price, availability, status, or date changes |
| Saved searches | Registered matching subscriber | Saved searches / listing | Newly published or newly matching listing updates |
| Document expiry | Document owner | Verification / documents | Existing daily cron, with expiry-specific deduplication |

Views, saves by other people, routine edits, and marketing do not produce alerts. External contact links do not imply completed calls or messages. Call transcripts are marked and validated so a missed call does not also produce a duplicate message notification.

## Reminders

- Viewings: 24 hours and one hour before; tours: 15 minutes before.
- Saved Events: 24 hours before; other saved Specials: one day before expiry.
- Unanswered contacts, proposals, applications, and purchase interest: one follow-up after 24 hours.
- Documents retain 30-, seven-, one-, and zero-day reminders. Renewed expiry dates have separate keys.
- Scheduled jobs are created only for future due times and have a five-minute dispatch window.
- Read conversations synchronize associated notification read state. Handling a contact request stops its follow-up.
- Quiet hours apply to device push in the selected timezone. Inbox updates remain available.

## Interfaces and security

Authenticated endpoints:
- `GET/PATCH /api/notifications`: paired timestamp/UUID cursor, All/Unread and category filters, unread count, safe display DTOs, read/archive/mark-all-read.
- `GET/PATCH /api/notifications/settings`: previews, quiet hours, timezone, channel preferences, and push availability.
- `GET/POST/DELETE /api/notifications/devices`: safe device metadata, consented registration, and owner-scoped removal.
- `PATCH /api/notifications/contact`: recipient-only handling.

Mutations require same-origin requests. Identity comes from the cookie session and the existing active-session predicate. RLS also protects direct Data API and Realtime reads. Browsers cannot create notifications or change recipients, payloads, or delivery state. Browser roles cannot invoke dispatcher, lease, retry, or metric RPCs.

Only known app destinations and approved HTTPS push service origins are accepted. Source validity and preview preferences are checked again immediately before sending. Push failures, expired subscriptions, and leases have independent state; retries are bounded and stale worker results cannot overwrite a newer lease.

## Verified results

- 223 notification, navigation, and chat tests; five Worker tests.
- 72 disposable PostgreSQL checks against the actual notification migrations.
- 11 local browser checks at 1440, 390, and 320px with synthetic API responses; screenshots inspected.
- Application and Worker typechecks and scoped lint pass.
- Isolated production build and both JavaScript budgets pass; initial client JS is 291.9 KB compressed against a 300 KB budget.
- Worker dry run: 147.67 KiB, 27.17 KiB gzip. Production dependency audit: zero vulnerabilities.
- The working-tree rebuild hit a Webpack hash/cache error; the independent source snapshot compiled and passed all build gates.

## Local verification

Reproducible checks:
```powershell
npm run test:notifications:db
npx vitest run src/features/notifications src/components/navigation src/features/chat/call-actions.test.ts src/features/chat/call-state.test.ts
npx vitest run --config vitest.notifications-worker.config.ts
npm run typecheck
npm run notifications:worker:typecheck
npm run notifications:worker:check
npm run build
```

The PostgreSQL rehearsal uses disposable data and deployed column/enum contracts, with test authentication and public-offer foundations. It exercises the actual notification migrations, triggers, RLS, ownership, rollback, deduplication, reminders, source cancellation, device rebinding, and leases. It does not replace validation against a full Supabase clone.

Local browser checks use the actual notification components and application styles with synthetic API responses. Screenshots and results are under `.cache/notifications-browser/`. These prove local layout and interactions, not deployed account journeys or real device delivery.

## Controlled rollout

Prepared migrations:
1. `20261013034322_built_in_notification_system.sql`, commit enum additions.
2. `20261013034340_notification_delivery_and_events.sql`, apply storage, producers, policies, and dispatcher RPCs.

Do not push unrelated pending migrations from this dirty workspace. Package these two migrations in a scoped release and reconcile them with current remote migration history. Preserve existing rows, email configuration, cron schedules, and bindings.

Initial switches: inbox on; transactional producers, reminders, and push off. This preserves the legacy producers until controlled validation is complete.

Deploy the app and the dedicated `roomza-notifications` Worker from an isolated verified release. The Worker has no public HTTP route and uses an internal `APP` service binding. Keep existing variables/bindings when deploying. Confirm the target account and Worker before any remote command.

Provision:
- Worker secrets: `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, and the app's existing `CRON_SECRET`.
- App build variable: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, matching the Worker key.
- The Worker cron runs every minute. Inspect capacity and subrequest limits before broad rollout; its batches and concurrency are bounded.
- Generate the VAPID keypair into protected secret storage, never source control or command arguments.

Inspect controls without writing:
```powershell
node --env-file=.env.local scripts/ops/notification-queue.mjs status
```

After validation, enable each switch separately. Hosted writes require explicit `--remote`:
```powershell
node --env-file=.env.local scripts/ops/notification-queue.mjs enable events --remote
node --env-file=.env.local scripts/ops/notification-queue.mjs enable reminders --remote
node --env-file=.env.local scripts/ops/notification-queue.mjs enable push --remote
```

Before broad activation, validate controlled users against the hosted schema: authenticated inbox/Realtime, two accounts and devices, callback/session behavior, actual push with the app closed, revoked sessions, quiet hours, and timer/source changes. Disable email for disposable accounts to avoid unintended mail.

Metrics expose pending/failed push, oldest queue age, reminder lag, and active devices without message content or credentials. An operator can retry a failed delivery using `retry <delivery UUID> --remote`.

Rollback: disable push, reminders, then transactional producers. Legacy producers resume when event generation is off. Retain the additive schema and history; do not delete queues or replay historical activity. Preserve the prior app and Worker versions as rollback targets.

## Current boundary

Production migration, app deployment, notification Worker deployment, VAPID provisioning, and read-only hosted checks completed on 13 October 2026. Inbox is enabled; transactional producers, reminders, and push retain their disabled rollout defaults. Full hosted account journeys and real device delivery remain verification steps. See [the production release record](all-work-deploy-20261013/README.md).
