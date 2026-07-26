# Instant Connect — Technical Design

Real-time property discovery for Pinpoint. This document is the authoritative architecture and rollout design for turning property search from an asynchronous, message-based process into a live marketplace where a renter can see a landlord's current availability and chat, call, join a video tour, or arrange an in-person viewing within minutes.

**Status:** **Phases 1–3 implemented and verified locally** (latest verification 25 July 2026). No linked migration or production deployment has been performed for Phases 2–3.
**Scope:** Phases 1–3 as defined in the product brief.
**Audience:** Engineers implementing the feature and reviewers approving the approach.

### Phase 1 implementation record

Phase 1 is implemented end to end: persisted-first presence and privacy controls, availability settings, the renter Connect Now sheet, chat/voice/video entry points, instant showing requests, the landlord accept/decline banner, conversation handoff, proximity-gated check-in, completion/cancellation, mandatory notification policy, Realtime updates, and automated expiry.

Release evidence captured on 23 July 2026:

| Gate | Result |
| --- | --- |
| Production build + client-JS budgets | Passed (`npm run build`) |
| TypeScript / ESLint | Passed; lint has 10 pre-existing warnings and no errors |
| Phase 1 unit tests | 56 passed |
| Full Vitest suite / architecture conformance | 855 passed; zero architecture violations |
| Desktop + Pixel 7 browser regression | 2 passed |
| Clean local Supabase migration replay | Passed |
| Phase 1 SQL state-machine / RLS / privacy plan | Passed |
| Supabase security and performance advisors | No Phase 1 findings; existing baseline performance warnings remain |

The application is deployable but has not been pushed to a remote environment by this implementation pass.

---

## 1. Executive summary

Pinpoint already owns the hard parts of a real-time platform: realtime conversations and read receipts over Supabase Realtime, ad-hoc and scheduled Jitsi video calls, atomic viewing-slot booking, and a reliable notification outbox. Instant Connect assembles these into a single, coherent "live" layer surfaced at the moment of intent — the listing detail panel and the map.

At the pre-implementation baseline, the genuinely missing primitive was **presence**: there was no online/busy/offline signal, heartbeat, or availability control. Phase 1 now supplies that foundation; Phase 2 can propagate its safe resolved badge across the map and remaining surfaces.

The design deliberately mirrors existing, proven patterns rather than inventing new ones:

- **Instant showing** reuses the `call_sessions` model almost verbatim — a status enum, a partial unique index enforcing a single active session, SECURITY-scoped RPCs for every transition, RLS-gated realtime `postgres_changes`, a bounded ring/accept window, and the outbox for the accept/decline notification.
- **Presence** is persisted-first: a throttled heartbeat and scheduled sweep maintain a conservative badge with zero ambient Realtime connections. Raw heartbeat timestamps stay private.
- **Live activity** is derived from existing `analytics_events` plus lightweight presence counts — no new event pipeline.

### Verified pre-implementation baseline

| Capability | Where | Reused for |
| --- | --- | --- |
| Realtime chat + read receipts | `src/features/chat/` (Supabase Realtime) | Chat action of Connect Now |
| Ad-hoc Jitsi call w/ ring, accept, decline, missed | `call_sessions` + `start_call_session`/`end_call_session` RPCs, [incoming-call-banner.tsx](../src/features/chat/incoming-call-banner.tsx) | Template for instant showing; Voice/Video actions |
| Scheduled + live video viewings | `src/features/viewings/`, [live-video-viewing.tsx](../src/features/viewings/components/live-video-viewing.tsx) | Live tour, join queue |
| Deterministic Jitsi room minting | [chat/room.ts](../src/features/chat/room.ts) | All video surfaces |
| Viewing slots, atomic booking, `in_person`/`video_call` modes | [propose-viewing-slots.ts](../src/features/viewings/actions/propose-viewing-slots.ts), `book_viewing_slot_atomic` | Instant showing extends this |
| Notification outbox (events + QStash + idempotency) | [notifications/outbox.ts](../src/features/notifications/outbox.ts), `notification_events` | All Instant Connect notifications |
| Landlord response-time signal (median first reply, 6h refresh) | [landlord-signals.ts](../src/features/trust/landlord-signals.ts) | "Responds instantly" heuristic |
| Listing detail actions (Message, Schedule Viewing) | [listing-detail-panel.tsx](../src/features/map-discovery/listing-detail-panel.tsx) | Home of the Connect Now surface |

### Gaps this design fills

1. **Presence** — online/busy/offline status and `last_seen`. Greenfield.
2. **Instant/ASAP viewing** — today a viewing requires a *future* slot ([slot-validation.ts:20](../src/features/viewings/slot-validation.ts#L20)). "Show now / within 15 min" is a new flow.
3. **Live activity / social proof** — "3 viewing now", "12 viewed today". No aggregation surface yet.
4. **Landlord-initiated broadcast ("Go Live")** — viewings are 1:1 by booking; there is no public live tour with a join queue.

---

## 2. Design principles

These extend the four product principles in the README (keep the map useful, prefer structured facts, add friction only where it improves trust, make state changes visible).

1. **Honesty over hype.** A 🟢 dot must mean the landlord can actually respond now. False "available" signals erode trust faster than no signal at all. Presence degrades to a conservative state (offline) on any doubt, never an optimistic one.
2. **Reuse the call-session playbook.** Every real-time interaction with accept/decline semantics follows the `call_sessions` pattern: DB-authoritative state machine via RPC, RLS-gated realtime, bounded expiry window, idempotent transitions, non-fatal outbox notification.
3. **Presence is ambient, actions are explicit.** Presence is best-effort and cheap; it never blocks. Anything that commits a person's time (a viewing, a call) goes through an authoritative, audited server action.
4. **Graceful absence.** Every live element has a defined non-live fallback. If presence is unknown, the UI shows the existing Message/Schedule actions unchanged. Instant Connect is strictly additive.
5. **Privacy by default.** A landlord's live location for "owner is nearby" is opt-in per session, coarse-grained, and never persisted beyond the active request. Presence visibility respects existing privacy and consent settings.
6. **Budget-aware.** Presence heartbeats and activity polling must respect performance and Realtime-connection budgets. Throttle writes, coalesce subscriptions, prefer derived reads over new hot paths.

---

## 3. Phase 1 (MVP) — Presence, availability, instant viewing

Deliverables: live online/busy/offline status, realtime chat (exists), voice/video calling (exists as call modes), an "Available Now" badge, and instant viewing requests.

### 3.1 Presence — hybrid model (heartbeat-first, connection-budget constrained)

> **Plan constraint (fixed).** The Supabase plan will **not** be upgraded. The current plan's Realtime concurrent-connection ceiling is a hard architectural limit, so presence is **persisted-first**, not Realtime-Presence-first. A global always-on presence channel is explicitly rejected: it would make every authenticated client hold a Realtime connection and fan out every join/leave to every subscriber, scaling connections and message volume with total traffic — the fastest way to exhaust the ceiling. Realtime connections are treated as a scarce resource spent only on high-intent, short-lived, tightly-scoped interactions (calls, an open showing handshake, an active tour).

Two layers, but the **persisted layer is primary** and answers almost every read.

**Layer A — persisted (primary; the default source of truth).** A throttled heartbeat writes `last_seen_at` and a denormalised `presence_status` to `profiles`. This alone drives every ambient badge — listing cards, the map, the detail panel, chat header — via plain indexed reads on the existing viewport/detail queries, with **zero** Realtime connections. "Online now" becomes "active within the last ~90s" (heartbeat cadence + margin), which is honest and cheap. This layer survives reloads, is queryable as a `WHERE` clause, and is correct on first paint.

The heartbeat is an HTTP RPC (`touch_presence`), not a socket, so a browsing user consumes no Realtime connection at all. Only users actively inside a call/showing/tour open a socket.

**Layer B — ephemeral (opt-in, scoped, live truth for high-intent surfaces only).** Supabase Realtime Presence is used **only** on short-lived, scoped channels where liveness genuinely matters and the participant set is small and bounded:

- `presence:tour:<id>` — the viewer roster / join queue *inside* an active live tour (Phase 2).
- the existing per-conversation `call_${conversationId}` and the new per-landlord `showing_requests` channels — already scoped, already bounded, opened only during an active handshake.

There is no app-wide presence channel and no per-listing presence channel on the map. The live 🟢 dot on a listing you are *viewing* can optionally be sharpened by a single scoped subscription while the detail panel is open (see §3.1.1), and closed when it isn't — bounding concurrent presence sockets to roughly "users currently staring at one specific listing", not "all users online".

```sql
alter table public.profiles
  add column last_seen_at timestamptz,
  add column presence_status text not null default 'offline'
    check (presence_status in ('available', 'busy', 'offline')),
  add column availability_mode text not null default 'auto'
    check (availability_mode in ('auto', 'available', 'busy', 'invisible'));

create index profiles_presence_idx
  on public.profiles(presence_status, last_seen_at);
```

- `last_seen_at` — updated by an RPC `touch_presence(status)` called on a **throttled** client heartbeat (at most once per 60s while the tab is visible; also on `visibilitychange` and before unload via `navigator.sendBeacon`). The RPC only writes if `now() - last_seen_at > 45s` to bound write volume.
- `availability_mode` — the landlord's explicit control. `auto` derives status from presence; `available`/`busy` pin it; `invisible` suppresses all live signals (privacy). Surfaced in `src/features/profile` / settings.
- `presence_status` — a denormalised, query-friendly snapshot maintained by `touch_presence` and by a sweep (below) so map queries never join against the live channel.

**Staleness sweep.** Supabase `pg_cron` runs every two minutes: any profile with `presence_status <> 'offline'` and `last_seen_at < now() - interval '2 minutes'` is set to `offline`. This closes the gap where a client dies without firing unload. The authenticated HTTP route remains available as an operational fallback, but the production schedule does not depend on the web runtime.

Because the persisted layer is primary, `presence_status` is authoritative for every ambient surface. The staleness sweep plus the heartbeat guarantee it converges to the truth within one sweep interval even if Layer B is never used at all — Layer B only sharpens latency on the one surface a user is actively looking at.

#### 3.1.1 Scoped liveness on the open detail panel (optional, bounded)

When a renter opens a listing's detail panel, the client **may** open a single scoped Realtime channel `presence:listing:<id>` and subscribe to that listing's landlord liveness, closing it on panel dismiss/navigation. This upgrades "active ~90s ago" to a true live 🟢 for the specific listing in view, at a cost of **one** socket per open panel per user. Concurrent presence sockets are therefore bounded by "people with a detail panel open right now", never by total logged-in users.

This subscription is a pure enhancement: if the connection budget is under pressure it can be disabled by a feature flag with no functional loss — the panel falls back to the persisted badge. On the map, cards, carousel, and chat header there is **no** subscription at all; those read `presence_status` from the query they already make.

**Connection-budget accounting (must hold on the current plan):**

| Surface | Realtime connections | Notes |
| --- | --- | --- |
| Browsing map / cards / lists | 0 | HTTP heartbeat + indexed `presence_status` reads only |
| Open listing detail panel | 0–1 (flag) | `presence:listing:<id>`, closed on dismiss |
| Active conversation | 1 | existing `call_${conversationId}` (unchanged) |
| Open showing handshake | 1 | new, scoped, only while `requested`/`accepted` |
| Inside a live tour | 1 | `presence:tour:<id>`, only while in the room |

A user's steady-state cost while merely browsing is **zero** sockets; costs are incurred only by explicit, short-lived intent. If the detail-panel subscription proves too costly at peak, it is the first thing flagged off.

### 3.2 Status resolution (pure, testable)

Status shown to a viewer is derived by a **pure function** — matching the codebase convention of pure, unit-tested state modules like [call-state.ts](../src/features/chat/call-state.ts) and [landlord-signals.ts](../src/features/trust/landlord-signals.ts). No I/O; DB/presence is authoritative, TS mirrors for the UI.

```ts
// src/features/presence/presence-status.ts
export type PresenceBadge = "available" | "busy" | "offline";

export function resolvePresenceBadge(input: {
  availabilityMode: "auto" | "available" | "busy" | "invisible";
  liveOnline: boolean;          // scoped subscription if open (§3.1.1), else derive from lastSeenAt
  lastSeenAt: number | null;    // epoch ms
  now: number;
  busyWindowMs?: number;        // default 20 min
}): PresenceBadge { /* ... */ }
```

Resolution rules:

- `invisible` -> always `offline` (never leak presence).
- `available` / `busy` (pinned) -> that value, provided `liveOnline` or `last_seen_at` within the busy window; otherwise `offline`.
- `auto`:
  - `liveOnline && !inActiveCallOrViewing` -> `available`
  - `liveOnline && inActiveCallOrViewing` -> `busy`
  - `!liveOnline && lastSeen < busyWindow` -> `busy` (maps to "typically replies in ~N min", blended with the existing median-response-time signal)
  - else -> `offline`

`liveOnline` has two sources, transparent to the resolver: on a surface with a scoped subscription open (§3.1.1) it reflects the live channel; everywhere else it is derived as `last_seen_at within a freshness window (~90s)`. The function is pure and identical either way — only the freshness of its input differs — so the same unit tests cover both the socket and heartbeat paths.

The "typically replies in 20 min" copy reuses `formatResponseTime` from [landlord-signals.ts](../src/features/trust/landlord-signals.ts#L15). Presence answers *is-online*; the trust signal answers *how-fast-usually*. They compose.

### 3.3 Instant showing — the call-session pattern applied to in-person viewings

Today a viewing needs a future slot. An instant showing is a short-lived, ASAP request/accept handshake with no pre-agreed slot. It is modelled directly on `call_sessions` (see [migration 20260610120000](../supabase/migrations/20260610120000_conversation_video_calling.sql)), which already solved the exact concurrency and authorisation problems.

New table `showing_requests`:

```sql
create type public.showing_status as enum
  ('requested', 'accepted', 'declined', 'expired', 'checked_in', 'completed', 'cancelled');

create table public.showing_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id),
  requester_id uuid not null references public.profiles(id),   -- renter
  landlord_id uuid not null references public.profiles(id),
  window_choice text not null                                   -- 'now' | 'within_15' | 'within_30' | 'today'
    check (window_choice in ('now','within_15','within_30','today')),
  status public.showing_status not null default 'requested',
  eta_minutes int,                                              -- renter-supplied ETA (in-person)
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  expires_at timestamptz not null,                              -- request auto-expires (see window)
  checked_in_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- At most one live request per (listing, requester): mirrors the single-active-call invariant.
create unique index showing_requests_one_live_per_pair_uidx
  on public.showing_requests(listing_id, requester_id)
  where status in ('requested','accepted','checked_in');

create index showing_requests_landlord_idx
  on public.showing_requests(landlord_id, status);
```

**RLS + RPCs.** Exactly like `call_sessions`: SELECT policy restricted to `requester_id` / `landlord_id`; **no** direct insert/update policies. Every transition goes through SECURITY-scoped RPCs so the state machine and the single-live-request invariant stay authoritative:

- `request_showing(listing_id, window_choice, eta_minutes)` -> validates requester is not the landlord, computes `expires_at` from `window_choice`, inserts `requested`. Returns `('requested', id)` or `('request_in_progress', null)` on unique-violation. Enqueues an `outbox` notification to the landlord (new `notification_type` value `showing_request`).
- `respond_showing(id, action)` accepts `accept`, `decline`, `check_in`, `complete`, or `cancel` and enforces the legal transition for the authenticated participant. It is idempotent for terminal states. On accept, it creates the inquiry conversation and notifies the requester.

**Expiry.** The `requested` state expires at `expires_at` via the same staleness sweep job; a client-side timer mirrors `RING_WINDOW_MS` from [incoming-call-banner.tsx:18](../src/features/chat/incoming-call-banner.tsx#L18) so a landlord's accept racing the expiry resolves deterministically (RPC is idempotent).

**Realtime.** The landlord subscribes to `postgres_changes` on `showing_requests filter=landlord_id=eq.<id>` and renders an accept/decline banner that is a near-copy of `IncomingCallBanner`. The requester subscribes filtered by `requester_id` to react to accept/decline. RLS guarantees each party only receives their own rows — the same guarantee relied on for calls.

**Live navigation + check-in ("Njabulo wants to view your property. ETA 12 min").** After accept, the renter's app can share a coarse live ETA. Check-in uses a browser geolocation proximity check against the listing coordinates (already stored for the map) — within a threshold radius, the `check_in` transition is enabled. Location is used transiently for the proximity check and the ETA display only; it is **not** persisted on the row beyond `eta_minutes`, honouring the privacy principle and POPIA posture.

### 3.4 "Connect Now" surface on the listing detail

The listing detail panel ([listing-detail-panel.tsx](../src/features/map-discovery/listing-detail-panel.tsx)) currently exposes Message and Schedule Viewing. Instant Connect adds a presence-aware header block and a single primary action.

```text
Sarah M.   ★ 4.9   Verified   🟢 Available now · Responds instantly
[ ⚡ Connect Now ]
```

Tapping **Connect Now** opens a sheet offering, gated by resolved status and capability:

| Action | Backend | Shown when |
| --- | --- | --- |
| 💬 Chat | existing conversation creation + realtime chat | always |
| 📞 Voice call | `start_call_session` (audio-only Jitsi config) | landlord online |
| 📹 Video call | `start_call_session` (existing) | landlord online |
| 🏠 Request viewing now | `request_showing('now')` | landlord `available` |
| ⏱ Within 15 / 30 / today | `request_showing(window)` | always (async fallback) |

When status is `offline`/unknown, the sheet collapses to the existing Message + Schedule Viewing actions unchanged (graceful absence). Voice call is the existing video-call session with an audio-only Jitsi config hash — no new signalling path.

### 3.5 Client architecture (Phase 1)

Implemented feature module `src/features/presence/`:

- `presence-status.ts` — pure resolver (§3.2), fully unit-tested.
- `use-presence.ts` + `presence-heartbeat.tsx` — application-level throttled HTTP heartbeat wired to visibility/focus changes. Ambient browsing opens no Realtime presence socket.
- `presence-badge.tsx` — conservative available/busy/offline dot + label, currently used on listing detail; Phase 2 threads it through cards, map, chat, and profiles.
- `availability-toggle.tsx` — landlord control for `availability_mode`, placed in profile/settings.

Implemented feature module `src/features/showings/`:

- `actions.ts` — `"use server"` wrappers over the RPCs, returning the existing `ActionResult` type, Zod-validated input, logging via `logger`, and non-fatal outbox delivery.
- `showing-request-banner.tsx` — landlord-side accept/decline banner (adapted from `IncomingCallBanner`).
- `showing-status.ts` — pure state-transition mirror (adapted from `call-state.ts`), unit-tested.
- `connect-now-sheet.tsx` — the Connect Now action sheet.

### 3.6 Notifications (Phase 1)

Reuse the outbox verbatim ([call-actions.ts](../src/features/chat/call-actions.ts) is the reference): insert a `notification_events` row with an idempotency key, then `enqueueNotificationEvent(id)`, wrapped in try/catch so a notification failure never fails the originating action. New additive `notification_type` enum values: `showing_request`, `showing_accepted`, `showing_declined`. No presence changes generate notifications (they would be far too noisy).

### 3.7 Testing (Phase 1)

Completed coverage:

- **Unit (Vitest):** `resolvePresenceBadge` across every mode/liveness/staleness combination incl. `invisible`; `showing-status` transition legality incl. idempotent terminal no-ops and illegal moves; expiry-window computation per `window_choice`.
- **Integration / SQL:** `request_showing` single-live-request invariant, RPC execution grants, transition lifecycle, accepted-request conversation creation, audio/video call mode, expiry scheduling, Realtime publication, and third-party RLS denial.
- **Privacy:** authenticated clients cannot select raw `last_seen_at` or update authoritative `presence_status`; heartbeat and availability changes are narrow authenticated RPCs.
- **E2E (Playwright):** desktop and mobile Connect Now capability gating. The state-machine happy path is exercised transactionally against the real local Postgres schema.

---

## 4. Phase 2 — Live tours, presence everywhere, live map

Deliverables: one-tap Jitsi video calls (Phase 1 delivers the call; Phase 2 makes it one-tap from the map/card), live property tours with a join queue, presence indicators across the app, response-time predictions, and the live map.

> **Implementation status (2026-07-23): complete locally.** Phase 2 is implemented in application code and migration `20260723181941_instant_connect_phase2.sql`. The migration has been applied and its pgTAP plan passed against the local Supabase stack; no linked/remote migration or production deployment was performed in this implementation pass.

### 4.1 Go Live — landlord broadcast tours

A landlord taps **Go Live** on a listing; it becomes "🔴 Live Tour Happening Now" and multiple renters can join. This is a one-to-many broadcast, distinct from the 1:1 `call_sessions` and scheduled 1:1 `viewings`.

New table `live_tours`:

```sql
create type public.live_tour_status as enum ('live', 'ended');

create table public.live_tours (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id),
  host_id uuid not null references public.profiles(id),
  status public.live_tour_status not null default 'live',
  provider text not null default 'jitsi',
  room_id text not null,
  join_url text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  peak_viewers int not null default 0
);

-- One live tour per listing at a time.
create unique index live_tours_one_live_per_listing_uidx
  on public.live_tours(listing_id) where status = 'live';
```

- Rooms minted with the existing [chat/room.ts](../src/features/chat/room.ts) `buildRoomId`/`buildEmbedUrl` helpers and rendered through the existing [live-video-viewing.tsx](../src/features/viewings/components/live-video-viewing.tsx) iframe — the host has moderator affordances; joiners are viewers with voice/chat to ask questions and request "show me the kitchen".
- **Join queue / presence in the room:** the count of current viewers and the "queue to join" come from Realtime Presence scoped to a per-tour channel `presence:tour:<id>`, not the DB. `peak_viewers` is a denormalised stat updated on end for analytics.
- **Discovery:** a `live` tour flips the listing's live badge and (Phase-2 map) its marker to 🔵. Starting/ending a tour is an RPC (`start_live_tour` / `end_live_tour`) with the single-live-per-listing invariant enforced by the partial unique index — same pattern as calls and showings.
- **Notifications:** optionally notify users who saved this listing that a live tour started (reuse saved-search/saved-home + outbox), rate-limited to avoid spam.

### 4.2 Presence indicators across the app

The `PresenceBadge` from Phase 1 is threaded into listing cards ([listing-card.tsx](../src/features/map-discovery/mobile/listing-card.tsx)), the carousel/grid, chat header ([chat-header.tsx](../src/features/chat/chat-header.tsx)), and lister/profile pages. Because presence for a *listing* means presence of its landlord, the viewport listings query returns only the safe, swept `presence_status`; raw `last_seen_at` remains private. This keeps the map query a single round-trip with no per-card subscriptions.

### 4.3 Response-time predictions

Extend the existing landlord trust metrics ([landlord-signals.ts](../src/features/trust/landlord-signals.ts), migration `20260718153457_add_landlord_trust_metrics.sql`) with a short-horizon "likely to reply in ~N min" prediction that blends the persisted median with current presence (online + recent activity shortens the estimate). Stays a pure function; no new hot path.

### 4.4 Live map

The viewport query already returns listings for the map. Add derived presence to each marker and expose the brief's filters as query params (URL-persisted, matching the existing filter convention):

- 🟢 Available now — `landlord.presence_status = 'available'`
- 🔵 Video tour live — `exists (live_tours where listing_id = ... and status='live')`
- 🟠 Viewing in progress — `exists (showing_requests where listing_id=... and status in ('accepted','checked_in'))`
- Filters: Available Now · Live Video Tours · Instant Viewings · Replies Under 5 Minutes (last one from trust metrics).

Marker state is computed **entirely server-side** in the viewport query (all three conditions are indexed column reads / `exists` checks) so clustering/ranking stay consistent and the map opens **zero** Realtime connections. Freshness comes from the normal viewport refetch plus an optional low-frequency poll (e.g. every 30–60s while the map is focused) — deliberately not a subscription, to stay within the fixed connection budget. Per the plan constraint (§3.1), there is no per-marker or map-wide presence channel.

### 4.5 Live activity (social proof)

Subtle urgency without noise: "12 people viewed today", "3 people viewing now", "someone just scheduled a viewing", "last rented 5 days ago". These are **derived**, not a new event stream:

- "viewed today" / "last rented" — aggregate the existing `analytics_events` table (already populated by discovery).
- "viewing now" — approximated from persisted signals (recent `analytics_events` for the listing within a short window, plus active `showing_requests` / `live_tours`), **not** a per-listing presence channel. Under the fixed connection budget this stays an indexed read, not a socket. An exact live count is available only inside a tour room where a scoped channel already exists (§3.1.1).
- "just scheduled" — a recent `viewings` / `showing_requests` insert, shown as a debounced, anonymised ticker.

All counts are rate-limited, rounded, and anonymised; none expose identities. They render only when above a small threshold to avoid "0 viewing now" anti-social-proof.

### 4.6 Implemented architecture and verification

- **Database:** `live_tours`, the one-live-tour-per-listing constraint, host-scoped start/end RPCs, safe public read projections, Realtime publication, and private per-tour Presence policies live in `20260723181941_instant_connect_phase2.sql`.
- **Application:** `src/features/live-tours/` owns Go Live, the authenticated tour room, the Jitsi embed, the anonymous viewer queue, peak-viewer capture, and rate-limited saved-home notifications through the existing outbox.
- **Ambient presence:** the swept safe badge is now carried by the single listing query into cards/carousel, markers, detail, chat, lister pages, and profile surfaces. Raw `last_seen_at` is not added to any client projection.
- **Live map:** all marker states and the four filters are computed by the viewport RPC, persisted in the URL, and refreshed every 45 seconds only while the document is visible. Browsing opens no Realtime channel.
- **Prediction and activity:** response prediction remains a pure trust helper; social-proof signals are server-derived and the UI suppresses low/zero counts.
- **Verification:** 872 Vitest tests passed across 163 files, including Phase 2 queue/activity/filter/marker cases; the hardened Phase 2 pgTAP plan passed 8/8 checks; TypeScript and ESLint passed; the production build passed both client-JS budgets.

---

## 5. Phase 3 — Scheduled open houses, multi-viewer, PiP, recording

- **Scheduled open houses.** Extend `live_tours` with `scheduled_at` and a `scheduled -> live -> ended` lifecycle, announced through the existing alerts feature and discovery surfaces. Reuses saved-search/alert delivery for reminders.
- **Multiple viewers.** Already supported by the `live_tours` + Jitsi model; Phase 3 hardens moderation (mute all, remove viewer, host-only screen share) and scales the presence-based viewer roster.
- **Picture-in-picture.** Client-only enhancement using the browser Document/video PiP API around the existing Jitsi iframe, so a renter can keep browsing the map while a tour continues. Respects reduced-motion and mobile constraints.
- **Optional recording.** Off by default. Requires explicit two-sided consent captured through the existing consent/POPIA workflow before Jitsi recording is enabled. Recordings are personal data — retention, export, and deletion honoured by the existing POPIA flows. Highest compliance risk; gated behind legal review.

---

## 6. Cross-cutting concerns

### 6.1 Security & authorisation

- Every state-changing operation is a SECURITY-scoped RPC with the participant check evaluated **first**, mirroring `start_call_session` / `end_call_session`. No client writes bypass the state machine.
- RLS on all new tables restricts reads to the involved parties; realtime `postgres_changes` inherits these SELECT policies, so subscription filters are defence-in-depth, not the security boundary.
- Presence payloads carry no sensitive data (userId + status only). `presence_status` exposed on listings reveals only a coarse badge, and `invisible` mode fully suppresses it.
- New `notification_type` values are additive enum extensions (`add value if not exists`), matching the brownfield migration style already in the repo.
- Network-exposed surfaces (Jitsi rooms) are authorised by session/tour membership; join URLs are minted server-side per session and never guessable beyond the existing UUID-derived room scheme.

### 6.2 Privacy & POPIA

- `last_seen_at` and presence are personal data: included in the POPIA export/correction/deletion workflows, and `invisible` mode is a first-class opt-out.
- Live location for proximity/ETA is transient, coarse, opt-in per session, and never persisted beyond `eta_minutes`.
- Recording (Phase 3) requires explicit consent and inherits retention/deletion controls.

### 6.3 Performance & connection budget

- **Fixed plan, no upgrade.** The Supabase Realtime concurrent-connection ceiling is a hard limit; the design must fit within it unchanged. See the connection-budget table in §3.1.1.
- **No app-wide or per-listing presence channel.** Ambient presence (map, cards, lists, chat header) is served entirely by the persisted `presence_status` on queries the app already makes — **zero** Realtime connections while browsing.
- Realtime sockets are opened only for high-intent, short-lived, scoped interactions: an active conversation/call (existing), an open showing handshake, an in-progress tour room, and — behind a flag — a single subscription for the one listing detail panel a user has open.
- Heartbeat is an HTTP RPC (not a socket), throttled: <=~60–90s client cadence, >=45s server-side write guard, `visibilitychange` + `sendBeacon` on hide/unload. Bounded write volume, no connection cost.
- Map/activity freshness uses a low-frequency poll on the existing viewport query, never a subscription.
- The presence staleness sweep uses Supabase `pg_cron`; notification digests retain their existing scheduler.
- The detail-panel subscription (§3.1.1) is the single elastic cost and the first thing flagged off if load testing shows connection pressure; disabling it degrades only latency, not function.

### 6.4 Accessibility

- Status is never colour-only: each badge pairs the dot with text ("Available now", "Away", "Offline") and an `aria-label`, consistent with the affordances already in `IncomingCallBanner`.
- Accept/decline and Connect Now surfaces use `role="alert"` / `aria-live` like the existing call banner, and respect reduced-motion.

### 6.5 Failure modes & fallbacks

| Failure | Behaviour |
| --- | --- |
| Scoped subscription unavailable / flagged off | Persisted `presence_status` (the primary source) still drives every badge; only sub-90s liveness sharpening is lost. Message/Schedule unaffected. |
| Connection budget under pressure | Flag off the detail-panel subscription (§3.1.1); the whole presence layer keeps working on the persisted path with zero sockets. |
| Heartbeat blocked (background tab) | `visibilitychange` + sweep move the user to `offline` conservatively. |
| Showing accept races expiry | Idempotent RPC resolves deterministically (`noop`), same as calls. |
| Jitsi/room unavailable | Existing `LiveVideoConnectionState` timeout/failed handling from [live-video-connection.ts](../src/features/viewings/live-video-connection.ts) applies. |
| Notification enqueue fails | Non-fatal (try/catch); the originating action still succeeds, per the outbox convention. |

---

## 7. Data model summary

| Object | Type | Phase | Pattern source |
| --- | --- | --- | --- |
| `profiles.last_seen_at` / `presence_status` / `availability_mode` | columns | 1 | new |
| `touch_presence(status)` | RPC | 1 | throttled write |
| `showing_requests` + `showing_status` enum | table + enum | 1 | `call_sessions` |
| `request_showing` / `respond_showing(action)` | RPCs | 1 | `start_call_session` / `end_call_session` |
| `notification_type` += `showing_request` / `showing_accepted` / `showing_declined` | enum values | 1 | `incoming_call` |
| `live_tours` + `live_tour_status` enum | table + enum | 2 | `call_sessions` + `viewings` |
| `start_live_tour` / `end_live_tour` | RPCs | 2 | single-live invariant |
| `live_tours.scheduled_at` + recording metadata | columns | 3 | additive |

All migrations are additive and brownfield, following the repo's migration conventions; each ships with an updated SQL test plan and RLS coverage per the CI Supabase job.

---

## 8. Rollout & sequencing

Ordered so each step is independently shippable and testable, with presence first because everything depends on it.

### Phase 1

1. ✅ Presence data model + protected heartbeat/availability RPCs + `pg_cron` staleness sweep.
2. ✅ `src/features/presence/` — resolver, app heartbeat, badge, and availability toggle.
3. ✅ `showing_requests` + SECURITY DEFINER RPC boundary + RLS/Realtime/integration plan.
4. ✅ `src/features/showings/` — request/respond actions, landlord banner, expiry, check-in, completion, cancellation.
5. ✅ Lazy-loaded Connect Now sheet on listing detail; chat/voice/video + showing actions.
6. ✅ Outbox notification types, CI database plan, production build, and desktop/mobile E2E gating.

### Phase 2

1. ✅ Presence badges across cards/carousel/chat/profile (viewport query returns landlord presence).
2. ✅ `live_tours` + Go Live + join queue over per-tour presence.
3. ✅ Live map marker rings + the four filters (URL-persisted).
4. ✅ Response-time prediction; live-activity social proof from `analytics_events`.

### Phase 3

1. ✅ Scheduled open houses via alerts.
2. ✅ Multi-viewer moderation hardening; PiP.
3. ✅ Optional consented recording (behind legal review).

### Phase 3 implementation and verification

- **Scheduling:** `live_tours` now supports `scheduled -> live -> ended` with host schedule/start/cancel RPCs, dashboard controls, public discovery projections, saved-listing/search-alert announcements, and signed delayed reminders.
- **Moderation and scale:** the Jitsi room now exposes moderator-gated mute-all, per-viewer mute/remove, and host-only screen sharing. The Presence roster is deduplicated and bounded to 250 participants.
- **Picture-in-picture:** supported browsers can move the active Jitsi iframe into Document Picture-in-Picture and restore it without interrupting the tour; unsupported/mobile browsers retain the normal embedded room.
- **Recording and POPIA:** recording remains disabled by default behind a database feature flag. Enabling it requires legal approval plus explicit consent from the host and every active viewer; consent changes are audited, new unconsented viewers stop recording, and export/deletion/retention workflows include recording metadata.
- **Operations:** Phase 3 flags are database-configurable, so scheduling, moderation, PiP, and recording can be disabled independently without a deploy.
- **Release-gate hardening:** live-tour reads no longer depend on service-only moderation tables; worker tables have explicit least-privilege grants; the waiting room has a status-only fallback RPC; role-aware deep links retain `/live-tours/*`; and the private Presence policy authorizes Supabase's required read probes while keeping Broadcast publishing denied.
- **Browser verification:** fresh desktop-host and Pixel 7 renter journeys passed scheduling, discovery, waiting-room auto-transition, simultaneous private Presence, viewer order/count, host-only moderation, Picture-in-Picture, 44 px product touch targets, and synchronized end-state fallback with zero browser errors.
- **Automated verification:** 872 Vitest tests passed across 163 files; the Phase 3 pgTAP plan passed 11/11 checks (19/19 combined with Phase 2); TypeScript, ESLint (zero errors), architecture conformance, the production build, and both client-JS budgets passed. Supabase public-schema lint completed successfully with two non-blocking assignment-cast warnings in `respond_showing` and the pre-existing `end_call_session`.

Each Instant Connect surface sits behind a feature flag so it can be enabled per environment and rolled back without a deploy, and every element degrades to today's Message/Schedule behaviour when disabled.

---

## 9. Key risks

- **False availability.** The single biggest trust risk. Mitigated by conservative resolution (default to `offline`), the staleness sweep, and blending presence with the proven median-response-time signal rather than replacing it.
- **Realtime connection scale (fixed plan).** The plan will not be upgraded, so the connection ceiling is a hard limit. Mitigated architecturally, not by capacity: persisted-first presence with **zero** sockets while browsing, server-derived map presence, and sockets reserved for scoped high-intent interactions only (§3.1, §3.1.1, §6.3). The single elastic cost (the detail-panel subscription) is behind a flag and is validated by load testing before Phase 2; if it does not fit, it ships off with no functional loss.
- **Notification noise.** Instant requests and live-tour announcements could spam landlords/renters. Mitigated by rate limits, digesting, and never notifying on raw presence changes.
- **In-person safety.** Instant in-person showings put strangers in physical proximity. Mitigated by requiring verified accounts for the "now" window, transient-only location, explicit accept, and reusing existing reporting/moderation. This warrants product + trust review before launch.
- **Recording compliance (Phase 3).** POPIA and two-party consent. Gated behind legal review and off by default.

---

## 10. Open questions

1. Should instant in-person showings require phone/ID verification (existing trust signals) before the "now" window is offered?
2. Given the fixed plan, does the optional detail-panel subscription (§3.1.1) fit within the connection ceiling at peak concurrent detail-panel opens, or should it ship disabled and presence stay fully persisted-only for v1? (Needs a load test against the actual plan limit.)
3. Do landlords want per-listing availability, or a single account-level presence? (This design assumes account-level presence surfaced per listing.)
4. Should "N viewing now" use exact Presence counts or intentionally fuzzed ranges to avoid revealing low demand?
5. Voice-only calls — acceptable to ship as an audio-configured Jitsi room, or is a dedicated voice path (e.g. WebRTC audio) wanted later?

---

## 11. Summary

Instant Connect is mostly an integration and presence problem, not a green-field build. The realtime, video, viewing, notification, and trust primitives already exist and are production-tested. The plan adds one new primitive (persisted-first hybrid presence, designed to run within the current Supabase Realtime budget with zero sockets while browsing), one new state machine cloned from the battle-tested `call_sessions` pattern (instant showings), a broadcast variant for live tours, and a presence-aware surface on the listing detail and map. Sequenced presence-first and shipped behind flags, each phase is independently valuable and fully reversible, and every live element degrades cleanly to Pinpoint's current asynchronous flow.
