# RoomZA / Pinpoint

Map-first property discovery and structured rental and purchase workflows for the South African market.

[Production](https://roomza.pinpoint-roomza.workers.dev) | [Product brief](PRODUCT.md) | [Design system](DESIGN.md) | [System architecture](docs/roomza-system-architecture.md) | [Release gates](docs/operations/release-gates.md)

## Overview

RoomZA is the repository name; Pinpoint is the customer-facing product brand. The application keeps location and property context central while helping renters, buyers, landlords, sellers, and administrators move through structured workflows.

The product is designed around four principles:

- Keep the map useful throughout discovery.
- Prefer structured facts and clear costs over long, noisy descriptions.
- Add friction only where it improves trust or lead quality.
- Make state changes visible: saved homes, applications, viewings, buyer interest, moderation, and privacy requests all have explicit progress.

## Product capabilities

### Discovery

- Rental and for-sale modes on a responsive Google Map.
- Viewport-based PostgreSQL queries with spatial indexing and text search.
- Price, bedroom, bathroom, property type, listing type, and amenity filters.
- Quick filters for fresh, furnished, favourite, and NSFAS-accredited rental listings.
- Map markers, clustering, result ranking, sorting, URL-persisted filters, and search recentering.
- Listing detail panels, image lightbox, sharing, freshness indicators, and landlord trust signals.
- Neighbourhood routes, saved homes, empty-state lead capture, and published rental guides.

### Mobile discovery sheet

The mobile results surface is a three-position bottom sheet layered over the map:

- `peek` keeps the map dominant and exposes the current result context.
- `browse` balances the map with a scrollable result feed.
- `full` turns the sheet into the primary browsing surface and adds a backdrop.

Users can drag the handle, fling with velocity-aware snapping, tap the handle, or use the keyboard. Sheet motion is clamped to valid viewport bounds, distinguishes vertical sheet gestures from horizontal carousel gestures, preserves the active position during result refreshes, and lifts above the on-screen keyboard through `visualViewport`. Reduced-motion preferences are respected.

### Listing and landlord workspace

- Contextual onboarding and a quick-draft path for new listings.
- Create, edit, publish, unpublish, and organise listings.
- Image uploads, location selection, amenity capture, and publish readiness checks.
- Rent and sale listing support.
- True monthly cost calculation for rent, levies, utilities, and parking.
- Listing analytics, applicant management, buyer pipeline, and viewing management.

### Applications and purchases

- Structured rental applications with validation and optional supporting documents.
- Explicit rental states from submission through review, approval, rejection, or withdrawal.
- Renter journey board and progress timeline.
- Buyer interest creation, seller contact, private seller notes, negotiations, and accepted/rejected states.
- Purchase viewing requests and a buyer-facing progress journey.
- Bond repayment calculator for sale listings.

### Messaging, viewings, and notifications

- Realtime conversations, read receipts, and message threads through Supabase Realtime.
- In-app Jitsi video calls and live property viewings.
- Viewing proposals, atomic slot booking, validation, and role-based access.
- Transactional email through Resend.
- Reliable notification delivery with an outbox, QStash jobs, and digest routes.
- Saved search alerts.

### Trust, safety, privacy, and publishing

- Public trust centre and versioned policy documents.
- Listing-review, profile-verification, NSFAS, and landlord response-time signals.
- User notification, security, MFA, consent, and privacy-request settings.
- POPIA-oriented export, correction, deletion, objection, and consent-withdrawal workflows.
- Reporting, moderation cases, sensitive-data reveal controls, and audit trails.
- Admin workspaces for users, listings, applications, viewings, reports, verification, privacy, security, trust content, transparency, and blog publishing.

## Roles and destinations

| Actor | Primary destination | Main capabilities |
|---|---|---|
| Visitor | `/` | Search the map, inspect public listings, view trust information, and read the blog |
| Renter / buyer | `/`, `/journey`, `/applications` | Save homes, apply, register buyer interest, message, and book viewings |
| Landlord / seller | `/dashboard` | Manage listings, applicants, buyers, messages, analytics, and viewings |
| Administrator | `/admin` | Operate moderation, trust, privacy, publishing, security, and account controls |

Account onboarding currently stores the base role as `renter` or `landlord`; purchase behaviour is expressed through the listing type and buyer/seller workflows rather than separate account roles.

## Technology

| Layer | Technology |
|---|---|
| Web application | Next.js 16.2, React 19.2, TypeScript 5, App Router, React Server Components |
| UI | Tailwind CSS 4, Base UI, shadcn, CVA, Lucide, Motion |
| Maps | Google Maps through `@vis.gl/react-google-maps` and MarkerClusterer |
| Validation | Zod, Server Actions, typed action results |
| Database platform | Supabase PostgreSQL, Auth, Storage, and Realtime |
| Edge hosting | Cloudflare Workers through OpenNext and Wrangler |
| Async services | Upstash Redis, QStash, Resend |
| Protection and monitoring | Cloudflare Turnstile, structured logging, optional Sentry DSNs |
| Testing | Vitest, Testing Library, fast-check, Playwright, Lighthouse CI, k6, SQL test plans |
| Infrastructure | Terraform and GitHub Actions |

## Repository structure

```text
RoomZA/
|-- src/
|   |-- app/                  # Routes, layouts, route handlers, and metadata
|   |   |-- admin/            # Administrative workspaces
|   |   |-- api/              # Listings, alerts, jobs, documents, privacy
|   |   |-- auth/             # Sign-in, recovery, verification, and MFA
|   |   |-- dashboard/        # Landlord and seller workspace
|   |   `-- ...               # Discovery, listing, blog, trust, settings
|   |-- components/           # Shared navigation, premium, and UI primitives
|   |-- features/             # Domain-oriented application modules
|   |   |-- admin/            # Policy, moderation, audit, and admin actions
|   |   |-- applications/     # Rental application lifecycle
|   |   |-- auth/             # Authentication and session behaviour
|   |   |-- blog/             # Publishing and Markdown rendering
|   |   |-- chat/             # Messaging and video-call state
|   |   |-- listings/         # Listing domain, forms, search, and favourites
|   |   |-- map-discovery/    # Map, ranking, filters, bottom sheet, and results
|   |   |-- notifications/    # Outbox, preference policy, jobs, and email
|   |   |-- purchase/         # Buyer interest and seller pipeline
|   |   |-- trust/            # Trust centre, privacy, MFA, and transparency
|   |   `-- viewings/         # Scheduling and live viewings
|   `-- lib/                  # Auth, Supabase clients, env, logging, shared utils
|-- supabase/
|   |-- migrations/           # Ordered PostgreSQL schema and policy history
|   |-- tests/                # RLS, trust, admin, and infrastructure SQL plans
|   `-- config.toml           # Local Supabase configuration
|-- e2e/                      # Playwright user-flow and regression specs
|-- scripts/                  # CI, audit, performance, DB, admin, and ops tools
|-- docs/                     # Architecture, product plans, runbooks, and audits
|-- infra/terraform/          # Cloudflare/Vercel infrastructure definitions
|-- next.config.ts            # Next configuration and security headers
|-- open-next.config.ts       # OpenNext adapter configuration
`-- wrangler.jsonc            # Cloudflare Worker and asset bindings
```

## Architecture notes

- Route files compose domain modules; business logic belongs in `src/features`.
- Server Components perform initial reads where possible. Mutations use validated Server Actions or route handlers.
- Browser and server Supabase clients are separated under `src/lib/supabase`.
- PostgreSQL RLS remains the final authorisation boundary. UI checks are not treated as data security.
- Privileged operations use narrowly scoped server-only service-role access and explicit policy checks.
- Map discovery keeps request state, marker selection, result ordering, and sheet state coordinated without clearing useful results during refreshes.
- Notifications are persisted to an outbox before asynchronous delivery.
- The OpenNext adapter packages the Next.js application as a Cloudflare Worker with a static asset binding.

## Design system

Pinpoint uses neutral application surfaces and a restrained forest accent. Property photography carries most of the visual weight; interface chrome remains quiet and functional.

Key rules include:

- A 4 px spacing rhythm with 8 px as the normal increment.
- At least 44 px touch targets.
- Forest for primary actions, selection, focus, and saved state.
- Hairline borders and restrained shadows instead of decorative effects.
- Fast feedback at 120 ms, standard transitions at 220 ms, and large sheet transitions at 380 ms.
- Keyboard alternatives for gestures, visible focus, named dialogs, and reduced-motion support.

See [DESIGN.md](DESIGN.md) for the complete token, motion, accessibility, and component guidance.

## Getting started

### Prerequisites

- Node.js 22 or newer.
- npm (the lockfile is authoritative; use `npm ci` for reproducible installs).
- Docker Desktop and Supabase CLI for the full local database stack.
- A Google Maps browser API key for interactive map rendering.

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

Open `http://localhost:3000`.

At minimum, populate these values in `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key>
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<browser-key>
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=<cloud-map-id>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

The Supabase CLI prints the local URL and anon key after `supabase start`.

### Environment variables

| Variable | Visibility | Required when |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Always |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | Always |
| `NEXT_PUBLIC_APP_URL` | Browser + server | Always; defaults to local URL in schema |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Browser | Rendering interactive maps |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | Browser | Applying the low-noise cloud map style while retaining Advanced Markers |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Browser | Turnstile-protected production forms |
| `TURNSTILE_SECRET_KEY` | Server secret | Verifying Turnstile tokens |
| `SUPABASE_SERVICE_ROLE_KEY` | Server secret | Admin, notification, and privileged workflows |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Server secret/config | Sending transactional email |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Server secret | Production distributed rate limiting |
| `QSTASH_TOKEN` | Server secret | Publishing background notification jobs |
| `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` | Server secret | Verifying QStash job requests |
| `CRON_SECRET` | Server secret | Digest and privacy-export job routes |

See [docs/google-maps-style.md](docs/google-maps-style.md) for the required
Google Cloud style and its live acceptance check.
| `LOG_LEVEL` | Server config | Optional; `debug`, `info`, `warn`, `error`, or `fatal` |
| `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` | Browser/server | Optional error monitoring |

Never commit `.env.local`, `.env.production.local`, service-role keys, signing keys, or API secrets. Variables prefixed with `NEXT_PUBLIC_` are intentionally exposed to browser bundles. They must also exist at build time for a Cloudflare production build.

## Local Supabase

Start the local services and rebuild the database from the migration history:

```bash
npx supabase start
npx supabase db reset --local --yes
```

Run the database security plans:

```bash
npx supabase db query --local --file supabase/tests/rls-test-plan.sql
npx supabase db query --local --file supabase/tests/admin-operations-test-plan.sql
npx supabase db query --local --file supabase/tests/infra-hardening-test-plan.sql
```

Additional focused plans cover blog publishing, public discovery, quick filters, trust and safety, and landlord trust metrics.

Create schema changes as new timestamped migration files. Do not rewrite a migration that has already been applied to a shared environment.

Useful linked-project checks:

```bash
npx supabase migration list
npx supabase db push --linked --dry-run
npx supabase db advisors --linked --type all --level warn --fail-on error
```

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Next.js development server |
| `npm run start` | Start an already-built Next.js application |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:coverage` | Generate Vitest coverage |
| `npm run test:e2e` | Run Playwright browser tests |
| `npm run test:load` | Run the k6 listing API smoke test |
| `npm run build` | Build with webpack and enforce JavaScript budgets |
| `npm run lighthouse` | Run the configured mobile Lighthouse CI audit |
| `npm run profile:frames` | Profile browser interaction frame budgets |
| `npm run audit:prod` | Audit production dependencies at moderate severity |
| `npm run email:check` | Validate Resend configuration |
| `npm run db:generate-seed` | Generate local seed data |
| `npm run admin:bootstrap` | Bootstrap the owner admin using `.env.local` |
| `npm run admin:recover` | Recover owner access using `.env.local` |
| `npm run preview:cf` | Build and preview the OpenNext Worker |
| `npm run deploy:cf` | Build and deploy the OpenNext Worker |
| `npm run cf-typegen` | Generate Cloudflare binding types |

## Testing and quality gates

The test strategy combines:

- Unit and integration tests for domain rules, Server Actions, APIs, auth, chat, notifications, listings, purchases, trust, and viewings.
- Property-based tests for sheet mechanics, geospatial formatting, ranking, ordering, schemas, and edge cases.
- Testing Library render and interaction coverage for client UI.
- Playwright checks for production flows, search, links, console errors, hydration, and motion.
- SQL test plans for RLS, privileged functions, admin operations, trust, and infrastructure hardening.
- k6 load smoke tests for the listing API.
- Lighthouse and bundle budgets for mobile Core Web Vitals and client JavaScript.

Run the local release gate before opening a pull request:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run audit:prod
```

The production build currently enforces a 1,300 KB per-route first-load client budget and a 300 KB compressed initial JavaScript budget for `/`.

## Security model

- Row Level Security is enabled and hardened through migration-backed policies.
- Sensitive document and conversation access uses dedicated server routes and audited reveal flows.
- Admin access includes role checks, MFA flows, account controls, and audit events.
- Authentication includes rate limiting, Turnstile support, email verification, password recovery, and secure session cookies.
- API responses use consistent failure shapes and request IDs.
- User-provided text is sanitised before rendering or logging.
- Production headers include CSP, HSTS, frame denial, MIME sniffing protection, referrer policy, and a restricted permissions policy.
- Secrets remain server-only and are configured independently for each environment.

Operational controls and known advisor findings should be reviewed through the [POPIA controls](docs/operations/popia-controls.md), [environment strategy](docs/operations/environments.md), and [backup/restore runbook](docs/operations/backup-restore-runbook.md).

## Cloudflare deployment

Production is an OpenNext-generated Cloudflare Worker named `roomza`:

```text
https://roomza.pinpoint-roomza.workers.dev
```

For a normal application-only release:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run deploy:cf
```

For a release containing database changes, apply backward-compatible migrations before publishing code that depends on them:

```bash
npx supabase db push --linked --dry-run
npx supabase db push --linked --yes
npx supabase migration list

npx opennextjs-cloudflare build
npx wrangler deploy --dry-run
npx opennextjs-cloudflare deploy
```

Set Worker secrets without putting them in `wrangler.jsonc`:

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put QSTASH_TOKEN
npx wrangler secret put CRON_SECRET
```

Add every other server-only production value using the same mechanism. `NEXT_PUBLIC_*` values must be available both while OpenNext builds the bundle and, for server code paths that read them, in the Worker's configured variables.

After deployment, verify at least the home page and a static route:

```bash
curl -I https://roomza.pinpoint-roomza.workers.dev/
curl -I https://roomza.pinpoint-roomza.workers.dev/robots.txt
```

## CI/CD

`.github/workflows/ci.yml` runs on pull requests and pushes to `main` or `che-20`.

| Job | Checks |
|---|---|
| App checks | Install, lint, typecheck, Vitest, production build, Playwright, dependency audit |
| Lighthouse CWV | Mobile Lighthouse profile; currently advisory while budgets stabilise |
| Supabase RLS checks | Local stack, migration reset, RLS, admin operations, infrastructure hardening |

Branch protection should require the blocking app and database jobs before a production merge.

## Operational documentation

- [System architecture](docs/roomza-system-architecture.md)
- [Release gates](docs/operations/release-gates.md)
- [Environment strategy](docs/operations/environments.md)
- [Backup and restore runbook](docs/operations/backup-restore-runbook.md)
- [POPIA controls](docs/operations/popia-controls.md)
- [Account recovery runbook](docs/recovery-runbook.md)
- [Browser user-flow report](docs/browser-user-flow-report.md)

## Development expectations

- Keep domain behaviour inside the relevant `src/features/<domain>` module.
- Validate external input with Zod and enforce authorisation again at the database boundary.
- Add or update tests with every behaviour change.
- Treat performance and accessibility budgets as product requirements.
- Add database changes through new migrations and update the relevant SQL test plan.
- Keep generated output, local logs, credentials, and machine-specific settings out of commits.
