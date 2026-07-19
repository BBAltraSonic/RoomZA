# RoomZA — Project Context

> Read-first reference so sessions start with full context instead of re-exploring.
> Kept accurate as of the current codebase. Update this file when structure, stack,
> or conventions change.

## What this is

RoomZA is map-first rental discovery + structured application management for the
South African rental market. It optimises for conversion quality and controlled
renter supply, not infinite inventory.

Product principles: the map never disappears; no long text blocks (structured
bento grids over prose); friction only where it improves lead quality. Brand tone:
focused, structured, frictionless, deliberate. Anti-references: Property24 /
Private Property (noisy, unstructured, anonymous chat).

Two user roles:
- **Renter** — home `/applications`. Browse map, apply, upload docs, schedule viewings, chat, save favourites.
- **Landlord** — home `/dashboard`. Create/manage listings, review applicants, manage viewings, chat, video calls.

Role helpers live in `src/lib/roles.ts` (`roles`, `Role`, `isRole`, `getRoleHome`).

## Tech stack

- **Framework**: Next.js 16 (App Router, React Server Components) + React 19, TypeScript 5.
- **Styling**: Tailwind CSS 4 with custom OKLCH design tokens (not stock Tailwind colours). Tokens: `--forest` (primary/CTA), `--moss` (hover), `--clay` (secondary), `--gold` (highlight), `--ink` (text/selected), `--warm-surface` (cards). Full dark mode. Defined in `src/app/globals.css`.
- **UI**: shadcn/ui 4 + Base UI, CVA, clsx, tailwind-merge. Icons: lucide-react. Toasts: sonner.
- **Maps**: Google Maps via `@vis.gl/react-google-maps`.
- **Forms/validation**: Zod schemas + React Server Actions. Dates: date-fns, react-day-picker.
- **Backend**: Supabase (Postgres + Auth + Storage + Realtime).
- **Hosting**: Cloudflare Workers via OpenNext.js (`@opennextjs/cloudflare`, wrangler).
- **Rate limiting**: Upstash Redis. **Background jobs**: Upstash QStash. **Email**: Resend. **Bot protection**: Cloudflare Turnstile. **Video calls**: embedded Jitsi Meet.
- **Errors/telemetry**: Sentry.

## Directory map

```
src/
├── app/                    # App Router pages + API routes
│   ├── api/                # alerts, cron/notifications, documents, jobs/notifications, listings
│   ├── applications/       # renter application tracker (renter home)
│   ├── auth/               # login/signup + OAuth callback
│   ├── dashboard/          # landlord workspace (applicants, listings, viewings)
│   ├── journey/ lister/ listing/[id]/ listings/
│   ├── messages/[id]/      # conversation thread
│   ├── neighborhoods/[slug]/  onboarding/  profile/  saved/  viewings/
│   ├── privacy/ terms/     # legal
│   └── layout.tsx, page.tsx, error.tsx, not-found.tsx, robots.ts, sitemap.ts, globals.css
├── components/
│   ├── navigation/  premium/  ui/   (ui = shadcn primitives)
│   └── turnstile-widget.tsx
├── features/               # feature-sliced domain modules (see below)
├── lib/                    # shared utilities (see below)
├── middleware.ts           # refreshes Supabase session on navigation
└── test/
```

### Feature modules (`src/features/*`)
`alerts`, `applications`, `auth`, `chat` (realtime messaging + video calling),
`dashboard`, `listings`, `map-discovery`, `notifications`, `onboarding`,
`profile`, `viewings`.

Each feature co-locates its `actions.ts` (server actions), `schema.ts` (Zod),
domain logic, React components (often in a `components/` subfolder), and `*.test.ts`
files right next to the code they test. Example (`features/listings`): `actions.ts`,
`api.ts`, `schema.ts`, `authorization.ts`, `insights.ts`, `publish-validation.ts`,
`true-monthly-cost.ts`, `listing-status.ts`, `favorites.ts`, plus components and tests.

### Shared libs (`src/lib`)
- `supabase/server.ts` — server client (RSC/actions), `supabase/browser.ts` — client-side, `supabase/admin.ts` — service-role client, `supabase/middleware.ts` — session refresh, `supabase/types.ts` — generated `Database` type.
- `auth.ts` — `getSessionProfile()`, `requireUser()`, `requireRole(role)` (redirect-based guards). Auth runs on **Supabase Auth built-ins**: password sign-in/up, email confirmation (signup `emailRedirectTo` → `/auth/callback`), and password recovery (`resetPasswordForEmail` → `/auth/callback?next=/auth/reset-password` → `updateUser`). The app gates on `profiles.email_verified_at`, which is synced from `auth.users.email_confirmed_at` in the callback and in `getSessionProfile`. The only custom auth layer left is brute-force **login lockout** (`features/auth/login-lockout*`, `auth_login_attempts` table + `record_auth_login_failure` RPC).
- `action-result.ts` — `ActionResult<T>` discriminated union + `actionSuccess` / `actionFailure` / `fieldErrorFailure` helpers.
- `roles.ts`, `redirects.ts`, `env.ts` (Zod-validated env), `logger.ts` (structured logging), `rate-limit.ts` (Upstash), `qstash.ts`, `turnstile.ts`, `sanitize.ts`, `api.ts`, `utils.ts`.
- Path alias: `@/` → `src/`.

## Key conventions (follow existing patterns)

Server actions (see `src/features/listings/actions.ts` as the canonical example):
- Start file with `"use server"`.
- Authenticate/authorise first with `requireRole("landlord")` / `requireUser()` from `@/lib/auth`.
- Validate every input with a Zod `safeParse`; on failure return `fieldErrorFailure(...)` or `actionFailure(...)`.
- Return `ActionResult<T>` — never throw for expected failures. Callers branch on `result.success`.
- Get the DB client via `await createClient()` from `@/lib/supabase/server`; use `@/lib/supabase/admin` only for privileged writes (e.g. analytics).
- Enforce ownership on writes (e.g. `authorizeOwnedListing`, `.eq("landlord_id", user.id)`), even though RLS also guards it — defence in depth.
- Sensitive multi-step DB logic runs through Postgres RPCs that return a `result` discriminant (`create_listing_checked`, `delete_listing_checked`, `duplicate_listing`).
- Log with `logger.error/warn/info` including `userId` and relevant ids; audit-worthy actions log `{ audit: true, actorId, action, ... }`.
- Call `revalidatePath(...)` for every route whose cache the mutation affects.

Types: import the generated `Database` type from `@/lib/supabase/types` for row/insert/enum types.

Indentation is not uniform across the repo (some files use 4 spaces, libs use 2). Match the style of the file you are editing rather than reformatting.

## Database

Supabase migrations live in `supabase/migrations/` (~38 files, timestamped). They
cover: profiles + roles, listings (geo, pricing, amenities, images), true-monthly-cost
fields, applications state machine + documents, chat/messaging + realtime read
receipts, viewings + slots + live video, favourites, neighbourhoods (slug routing),
search alerts, analytics, conversation video calling, auth (login-attempt lockout +
`profiles.email_verified_at` gate), lister profile, and multiple RLS + infra hardening
passes. Spatial viewport queries use the `listings_in_viewport` RPC (spatial index).

RLS is on all tables; SQL test plans in `supabase/tests/` (`rls-test-plan.sql`,
`infra-hardening-test-plan.sql`). Local DB config in `supabase/config.toml`, seed in
`supabase/seed.sql`.

Local DB workflow:
```
supabase start
supabase db reset --local --yes
supabase db query --local --file supabase/tests/rls-test-plan.sql
```

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Next.js dev server (do NOT run in a blocking tool — user starts it) |
| `npm run build` | Prod build (webpack) + first-load-JS + initial-JS budget checks |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit + integration (`vitest run`) |
| `npm run test:e2e` | Playwright E2E |
| `npm run test:load` | k6 load smoke test |
| `npm run test:coverage` | Coverage report |
| `npm run audit:prod` | Prod dependency audit |
| `npm run deploy:cf` / `preview:cf` | Cloudflare Workers deploy / preview |
| `npm run email:check` | Verify Resend email config |
| `npm run db:generate-seed` | Regenerate seed data |

Verification after changes: run `npm run typecheck` and relevant `npm test` targets.
`npm run build` also enforces JS size budgets (scripts in `scripts/performance/`).

## Testing

- Unit/integration: Vitest (`vitest.config.ts`), Testing Library, jsdom. Property-based: fast-check. Tests are co-located as `*.test.ts(x)`.
- E2E: Playwright (`playwright.config.ts`, `e2e/`).
- Load: k6 (`scripts/load/`). DB: SQL test plans in `supabase/tests/`.
- Do not add tests unless the task calls for it, but match this layout when you do.

## Environment & security

- Env vars validated via Zod in `src/lib/env.ts`. Template in `.env.example`; local values in `.env.local`. `NEXT_PUBLIC_*` vars must be set at **build time**. Server secrets on Cloudflare go via `npx wrangler secret put <KEY>`.
- Gotcha: without `RESEND_API_KEY`, `sendEmail()` short-circuits and sends nothing while the UI still shows success (anti-enumeration by design).
- Security posture: strict CSP + HSTS headers, RLS on all tables, Upstash rate limiting on API routes, Turnstile on auth forms. When adding network-exposed endpoints, confirm auth/rate-limiting is present.

## CI/CD & deployment

- GitHub Actions (`.github/workflows/ci.yml`) on push to `main` / PRs: app checks (lint → typecheck → unit tests → build → dep audit) and DB checks (local Supabase → migrations → RLS + infra hardening test plans).
- Production runs on Cloudflare Workers via OpenNext (`open-next.config.ts`, `wrangler.jsonc`). `vercel.json` also present.

## Specs & docs (existing references)

- Kiro specs: `.kiro/specs/` — `conversation-video-calling`, `discovery-page-experience`, `discovery-pop`, `landlord-listing-management`, `mobile-map-discovery`, `production-readiness-hardening`.
- `README.md` — fuller narrative version of this overview. `PRODUCT.md` — product register.
- `docs/` — build/launch plans, runbooks (`recovery-runbook.md`, `operations/backup-restore-runbook.md`), `operations/` (environments, POPIA controls, release gates), `workflows/` (engineering workflow guides), UI critiques.
- Design/agent tooling: `.agents/skills/impeccable/` (design skill suite), `.impeccable/critique/` (stored critiques).

## Notes for future sessions

- Prefer editing existing feature modules over creating new top-level structure.
- The map is central; changes to discovery must keep the map visible and layouts structured (bento grids, not paragraphs).
- Treat POPIA / privacy as a first-class concern for anything touching personal data.
- Don't start the dev server with a blocking command — ask the user to run `npm run dev`.
