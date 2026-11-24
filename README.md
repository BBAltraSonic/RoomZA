# RoomZA / Pinpoint

Map-first local discovery for South Africa: homes to rent or buy, local services, shopping specials, places, and events, with structured workflows from first search to move-in.

[Production](https://pinpoint.pinnpoint.workers.dev) | [Product brief](PRODUCT.md) | [Design system](DESIGN.md) | [System architecture](docs/roomza-system-architecture.md) | [Release gates](docs/operations/release-gates.md)

## Overview

RoomZA is the repository name; Pinpoint is the customer-facing brand. One account does everything: the same person can save listings, enquire, apply, and publish their own listings in any category. There is no consumer/lister mode switch.

The product is built around four principles:

- The map never disappears.
- Structured facts and clear costs beat long, noisy descriptions.
- Friction is added only where it improves trust or lead quality.
- State changes are visible: saved items, applications, viewings, offers, deposits, moderation, and privacy requests all show explicit progress.

## Product capabilities

### Discovery

- Five categories on one map: Property (rent and sale), Services, Shopping Specials, Places, and Events.
- MapLibre GL map on MapTiler base maps, themed to match light and dark mode, with an opening fly-in and a live "current area" location header.
- Viewport-based PostgreSQL queries with spatial indexing and text search, served by a dedicated discovery API Worker.
- Price, bedroom, bathroom, property type, listing type, and amenity filters, plus quick filters for fresh, furnished, favourite, and NSFAS-accredited rentals.
- Informative price pins, clustering, ranking, sorting, URL-persisted filters, and search recentering.
- Listing detail panels, image lightbox, sharing, freshness indicators, and lister trust signals.
- Neighbourhood routes, saved items, and empty-state lead capture.

### Pinpoint Assistant

A side panel on desktop and a bottom sheet on phones, opened from the dock. It answers with Pinpoint screens built from fixed templates rather than paragraphs of text.

- **Customer mode** turns a typed or spoken request into search filters, top picks, and comparisons, and remembers preferences across visits.
- **Business mode** shows listers what needs attention, who is interested, and how listings perform, and hands listing suggestions to the draft form.
- The AI only ever sees the words just typed or a listing's public details. It never reads messages, profiles, or documents, never summarises, and never drafts replies to customers.
- It runs on free open models through OpenRouter and falls back to rules-only behaviour when no key is set or the daily allowance is used up.

See the [assistant proposal](docs/pinpoint-ai-assistant-proposal.md) for the full set of decisions.

### Navigation and mobile layout

- One navigation for guests and members; a floating dock on desktop and a five-icon dock on mobile with an unread Messages badge.
- The mobile results surface is a two-position bottom sheet over the map:
  - `browse`, the lowest position, balances the map with a scrollable result feed and shows the result count, loading, and error recovery in its header.
  - `full` makes the sheet the primary surface and adds a backdrop.
- The sheet supports drag, velocity-aware fling, tap, and keyboard control; clamps to the viewport; separates vertical sheet gestures from horizontal carousel swipes; keeps its position across result refreshes; and lifts above the on-screen keyboard through `visualViewport`.
- Skeleton loading states and route-transition motion, all respecting reduced-motion preferences.

### Listing workspace

- One **My listings** page (`/post/listings`) for every category the person lists in, with per-category filters. Old `/dashboard` links redirect there.
- Property drafts with image uploads, location selection, amenity capture, and publish-readiness checks; separate workspaces for services, specials, places, and events.
- True monthly cost calculation (rent, levies, utilities, parking) and move-in cost breakdowns.
- Bulk listing imports from spreadsheets with field mapping, geocoding, image matching through a pinned-address image transport, review, and rollback.
- Organisations, where members share the organisation's listings and people.
- Listing analytics, applicant management, buyer pipeline, and an incoming showing-request inbox on every `/post` and `/dashboard` page.

### Applications, purchases, and deposits

- Every listing has two actions: Contact, then Apply now or Request a viewing.
- Structured rental applications with validation, optional supporting documents, and explicit states from submission through approval, rejection, or withdrawal.
- Renter journey board and progress timeline at `/journey`.
- Rental deposits held through Paystack: renters pay from the journey, confirm move-in or request a refund, and owners add payout details. Admins run a payments desk. Live keys are refused unless explicitly enabled.
- Buyer interest, seller contact, private seller notes, negotiations, purchase viewings, and a bond repayment calculator for sale listings.

### Messaging, viewings, and services

- Realtime conversations, read receipts, and presence through Supabase Realtime, plus a direct contact sheet.
- In-app video calls and live property tours.
- Landlord viewing hours that renters can book from the Contact sheet, with atomic slot booking.
- Service bookings for service listings.
- Transactional email through Resend, a notification outbox delivered by a dedicated notifications Worker, QStash jobs, digests, and saved-search alerts.

### Trust, safety, and privacy

- Public trust centre and versioned policy documents.
- Listing review, profile verification, NSFAS, and lister response-time signals.
- Member profile pages (`/u/...`) that show all of a person's work, with a profile view of what needs attention.
- Sign-in with email and password, Google, and passkeys; MFA; Turnstile on sensitive forms.
- POPIA-oriented export, correction, deletion, objection, and consent-withdrawal workflows.
- Reporting, moderation cases, sensitive-data reveal controls, and audit trails.
- Admin workspaces for users, listings, applications, viewings, payments, reports, verification, privacy, security, trust content, and transparency.

## Destinations

| Who | Where | What they do |
|---|---|---|
| Visitor | `/`, `/services`, `/offers` | Browse the map in every category and read trust information |
| Member | `/journey`, `/applications`, `/saved`, `/messages`, `/u/...` | Save, apply, register buyer interest, pay deposits, message, and book viewings or services |
| Member who lists | `/post/listings`, `/post/...` | Manage listings in any category, applicants, buyers, imports, showings, and analytics |
| Administrator | `/admin` | Run moderation, trust, privacy, payments, publishing, security, and account controls |

Onboarding asks what a person wants to do first (find a home, buy, list, or sell). That choice sets where they land; it does not limit what the account can do.

## Technology

| Layer | Technology |
|---|---|
| Web application | Next.js 16.4 (App Router, React Server Components), React 19.2, TypeScript 5 |
| UI | Tailwind CSS 4, Base UI, shadcn, CVA, Lucide, Motion |
| Maps | MapLibre GL JS via react-map-gl, MapTiler base maps and geocoding, Supercluster |
| Forms and validation | React Hook Form, Zod, Server Actions with typed results |
| Database platform | Supabase PostgreSQL, Auth, Storage, Realtime, and Edge Functions |
| Hosting | Cloudflare Workers through OpenNext and Wrangler |
| Async services | Upstash Redis, QStash, Resend |
| Payments | Paystack (rental deposits) |
| AI | OpenRouter (Pinpoint Assistant) |
| Protection and monitoring | Cloudflare Turnstile, structured logging, optional Sentry DSNs |
| Testing | Vitest, Testing Library, fast-check, PGlite, Playwright, Lighthouse CI, k6, SQL test plans |
| Infrastructure | Terraform |

## Repository structure

```text
RoomZA/
|-- src/
|   |-- app/                  # Routes, layouts, route handlers, and metadata
|   |   |-- (discovery)/      # Map discovery: property, services, specials
|   |   |-- admin/            # Administrative workspaces
|   |   |-- api/              # Discovery, assistant, payments, jobs, privacy, ...
|   |   |-- auth/             # Sign-in, recovery, verification, and MFA
|   |   |-- post/             # My listings and per-category listing workspaces
|   |   |-- dashboard/        # Property listing editor, applicants, buyers, imports
|   |   `-- ...               # Journey, messages, profile, trust, settings
|   |-- components/           # App shell, navigation and dock, UI primitives
|   |-- features/             # Domain modules, e.g.
|   |   |-- assistant/        # Pinpoint Assistant (customer and business modes)
|   |   |-- map-discovery/    # Map, ranking, filters, bottom sheet, and results
|   |   |-- marketplace/      # My listings across categories
|   |   |-- listings/         # Property listings, forms, search, and favourites
|   |   |-- listing-imports/  # Bulk spreadsheet imports
|   |   |-- offers/ entries/ services/   # Specials, places/events, services
|   |   |-- applications/ purchase/ payments/   # Rentals, sales, deposits
|   |   |-- chat/ viewings/ showings/ live-tours/
|   |   |-- notifications/ trust/ admin/ organizations/ profile/
|   |   `-- ...
|   `-- lib/                  # Auth, Supabase clients, env, logging, shared utils
|-- workers/
|   |-- discovery-api/        # roomza-discovery-api Worker (viewport queries)
|   |-- notifications/        # roomza-notifications Worker (outbox delivery)
|   `-- import-images/        # Pinned-address image transport for imports
|-- supabase/
|   |-- migrations/           # Ordered PostgreSQL schema and policy history
|   |-- tests/                # SQL test plans (RLS, trust, admin, payments, ...)
|   `-- config.toml           # Local Supabase configuration
|-- e2e/                      # Playwright user-flow and visual specs
|-- scripts/                  # CI, audit, performance, DB, admin, assistant, ops
|-- docs/                     # Architecture, proposals, runbooks, release evidence
|-- infra/terraform/          # Cloudflare/Vercel infrastructure definitions
|-- next.config.ts            # Next configuration and security headers
|-- open-next.config.ts       # OpenNext adapter configuration
`-- wrangler.jsonc            # pinpoint Worker and asset bindings
```

## Architecture notes

- Route files compose domain modules; business logic belongs in `src/features`.
- Server Components do initial reads where possible. Mutations go through validated Server Actions or route handlers.
- Browser and server Supabase clients are separated under `src/lib/supabase`.
- PostgreSQL RLS is the final authorisation boundary. UI checks are not treated as data security.
- Privileged operations use narrowly scoped, server-only service-role access and explicit policy checks.
- Map discovery coordinates request state, marker selection, result ordering, and sheet state without clearing useful results during refreshes.
- Notifications are written to an outbox before asynchronous delivery.
- OpenNext packages the app as the `pinpoint` Cloudflare Worker with a static asset binding; viewport discovery and notifications run in their own Workers.

## Design system

Pinpoint uses neutral surfaces and a restrained forest accent. Photography carries most of the visual weight; interface chrome stays quiet.

- A 4 px spacing rhythm with 8 px as the normal increment.
- Touch targets of at least 44 px.
- Forest for primary actions, selection, focus, and saved state.
- Hairline borders and restrained shadows instead of decorative effects.
- Feedback at 120 ms, standard transitions at 220 ms, large sheet transitions at 380 ms.
- Keyboard alternatives for gestures, visible focus, named dialogs, and reduced-motion support.

See [DESIGN.md](DESIGN.md) for tokens, motion, accessibility, and component guidance.

## Getting started

### Prerequisites

- Node.js 22 (see `.nvmrc`).
- npm. The lockfile is authoritative; use `npm ci` for reproducible installs.
- Docker Desktop and the Supabase CLI for the local database stack.
- A MapTiler browser API key restricted to your origins.

### Install and run

```bash
git clone <repository-url>
cd RoomZA
npm ci

# Windows PowerShell
Copy-Item .env.example .env.local

# macOS or Linux
cp .env.example .env.local

npm run dev
```

Open `http://localhost:3000`. `npm run dev` and `npm run build` first copy the MapLibre web worker into `public/`.

At minimum, set these in `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key>
NEXT_PUBLIC_MAPTILER_API_KEY=<origin-restricted-browser-key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`npx supabase start` prints the local URL and anon key.

### Environment variables

| Variable | Visibility | Needed for |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | Always |
| `NEXT_PUBLIC_APP_URL` | Browser + server | Always; defaults to the local URL |
| `NEXT_PUBLIC_MAPTILER_API_KEY` | Browser | Base maps, search, and geocoding |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Browser / server secret | Turnstile-protected forms |
| `SUPABASE_SERVICE_ROLE_KEY` | Server secret | Admin, notification, import, and other privileged work |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Server secret / config | Transactional email. Without a key nothing is sent, though the UI still reports success |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Server secret | Distributed rate limiting in production |
| `QSTASH_TOKEN` | Server secret | Publishing background jobs |
| `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` | Server secret | Verifying QStash requests |
| `CRON_SECRET` | Server secret | Digest and privacy-export job routes |
| `PAYSTACK_SECRET_KEY` | Server secret | Rental deposits and webhook verification. Empty keeps deposits off |
| `PAYSTACK_LIVE_PAYMENTS` | Server config | Must be `enabled` before a live key is accepted |
| `OPENROUTER_API_KEY` | Server secret | AI in the assistant. Empty runs it on rules only |
| `ASSISTANT_AI_MODELS` | Server config | Main model plus up to two fallbacks, comma-separated |
| `OPENROUTER_DATA_COLLECTION` | Server config | `deny` routes only to providers that do not store prompts |
| `LOG_LEVEL` | Server config | Optional: `debug`, `info`, `warn`, `error`, or `fatal` |
| `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` | Browser / server | Optional error monitoring |

See [docs/maptiler-style.md](docs/maptiler-style.md) for key restrictions, the required MapTiler style, and its acceptance check, and [docs/deposit-payments-proposal.md](docs/deposit-payments-proposal.md) for the Paystack go-live checklist.

Never commit `.env.local`, `.env.production.local`, service-role keys, signing keys, or API secrets. `NEXT_PUBLIC_*` values are exposed to browser bundles on purpose and must exist at build time for a Cloudflare build.

## Local Supabase

Start local services and rebuild the database from the migration history:

```bash
npx supabase start
npx supabase db reset --local --yes
```

Run a SQL test plan:

```bash
npx supabase db query --local --file supabase/tests/rls-test-plan.sql
```

`supabase/tests/` holds plans for RLS, admin operations, infrastructure hardening, public discovery, quick filters, trust and safety, lister trust metrics, profiles, instant connect, viewing hours, service bookings, deposit payments, bulk imports, notifications, and both assistant modes.

Add schema changes as new timestamped migrations. Never rewrite a migration that has been applied to a shared environment.

Linked-project checks:

```bash
npx supabase migration list
npx supabase db push --linked --dry-run
npx supabase db advisors --linked --type all --level warn --fail-on error
```

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Build with webpack and enforce the JavaScript budgets |
| `npm run start` | Serve an existing build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm test` | Run the Vitest suite once |
| `npm run test:ci` | Run Vitest with CI timeouts through the stage runner |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:coverage` | Generate Vitest coverage |
| `npm run test:e2e` | Run Playwright browser tests |
| `npm run test:e2e:ci` | Run Playwright through the stage runner |
| `npm run test:load` | Run the k6 listing API smoke test |
| `npm run test:notifications:db` | Verify notification database behaviour |
| `npm run budget:first-load-js` / `budget:initial-js` | Re-run a JavaScript budget check on an existing build |
| `npm run lighthouse` | Run the mobile Lighthouse CI audit |
| `npm run profile:frames` | Profile interaction frame budgets in a browser |
| `npm run audit:prod` | Audit production dependencies at moderate severity |
| `npm run assistant:eval` | Evaluate the assistant's AI search against its eval set |
| `npm run email:check` | Validate Resend configuration |
| `npm run db:generate-seed` | Generate local seed data |
| `npm run admin:bootstrap` | Bootstrap the owner admin from `.env.local` |
| `npm run admin:recover` | Recover owner access from `.env.local` |
| `npm run discovery:api:build` | Build the discovery API Worker bundle |
| `npm run notifications:worker:typecheck` | Type-check the notifications Worker |
| `npm run notifications:worker:check` | Dry-run build the notifications Worker |
| `npm run preview:cf` | Build and preview the OpenNext Worker locally |
| `npm run cf:check:size` | Check the generated Worker fits the 3 MiB free-plan gzip limit |
| `npm run deploy:cf` | Build, size-check, and deploy the discovery API and `pinpoint` Workers |
| `npm run cf-typegen` | Generate Cloudflare binding types |

## Testing

- Unit and integration tests for domain rules, Server Actions, APIs, auth, chat, notifications, listings, imports, purchases, payments, the assistant, trust, and viewings.
- Property-based tests for sheet mechanics, geospatial formatting, ranking, ordering, schemas, and edge cases.
- Testing Library render and interaction tests for client UI.
- Playwright for production flows, search, links, console errors, hydration, motion, and visual regressions.
- SQL test plans for RLS, privileged functions, admin operations, payments, trust, and infrastructure hardening.
- k6 load smoke tests for the listing API.
- Lighthouse and bundle budgets: 1,300 KB first-load client JavaScript per route, and 300 KB compressed initial JavaScript for `/`.

## Checks before merging

The repository has no GitHub Actions workflows, so nothing runs (or bills) on GitHub when you push. Run the checks locally before merging to `main`:

```bash
npm ci
npm run lint
npm run typecheck
npm run test:ci
npm run build
npm run test:e2e:ci
npm run audit:prod
npm run lighthouse    # optional: mobile Core Web Vitals
```

Database changes also need the local Supabase checks:

```bash
npx supabase start
npx supabase db reset --local --yes
for plan in rls-test-plan admin-operations-test-plan infra-hardening-test-plan instant-connect-phase1-test-plan; do
  docker exec -i supabase_db_roomza psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/$plan.sql
done
npx supabase stop
```

Add the plan for whatever area you changed (for example `deposit-payments-test-plan` or `service-bookings-test-plan`).

## Security model

- Row Level Security is enabled and hardened through migration-backed policies.
- Sensitive documents and conversations go through dedicated server routes and audited reveal flows.
- Admin access includes role checks, MFA, account controls, and audit events.
- Authentication includes rate limiting, Turnstile, email verification, password recovery, passkeys, and secure session cookies.
- Payments use server-only Paystack keys, verified webhooks, and a live-mode guard.
- The assistant never sends personal data to the AI provider.
- API responses use consistent failure shapes and request IDs.
- User-provided text is sanitised before rendering or logging.
- Production headers include CSP, HSTS, frame denial, MIME-sniffing protection, referrer policy, and a restricted permissions policy.
- Secrets stay server-only and are configured separately for each environment.

Review operational controls through the [POPIA controls](docs/operations/popia-controls.md), [environment strategy](docs/operations/environments.md), and [backup and restore runbook](docs/operations/backup-restore-runbook.md).

## Cloudflare deployment

Production runs as three Workers:

| Worker | Config | Deployed by |
|---|---|---|
| `pinpoint` (the app) | `wrangler.jsonc` | `npm run deploy:cf` |
| `roomza-discovery-api` | `workers/discovery-api/wrangler.jsonc` | `npm run deploy:cf` |
| `roomza-notifications` | `workers/notifications/wrangler.jsonc` | By hand |

The app is served at `https://pinpoint.pinnpoint.workers.dev`.

**Merging to `main` deploys automatically.** The `pinpoint` Worker is connected to this repository through Cloudflare Workers Builds (Worker → Settings → Build), which runs `npm run deploy:cf` on every push to `main`. Preview builds for other branches are off. Builds use Node 22 from `.nvmrc`. `NEXT_PUBLIC_*` values are set under **Build variables and secrets** because they are baked in at build time. Build status and logs are on the Worker's **Deployments** tab.

Deploy the notifications Worker by hand when it changes:

```bash
npx wrangler deploy --config workers/notifications/wrangler.jsonc --keep-vars
```

To release from your own machine instead:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run deploy:cf
```

`deploy:cf` builds with OpenNext, minifies the server bundle, prepares discovery assets, and runs `cf:check:size`, which stops the release if the gzipped Worker exceeds the Workers Free 3 MiB limit.

For a release with database changes, apply backward-compatible migrations before publishing code that depends on them:

```bash
npx supabase db push --linked --dry-run
npx supabase db push --linked --yes
npx supabase migration list

npm run deploy:cf
```

Set Worker secrets without putting them in `wrangler.jsonc`:

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put QSTASH_TOKEN
npx wrangler secret put CRON_SECRET
npx wrangler secret put PAYSTACK_SECRET_KEY
npx wrangler secret put OPENROUTER_API_KEY
```

Add every other server-only value the same way. `NEXT_PUBLIC_*` values must be present while OpenNext builds and, for server code that reads them, in the Worker's variables.

After deploying, check the home page and a static route:

```bash
curl -I https://pinpoint.pinnpoint.workers.dev/
curl -I https://pinpoint.pinnpoint.workers.dev/robots.txt
```

## Further documentation

- [System architecture](docs/roomza-system-architecture.md)
- [Release gates](docs/operations/release-gates.md)
- [Environment strategy](docs/operations/environments.md)
- [Backup and restore runbook](docs/operations/backup-restore-runbook.md)
- [POPIA controls](docs/operations/popia-controls.md)
- [Account recovery runbook](docs/recovery-runbook.md)
- [Pinpoint Assistant proposal](docs/pinpoint-ai-assistant-proposal.md)
- [Deposit payments proposal](docs/deposit-payments-proposal.md)
- [Import image transport](workers/import-images/README.md)
- [Browser user-flow report](docs/browser-user-flow-report.md)

## Development expectations

- Keep domain behaviour inside the relevant `src/features/<domain>` module.
- Validate external input with Zod and enforce authorisation again at the database boundary.
- Add or update tests with every behaviour change.
- Treat performance and accessibility budgets as product requirements.
- Add database changes as new migrations and update the relevant SQL test plan.
- Keep generated output, local logs, credentials, and machine-specific settings out of commits.
