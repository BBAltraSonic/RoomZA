# Instant Connect — Phase 1 Implementation Plan

**Status:** Complete and locally release-verified on 23 July 2026. The production bundle is deployable; no remote deployment was performed.

Scope from [instant-connect-design.md](instant-connect-design.md) §3: presence (persisted-first hybrid), status resolution, instant showings (call-session pattern), the Connect Now surface, notifications, and tests.

Everything mirrors existing proven patterns: `call_sessions` migration/RPCs, `call-state.ts` pure mirror, `call-actions.ts` server wrappers, `incoming-call-banner.tsx`, the outbox, and the digest cron.

---

## Milestone 1 — Presence data layer (persisted-first)

**Migration** `supabase/migrations/<ts>_instant_connect_presence.sql`
- `alter table public.profiles` add `last_seen_at timestamptz`, `presence_status text default 'offline'` (check available/busy/offline), `availability_mode text default 'auto'` (check auto/available/busy/invisible).
- Index `profiles_presence_idx (presence_status, last_seen_at)`.
- RPC `touch_presence(status text)` — locked SECURITY DEFINER function with an empty search path and `auth.uid()` ownership check; writes `last_seen_at`/`presence_status` only when stale and respects `availability_mode`.
- RPC `set_availability_mode(mode text)` — atomically reconciles explicit availability without exposing raw heartbeat timestamps or direct authoritative presence writes to browser clients.
- RPC `sweep_stale_presence()` — sets `presence_status='offline'` where non-offline and `last_seen_at < now() - interval '2 minutes'`; also expires `showing_requests` (added in M3). Returns count.
- Profile grants are narrowed so authenticated clients cannot select `last_seen_at` or update `presence_status`; public-facing reads return only the safe swept badge.

**Scheduler** — Supabase `pg_cron` invokes the sweep every two minutes. `src/app/api/cron/presence/sweep/route.ts` remains as a CRON_SECRET-protected operational fallback.

## Milestone 2 — Pure status resolver + heartbeat client

`src/features/presence/`
- `presence-status.ts` — pure `resolvePresenceBadge(input)` per §3.2 rules (invisible→offline, pinned honored within busy window, auto derives from liveOnline + lastSeen busy window). No I/O.
- `presence-status.test.ts` — every mode × liveness × staleness combination incl. invisible.
- `use-presence.ts` — throttled `touch_presence` heartbeat (≤60s while visible), wired to `visibilitychange` and `navigator.sendBeacon` on unload. Optional single scoped `presence:listing:<id>` channel gated by a feature flag (§3.1.1); falls back to persisted badge when off.
- `presence-badge.tsx` — 🟢/🟡/🔴 dot + label, blends `formatResponseTime` from [landlord-signals.ts](../src/features/trust/landlord-signals.ts) for the "typically replies" copy.
- `availability-toggle.tsx` + a `setAvailabilityMode` server action wired into profile settings.

## Milestone 3 — Instant showing state machine (DB)

**Migration** `supabase/migrations/<ts>_instant_connect_showings.sql`
- `create type public.showing_status as enum (...)` (7 states per design).
- `create table public.showing_requests (...)` with the partial unique index `showing_requests_one_live_per_pair_uidx` and `showing_requests_landlord_idx`, RLS enabled + forced, SELECT policy for requester/landlord only, **no** insert/update policies.
- `alter type public.notification_type add value if not exists` → `showing_request`, `showing_accepted`, `showing_declined`.
- RPCs (locked SECURITY DEFINER with empty search paths, participant check first, idempotent, and executable only by authenticated users):
  - `request_showing(listing_id, window_choice, eta_minutes)` → validates requester≠landlord, computes `expires_at` from window, inserts `requested`; returns `('requested', id)` or `('request_in_progress', null)` on unique_violation.
  - `respond_showing(id, action)` → enforces accept, decline, check-in, completion, and cancellation transitions; idempotent on terminal states and creates the conversation on accept.
- Extend `sweep_stale_presence` (or a paired sweep) to expire `requested` rows past `expires_at`.

## Milestone 4 — Showing pure mirror + server actions

`src/features/showings/`
- `showing-status.ts` — pure transition mirror adapted from `call-state.ts`; expiry-window computation per `window_choice`. + `showing-status.test.ts`.
- `actions/request-showing.ts`, `respond-showing.ts`, `check-in-showing.ts`, `cancel-showing.ts` — `"use server"` wrappers over RPCs, Zod-validated, returning `ActionResult`, logging via `logger`, enqueueing outbox notifications (try/catch, non-fatal) exactly like `call-actions.ts`.
- `request-showing.integration.test.ts` — single-live-request invariant + accept-racing-expiry, mirroring [book-viewing-slot.integration.test.ts](../src/features/viewings/book-viewing-slot.integration.test.ts).
- `showing-request-banner.tsx` — landlord accept/decline banner, near-copy of `IncomingCallBanner` subscribing to `postgres_changes` on `showing_requests filter=landlord_id=eq.<id>`, with a `RING_WINDOW_MS`-style client expiry timer.

## Milestone 5 — Connect Now surface + presence in queries

- Listing detail reads the landlord's safe swept `presence_status` only (zero ambient Realtime); raw `last_seen_at` is never returned to another user. Viewport/card propagation remains Phase 2.
- `connect-now-sheet.tsx` — action sheet gated by resolved status/capability (Chat always; Voice/Video when online; Request-now when available; within-15/30/today always). Offline/unknown collapses to existing Message + Schedule (graceful absence).
- Add the presence-aware header block + single ⚡ Connect Now primary action to [listing-detail-panel.tsx](../src/features/map-discovery/listing-detail-panel.tsx), additive alongside existing actions.
- Voice call = existing `start_call_session` with an audio-only Jitsi config hash in [chat/room.ts](../src/features/chat/room.ts) `buildEmbedUrl` (no new signalling path).

## Milestone 6 — Notifications + RLS tests + verify

- New notification copy builders + outbox wiring for `showing_request` / `showing_accepted` / `showing_declined` (reuse `enqueueNotificationEvent`, idempotency keys like `showing_request:<id>`).
- Extend the RLS test plan / `rls-denial.test.ts` for `showing_requests` (third party cannot read another pair's rows) and presence-column write scoping via `touch_presence`.
- Release verification: typecheck, lint, production build and JS budgets, focused Vitest, transactional local Supabase plan, advisors, and desktop/mobile Playwright.

---

## Ordering & verification
DB migrations → pure modules + unit tests → server actions + integration tests → UI components → query/detail wiring → notifications/RLS. Typecheck and Vitest run after each milestone. Each behaviour change ships with tests per project TDD rules.

## Notes / deliberate deferrals
- The scoped `presence:listing:<id>` detail-panel channel is built behind a feature flag (design §3.1.1 says it is the first thing to flag off under connection pressure); the persisted badge is the default path and works without it.
- Live navigation/geofence check-in (§3.3) is wired minimally: the `check_in` RPC transition plus a client proximity gate against listing coordinates; live ETA sharing is coarse and not persisted beyond `eta_minutes`.
- Desktop and mobile Playwright coverage verifies Connect Now capability gating; the full transition lifecycle is verified by the transactional SQL plan.
