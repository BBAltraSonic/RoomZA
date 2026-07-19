# RoomZA

Map-first rental discovery and structured application management for the South African rental market.

> Optimises for conversion quality and controlled renter supply rather than infinite inventory size.

## Product Vision

| Principle | Detail |
|---|---|
| **Map never disappears** | Google Maps is the primary discovery surface, always visible |
| **No long text blocks** | Structured bento-grid data over descriptive paragraphs |
| **Friction where it matters** | Structured applications and document uploads improve lead quality |
| **Anti-references** | Property24, Private Property — noisy, unstructured, anonymous chat |
| **Brand personality** | Focused · Structured · Frictionless · Deliberate |

## Tech Stack

### Frontend

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React Server Components) |
| React | 19 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + custom OKLCH design tokens |
| Components | shadcn/ui 4, Base UI, CVA, clsx, tailwind-merge |
| Maps | Google Maps via `@vis.gl/react-google-maps` |
| Icons | Lucide React |
| Forms & Validation | Zod schemas + React Server Actions |
| Dates | date-fns, react-day-picker |
| Toasts | Sonner |

### Backend & Infrastructure

| Layer | Technology | Purpose |
|---|---|---|
| Database & Auth | Supabase (PostgreSQL + Auth + Storage + Realtime) | Core data layer |
| Hosting | Cloudflare Workers via OpenNext.js | Edge deployment |
| Rate Limiting | Upstash Redis | API protection |
| Background Jobs | Upstash QStash | Async task processing |
| Email | Resend | Transactional email |
| Bot Protection | Cloudflare Turnstile | CAPTCHA on auth forms |
| Video Calls | Jitsi Meet (embedded) | In-app property viewings |
| IaC | Terraform | Cloudflare / Vercel provisioning |
| CI/CD | GitHub Actions | Lint, typecheck, test, build, DB checks |

### Design System

Custom OKLCH colour palette (not standard Tailwind colours):

| Token | Role |
|---|---|
| `--forest` | Primary brand / CTAs |
| `--moss` | Hover states |
| `--clay` | Secondary accent |
| `--gold` | Highlights |
| `--ink` | Text / selected states |
| `--warm-surface` | Card backgrounds |

Full dark mode support and semantic status surfaces (success / warning / error / info).

## Architecture

```
src/
├── app/                       # Next.js App Router pages & API routes
│   ├── api/
│   │   ├── alerts/            # Search alert endpoints
│   │   ├── cron/notifications/ # Scheduled notification processing
│   │   ├── documents/         # Document upload handling
│   │   ├── jobs/notifications/ # Background notification delivery
│   │   └── listings/          # Listing CRUD + [id] routes
│   ├── applications/          # Renter application tracker
│   ├── auth/                  # Login / signup + OAuth callback
│   ├── dashboard/             # Landlord workspace
│   │   ├── applicants/        # Applicant management
│   │   ├── listings/          # Listing management
│   │   └── viewings/          # Viewing management
│   ├── listing/[id]/          # Public listing detail
│   ├── listings/              # Listing list route
│   ├── messages/[id]/         # Conversation thread
│   ├── neighborhoods/[slug]/  # Neighbourhood pages
│   ├── onboarding/            # Role selection flow
│   ├── profile/               # User profile
│   ├── saved/                 # Favourited listings
│   └── viewings/              # Viewing management
├── components/
│   ├── navigation/            # Top nav, profile menu, mobile back button
│   ├── premium/               # Premium-tier UI components
│   └── ui/                    # shadcn/ui primitives
├── features/                  # Feature-sliced domain modules
│   ├── applications/          # Application form, state machine, transitions
│   ├── chat/                  # Real-time messaging + video calling
│   ├── dashboard/             # Landlord workspace nav
│   ├── listings/              # Listing CRUD, schema, true-cost calculator
│   ├── map-discovery/         # Map view, filters, detail panel, mobile shell
│   ├── notifications/         # Notification outbox + delivery
│   └── viewings/              # Viewing scheduling, slot validation
└── lib/                       # Shared utilities
    ├── supabase/              # Server & browser Supabase clients
    ├── auth.ts                # Session + profile helpers
    ├── env.ts                 # Zod-validated environment config
    ├── logger.ts              # Structured logging
    ├── rate-limit.ts          # Upstash rate limiter
    ├── qstash.ts              # QStash client
    ├── roles.ts               # Role enum + guards
    ├── turnstile.ts           # Turnstile verification
    └── redirects.ts           # Post-auth redirect logic
```

## User Roles

| Role | Home | Capabilities |
|---|---|---|
| **Renter** | `/` | Browse map, save favourites, apply to listings, upload documents, schedule viewings, and chat |
| **Landlord** | `/dashboard` | Create/manage listings, review applicants, manage viewings, chat, video calls |

## Features

### Discovery & Browsing
- Full-screen Google Maps with custom price-pin markers
- Viewport-based spatial listing queries (`listings_in_viewport` RPC)
- Filter bar (price range, bedrooms, property type, amenities)
- Listing detail side panel (desktop) / full-screen (mobile)
- Responsive mobile shell with bottom sheet and listing carousel
- Neighbourhood browsing with slug-based routing
- User favourites with save/unsave animation

### Listing Management
- Full CRUD form with image upload and location picker
- Amenity picker
- True Monthly Cost calculator (rent + levies + utilities + parking)
- Publish/unpublish workflow
- Listing organisation and validation

### Applications
- State-machine driven workflow: submitted → reviewing → approved / rejected
- Structured application modal with Zod validation
- Document upload support
- Applicant grouping and card-based management for landlords
- Withdraw functionality for renters

### Communication
- Real-time chat via Supabase Realtime (WebSocket)
- In-app video calling via Jitsi Meet
- Conversation-level call state management
- Incoming call banner

### Viewings
- Calendar-based viewing slot proposal
- Slot validation
- Live video viewings via embedded Jitsi

### Notifications
- Outbox pattern for reliable delivery
- Background job processing via QStash
- Email delivery via Resend
- Cron-triggered notification processing

### Search Alerts
- Saved search criteria
- Neighbourhood-scoped alerts

## Database

**24 Supabase migrations** covering:

- Profiles with role-based access
- Listings with geolocation, pricing, amenities, images
- True monthly cost fields (levies, utilities, parking)
- Applications with state machine and document uploads
- Chat / messaging tables
- Viewing scheduling with time slots and live video support
- User favourites
- Neighbourhoods with slug routing
- Search alerts
- Listing analytics
- Conversation video calling
- Comprehensive RLS policies (3+ hardening passes)
- Optimised indexes and security invoker functions

## Security

- **CSP headers**: strict Content-Security-Policy with whitelisted sources
- **HSTS**: `max-age=63072000; includeSubDomains; preload`
- **RLS**: Row Level Security on all tables with multiple hardening migrations
- **Rate limiting**: Upstash Redis on API routes
- **Bot protection**: Cloudflare Turnstile on auth forms
- **Environment validation**: Zod schemas for all env vars
- **Dependency auditing**: `npm audit` in CI pipeline

## Testing

| Type | Tool | Scope |
|---|---|---|
| Unit | Vitest | Schemas, transitions, slot validation, amenities, grouping, redirects, true-cost, insights |
| Integration | Vitest | Applications, listings, chat, notifications |
| E2E | Playwright | Production flow smoke tests |
| Load | k6 | Listings endpoint smoke test |
| Database | SQL test plans | RLS policy verification, infra hardening |
| Property-based | fast-check | Schema edge cases |

## Development

### Prerequisites

- Node.js 22+
- npm
- Supabase CLI (for local DB development)

### Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Fill in your Supabase, Google Maps, and service keys

# Run the dev server
npm run dev
```

### Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build (webpack) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm test` | Unit + integration tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) |
| `npm run test:load` | Load tests (k6) |
| `npm run test:watch` | Watch mode tests |
| `npm run test:coverage` | Test coverage report |
| `npm run audit:prod` | Production dependency audit |
| `npm run preview:cf` | Preview Cloudflare Workers build |
| `npm run deploy:cf` | Deploy to Cloudflare Workers |

### Local Supabase

```bash
supabase start
supabase db reset --local --yes
supabase db query --local --file supabase/tests/rls-test-plan.sql
```

## Deployment

Production runs on **Cloudflare Workers** via OpenNext.js:

```bash
npm run deploy:cf
```

Server-only secrets are set via:

```bash
npx wrangler secret put <KEY>
```

Public env vars (`NEXT_PUBLIC_*`) must be set at **build time** in `.env.local`.

## CI/CD

GitHub Actions pipeline on push to `main` and PRs:

1. **App checks**: lint → typecheck → unit tests → build → dependency audit
2. **Database checks**: start local Supabase → apply migrations → run RLS test plan → run infra hardening tests
