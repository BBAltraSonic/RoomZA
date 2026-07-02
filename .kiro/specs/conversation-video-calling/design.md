# Design Document

## Overview

This feature adds **ad-hoc, on-demand video calling** to RoomZA in two places:

1. **Inside conversations** (`/messages/[id]`) — either participant (renter or landlord) can start a live video call from the chat header. The other participant sees an in-chat ring/invite and can join with one tap. The call runs in a Jitsi room embedded in the app.
2. **From listing cards** — a renter browsing listings can request an instant video call with the landlord directly from a card CTA. This creates (or reuses) the inquiry conversation and starts a call invite in it, so the listing-card entry point funnels into the same conversation-call machinery rather than being a separate code path.

The design is **brownfield and additive**. RoomZA already has a working Jitsi integration, but it is scoped to **scheduled viewings** only: booking a `video_call` viewing slot triggers `book_viewing_slot_atomic`, which mints a room id (`roomza-<uuid>`) and a `https://meet.jit.si/...` join URL, rendered by the existing `LiveVideoViewing` iframe component at `/viewings/[id]/live`. This feature reuses that same Jitsi room/iframe pattern and the same notification-outbox plumbing — it does **not** introduce a new video provider, and it does **not** change the scheduled-viewing flow.

The core strategy mirrors the existing `landlord-listing-management` spec: keep server-side I/O thin, push room-id generation and call-state transition rules into **pure, property-testable modules**, and enforce cross-row invariants and access control with RLS plus a `SECURITY`-scoped Postgres RPC.

### Terminology

- **Call session** — a single ad-hoc video call attached to a conversation, with a lifecycle (`ringing → active → ended`, or `ringing → missed/declined`).
- **Caller** — the participant who started the session.
- **Callee** — the other conversation participant.
- **Room** — the Jitsi room (`roomId` + `joinUrl`) the session uses; minted with the same scheme as scheduled viewings.

### Requirements coverage map

| Requirement | Primary design sections |
|---|---|
| 1. Start a call from a conversation | Architecture, Data Models (`call_sessions`, `start_call_session` RPC), Components (`CallButton`, `startCall` action) |
| 2. Receive / join / decline an incoming call | Components (`IncomingCallBanner`, realtime subscription), Data Models (state transitions) |
| 3. In-call experience (embedded Jitsi) | Components (`ConversationCall`, reuse of Jitsi iframe), Security (iframe permissions) |
| 4. End / leave a call and record outcome | Data Models (`end_call_session` RPC, terminal states), Correctness Properties |
| 5. Start a video call from a listing card | Components (`ListingVideoCallButton`, `requestListingVideoCall` action → inquiry conversation) |
| 6. Notifications for missed / incoming calls | Components (notification outbox, `incoming_call` notification type) |
| 7. Access control + validity (only participants, single active call) | Data Models (RLS, RPC guards), Correctness Properties, Security |
| 8. Call-state correctness (pure transition rules) | Components (`call-state.ts`), Correctness Properties |

## Architecture

### Layered structure

The feature follows the established project layering: thin server actions wrap Supabase I/O and delegate rules to pure modules; React Server Components render the conversation and listing surfaces; Client Components own the realtime subscription and the embedded call; RLS plus server-side participant checks enforce access; the single-active-call invariant and atomic state transitions live in `SECURITY`-scoped Postgres RPCs. Realtime call signaling reuses the **existing Supabase Realtime `postgres_changes`** mechanism already used by `ChatBox` (no new websocket infrastructure).

```mermaid
flowchart TD
    subgraph Client["Client Components"]
        CB[CallButton\nin ChatHeader]
        ICB[IncomingCallBanner\nrealtime listener]
        CC[ConversationCall\nJitsi iframe]
        LVB[ListingVideoCallButton\non PropertyCard]
    end

    subgraph RSC["Server Components / Routes"]
        MP[/messages/&#91;id&#93;/]
        LV[listing surfaces / cards]
    end

    subgraph Actions["Server Actions (use server)"]
        SA[chat/call-actions.ts\nstartCall / joinCall / declineCall / endCall / getActiveCall]
        RA[requestListingVideoCall\n(reuses getOrCreateInquiryConversation)]
    end

    subgraph Pure["Pure logic modules (unit + property tested)"]
        CS[call-state.ts\ntransition rules + outcome]
        RM[room.ts\nroom id / join url minting]
    end

    subgraph DB["Supabase (Postgres + Realtime)"]
        T[(call_sessions\nconversations / messages)]
        RPC[[RPCs:\nstart_call_session\nend_call_session]]
        RT{{Realtime postgres_changes}}
        RLS{{RLS policies}}
    end

    MP --> CB & ICB & CC
    LV --> LVB
    CB --> SA
    ICB --> SA
    CC --> SA
    LVB --> RA
    RA --> SA
    SA --> CS & RM
    SA --> RPC & T
    T --- RLS
    T --- RT
    RT -.realtime.-> ICB & CC
```

### Data flow examples

- **Start a call in a conversation**: `CallButton` calls `startCall(conversationId)`; the action verifies the caller is a participant, then invokes the `start_call_session` RPC, which enforces the single-active-call invariant and inserts a `call_sessions` row in `ringing` state with a freshly minted room. The insert propagates over Realtime to the callee's `IncomingCallBanner`. The caller's client renders `ConversationCall` immediately.
- **Join an incoming call**: the callee's `IncomingCallBanner` receives the `INSERT`/`UPDATE` via `postgres_changes`, shows the invite, and on accept calls `joinCall(sessionId)` which transitions the session to `active` and renders `ConversationCall` with the shared room.
- **Decline / miss**: `declineCall(sessionId)` transitions `ringing → declined`; a timeout (no answer within the ring window) transitions `ringing → missed` via `endCall`. Both enqueue a missed-call notification to the caller through the existing outbox.
- **Listing-card call**: `ListingVideoCallButton` calls `requestListingVideoCall(listingId)`, which reuses `getOrCreateInquiryConversation(listingId)` to resolve the conversation, then calls `startCall` on it — so the listing-card path and the in-chat path converge on one implementation.

### Why reuse Realtime instead of adding signaling infra

Jitsi (`meet.jit.si`) handles all media negotiation (SDP/ICE) internally once both peers load the same room URL. RoomZA therefore only needs **presence/invite signaling** — "person A wants to call person B in room X" — which is exactly an insert/update on a table both participants can observe. The `call_sessions` table over Supabase Realtime provides this with zero new infrastructure, consistent with how `ChatBox` already streams messages.

## Data Models

The guiding principle is **reuse the existing schema** and add the minimum. One new table, one new enum, two new RPCs, and one additive notification-type value, delivered in a single new migration (`supabase/migrations/<timestamp>_conversation_video_calling.sql`). No existing column, enum value, policy, or RPC is dropped or repurposed. The scheduled-viewing video flow (`book_viewing_slot_atomic`, `viewings.meeting_*`) is left untouched.

### Existing tables reused unchanged

- `public.conversations` — `(listing_id, renter_id, landlord_id, application_id, type)`, unique on `(listing_id, renter_id)`. Call sessions reference a conversation; participants are derived from `renter_id`/`landlord_id`.
- `public.messages` — optionally, a system message ("Video call started" / "Missed video call") may be inserted to preserve call history in the transcript; this reuses the existing table and RLS.
- `public.notification_events` + outbox — reused for incoming/missed-call notifications via `enqueueNotificationEvent`.

### Change 1: `call_status` enum

```sql
create type public.call_status as enum ('ringing', 'active', 'ended', 'declined', 'missed');
```

`ringing` and `active` are the **non-terminal** states; `ended`, `declined`, `missed` are **terminal**. "Active call" for the single-call invariant means status in (`ringing`, `active`).

### Change 2: `call_sessions` table

```sql
create table public.call_sessions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  listing_id uuid not null references public.listings(id),
  caller_id uuid not null references public.profiles(id),
  callee_id uuid not null references public.profiles(id),
  status public.call_status not null default 'ringing',
  provider text not null default 'jitsi',
  room_id text not null,
  join_url text not null,
  started_at timestamptz not null default now(),  -- when ringing began
  answered_at timestamptz,                         -- when it became active
  ended_at timestamptz,                            -- when it reached a terminal state
  created_at timestamptz not null default now()
);

-- At most one non-terminal call per conversation (single-active-call invariant, Req 7).
create unique index call_sessions_one_active_per_convo_uidx
  on public.call_sessions(conversation_id)
  where status in ('ringing', 'active');

create unique index call_sessions_room_id_uidx
  on public.call_sessions(room_id);

create index call_sessions_conversation_id_idx
  on public.call_sessions(conversation_id);

alter table public.call_sessions enable row level security;

-- Only the two participants of the parent conversation can read a session.
create policy "Participants read call sessions"
  on public.call_sessions for select to authenticated
  using (caller_id = (select auth.uid()) or callee_id = (select auth.uid()));
```

There are **no direct insert/update policies**: all writes go through the `SECURITY`-scoped RPCs below, keeping state transitions authoritative and the single-active-call invariant enforced server-side. Realtime `postgres_changes` respects the SELECT policy, so each participant only receives events for their own sessions.

### Change 3: `start_call_session` RPC (Requirements 1, 7)

Evaluates participant membership **first**, enforces the single-active-call invariant, mints the room, and inserts the `ringing` row atomically.

```sql
create or replace function public.start_call_session(target_conversation_id uuid)
returns table(result text, session_id uuid)
language plpgsql security invoker set search_path = public
as $$
declare
  convo public.conversations%rowtype;
  requester uuid := auth.uid();
  other_party uuid;
  new_id uuid := gen_random_uuid();
  generated_room text;
begin
  if requester is null then
    return query select 'unauthenticated'::text, null::uuid; return;
  end if;

  select * into convo from public.conversations where id = target_conversation_id;

  -- Participant check FIRST (Req 7).
  if convo.id is null or (convo.renter_id <> requester and convo.landlord_id <> requester) then
    return query select 'access_denied'::text, null::uuid; return;
  end if;

  other_party := case when convo.renter_id = requester then convo.landlord_id else convo.renter_id end;
  generated_room := 'roomza-call-' || replace(new_id::text, '-', '');

  begin
    insert into public.call_sessions (
      id, conversation_id, listing_id, caller_id, callee_id, status, room_id, join_url
    ) values (
      new_id, convo.id, convo.listing_id, requester, other_party, 'ringing',
      generated_room, 'https://meet.jit.si/' || generated_room
    );
  exception when unique_violation then
    -- A non-terminal call already exists for this conversation (Req 7).
    return query select 'call_in_progress'::text, null::uuid; return;
  end;

  return query select 'started'::text, new_id;
end;
$$;

revoke all on function public.start_call_session(uuid) from public, anon;
grant execute on function public.start_call_session(uuid) to authenticated;
```

The room scheme (`roomza-call-<uuid-without-dashes>` + `https://meet.jit.si/<room>`) intentionally mirrors `book_viewing_slot_atomic` so the embedded `LiveVideoViewing`-style iframe behaves identically. The pure `room.ts` helper expresses the identical scheme for previewing/testing.

### Change 4: `end_call_session` RPC (Requirements 2, 4, 7)

Single entry point for every state transition off `ringing`/`active`. Validates that the requester is a participant and that the requested transition is legal, then applies it with the correct timestamp. The legality of each `(from, action) → to` move is the **same rule set** expressed in the pure `call-state.ts` module (DB is authoritative; TS mirrors for the UI).

```sql
create or replace function public.end_call_session(target_session_id uuid, action text)
returns table(result text, new_status text)
language plpgsql security invoker set search_path = public
as $$
declare
  sess public.call_sessions%rowtype;
  requester uuid := auth.uid();
  next_status public.call_status;
begin
  select * into sess from public.call_sessions where id = target_session_id for update;

  if sess.id is null or (sess.caller_id <> requester and sess.callee_id <> requester) then
    return query select 'access_denied'::text, null::text; return;
  end if;

  -- Idempotent: already terminal => report current state, no-op.
  if sess.status in ('ended', 'declined', 'missed') then
    return query select 'noop'::text, sess.status::text; return;
  end if;

  next_status := case
    when action = 'join'    and sess.status = 'ringing'                  then 'active'
    when action = 'decline' and sess.status = 'ringing'                  then 'declined'
    when action = 'missed'  and sess.status = 'ringing'                  then 'missed'
    when action = 'end'                                                  then 'ended'
    else null
  end;

  if next_status is null then
    return query select 'invalid_transition'::text, sess.status::text; return;
  end if;

  update public.call_sessions
    set status = next_status,
        answered_at = case when next_status = 'active' then now() else answered_at end,
        ended_at = case when next_status in ('ended','declined','missed') then now() else ended_at end
    where id = target_session_id;

  return query select 'updated'::text, next_status::text;
end;
$$;

revoke all on function public.end_call_session(uuid, text) from public, anon;
grant execute on function public.end_call_session(uuid, text) to authenticated;
```

Note `join` is modeled here as a transition rather than a separate RPC so all session mutations share one guarded path; the `joinCall` server action is a thin wrapper over `end_call_session(id, 'join')`.

### Change 5: notification type (Requirement 6)

```sql
alter type public.notification_type add value if not exists 'incoming_call';
```

Used for the callee's incoming-call notification and the caller's missed-call notification (payload distinguishes them), enqueued via the existing `enqueueNotificationEvent` outbox pattern. This is additive and mirrors how `application_status_changed` was added in the landlord-listing-management migration.

## Components and Interfaces

All new server actions follow the established conventions: `"use server"`, auth + participant check first, Zod validation of inputs, Supabase server client from `@/lib/supabase/server`, RPC for cross-row invariants, and the discriminated-union `ActionResult` return shape already used across the codebase.

### Pure logic modules (new)

#### `src/features/chat/call-state.ts` (Requirements 4, 8)

Mirrors the DB transition rules as pure predicates so the UI can gate controls and tests can assert the rule set in isolation. The RPC remains authoritative.

```ts
export type CallStatus = "ringing" | "active" | "ended" | "declined" | "missed";
export type CallAction = "join" | "decline" | "missed" | "end";

export const NON_TERMINAL: CallStatus[] = ["ringing", "active"];
export const TERMINAL: CallStatus[] = ["ended", "declined", "missed"];

export function isTerminal(status: CallStatus): boolean;

// Returns the resulting status for a legal (status, action) move, or null if illegal.
export function nextStatus(status: CallStatus, action: CallAction): CallStatus | null;

// Classifies a finished session for history/notification copy.
// "completed" when it was ever active; "missed"/"declined"/"cancelled" otherwise.
export function callOutcome(session: {
  status: CallStatus; answeredAt: string | null;
}): "completed" | "missed" | "declined" | "cancelled";
```

Rules encoded: `join` legal only from `ringing` → `active`; `decline`/`missed` legal only from `ringing`; `end` legal from any non-terminal → `ended`; any action on a terminal status is a no-op (illegal move returns `null`).

#### `src/features/chat/room.ts` (Requirements 1, 3)

```ts
// Identical scheme to book_viewing_slot_atomic so the embedded iframe behaves the same.
export function buildRoomId(sessionId: string): string;            // "roomza-call-" + stripped uuid
export function buildJoinUrl(roomId: string): string;              // "https://meet.jit.si/" + roomId
// Adds the same prejoin/deeplink config flags the viewing iframe uses.
export function buildEmbedUrl(joinUrl: string): string;
```

### Server actions — new (`src/features/chat/call-actions.ts`)

```ts
// Req 1, 7 — participant-first; single-active-call enforced by RPC. Returns the new session.
export async function startCall(conversationId: string):
  Promise<ActionResult<{ session: CallSession }>>;

// Req 2 — ringing -> active for the callee (thin wrapper over end_call_session(id,'join')).
export async function joinCall(sessionId: string):
  Promise<ActionResult<{ status: CallStatus }>>;

// Req 2 — ringing -> declined; enqueues missed/declined notification to caller.
export async function declineCall(sessionId: string):
  Promise<ActionResult<{ status: CallStatus }>>;

// Req 4 — any non-terminal -> ended (also used for the ring-timeout 'missed' path).
export async function endCall(sessionId: string, reason?: "end" | "missed"):
  Promise<ActionResult<{ status: CallStatus }>>;

// Req 2, 3 — current non-terminal session for a conversation (for initial render / reconnect).
export async function getActiveCall(conversationId: string):
  Promise<ActionResult<{ session: CallSession | null }>>;
```

On `startCall` success the action enqueues an `incoming_call` notification to the callee (Req 6). On `declineCall`/ring-timeout `missed`, it enqueues a missed-call notification to the caller. Optionally inserts a system message into `messages` to preserve call history.

### Server actions — new (`src/features/chat/actions.ts`, extends existing file)

```ts
// Req 5 — resolve/create the inquiry conversation for a listing, then start a call.
// Reuses getOrCreateInquiryConversation so the listing-card path funnels into one code path.
export async function requestListingVideoCall(listingId: string):
  Promise<ActionResult<{ conversationId: string; session: CallSession }>>;
```

### React components and routes

| Component / Route | Type | Responsibility | Requirements |
|---|---|---|---|
| `CallButton` | Client | Video-call icon button added to `ChatHeader`; calls `startCall`; shows in-progress/disabled state when a call already exists | 1 |
| `IncomingCallBanner` | Client | Subscribes to `call_sessions` via Realtime `postgres_changes` filtered to the conversation; renders ring invite with Accept/Decline; runs the no-answer timeout | 2, 6 |
| `ConversationCall` | Client | Embedded Jitsi iframe (reuses the `LiveVideoViewing` iframe pattern + `buildEmbedUrl`); End-call control wired to `endCall` | 3, 4 |
| `ConversationCallProvider` | Client | Wraps the chat surface; holds the active-session state, hosts `IncomingCallBanner` + `ConversationCall`, seeds from `getActiveCall` | 2, 3 |
| `ListingVideoCallButton` | Client | "Video call" CTA on the property/listing card; calls `requestListingVideoCall`, then routes to `/messages/[conversationId]` with the call active | 5 |
| `src/app/messages/[id]/page.tsx` | RSC | Seeds `getActiveCall` and renders `ConversationCallProvider` around `ChatBox` | 2, 3 |

`ChatBox`, `ChatHeader`, `LiveVideoViewing` (iframe), `PropertyCard`, and the mobile `ListingCard` are reused; `CallButton` is added into `ChatHeader`, and `ListingVideoCallButton` is surfaced on the card action row. The existing scheduled-viewing route (`/viewings/[id]/live`) is unchanged.

### Realtime signaling detail

`IncomingCallBanner` and `ConversationCallProvider` open a Supabase channel `call_${conversationId}` and subscribe to `postgres_changes` on `public.call_sessions` filtered by `conversation_id=eq.${conversationId}` — exactly the pattern `ChatBox` uses for `messages`. RLS guarantees a client only receives rows where it is caller or callee. State changes (ringing → active → ended) arrive as `INSERT`/`UPDATE` events and drive the UI without polling.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

These properties target the **pure logic modules** (`call-state.ts`, `room.ts`). I/O- and infrastructure-bound criteria (RLS scoping, the single-active-call unique index, atomic RPC transitions, Realtime delivery, notification enqueueing, role/participant guards) are validated by integration and example tests instead — see Testing Strategy.

### Property 1: Terminal states are absorbing

For every terminal status `s ∈ {ended, declined, missed}` and every action `a`, `nextStatus(s, a)` is `null` (no transition leaves a terminal state). Equivalently, `isTerminal(s)` implies no legal move.

**Validates: Requirements 4, 8**

### Property 2: Legal transitions only ever advance toward termination

For any `(status, action)` where `nextStatus` returns a non-null `s'`: if `status` is `ringing`, `s' ∈ {active, declined, missed, ended}`; if `status` is `active`, `s' = ended`. `nextStatus` never returns the same non-terminal status it was given, and never moves `active → ringing`.

**Validates: Requirements 4, 8**

### Property 3: `join` is the only path to `active`

For all `(status, action)`, `nextStatus(status, action) === "active"` if and only if `status === "ringing"` and `action === "join"`. This guarantees a call can become active only by an explicit join from a ringing state (basis for single-active-call + answered-at correctness).

**Validates: Requirements 2, 7, 8**

### Property 4: Outcome classification matches answered history

For any finished session, `callOutcome` returns `"completed"` iff `answeredAt` is non-null (the call was ever `active`); when `answeredAt` is null it returns `"missed"`, `"declined"`, or `"cancelled"` according to terminal status, and never `"completed"`. (A call that was never answered is never reported as completed.)

**Validates: Requirements 4, 6**

### Property 5: Room id / join url are deterministic, unique-preserving, and well-formed

For any session id, `buildRoomId` is a pure function of the id (same input → same output), always begins with the `roomza-call-` prefix, contains no `-` after the prefix, and distinct session ids yield distinct room ids. `buildJoinUrl(buildRoomId(id))` always starts with `https://meet.jit.si/` and ends with that room id (mirrors the scheduled-viewing scheme).

**Validates: Requirements 1, 3**

### Property 6: Embed url preserves the join target

For any join url, `buildEmbedUrl(url)` starts with the original url (the config flags are appended, never replace the room), so the embedded iframe always points at the same room the "Open" link does.

**Validates: Requirements 3**

## Error Handling

- **Not a participant** → RPCs return `access_denied`; actions map to `{ success: false, error: "You are not part of this conversation." }`. No session is created or mutated.
- **Call already in progress** (single-active-call) → `start_call_session` catches the `unique_violation` and returns `call_in_progress`; the action surfaces a friendly "A call is already active in this conversation" and the client offers to join the existing session instead.
- **Illegal transition** (e.g. join a non-ringing session) → `end_call_session` returns `invalid_transition`; the action returns a benign error and the client refetches via `getActiveCall` to resync.
- **Already terminal** → `end_call_session` returns `noop` with the current status; treated as success (idempotent decline/end, safe to call from timeout + button race).
- **Ring timeout** → `IncomingCallBanner`/caller client schedules a no-answer timeout; on expiry the caller calls `endCall(id, "missed")`. Because the RPC is idempotent, a late accept/decline racing the timeout resolves deterministically to whichever terminal/active state landed first.
- **Realtime drop** → on channel reconnect the provider calls `getActiveCall` to reconcile UI with the authoritative DB state.
- **Jitsi/iframe failure** → `ConversationCall` shows the same "Open" external-link fallback the existing `LiveVideoViewing` provides.
- **Notification enqueue failure** → already non-fatal in the outbox (`enqueueNotificationEvent` logs and continues); call setup never blocks on notification delivery.

## Security

- **Access control**: `call_sessions` SELECT RLS restricts visibility to the two participants; both RPCs are `security invoker` and evaluate `auth.uid()` participant membership before any state change. There are no client-writable insert/update policies on `call_sessions`.
- **Single active call**: enforced by a partial unique index, not application logic, so concurrent start attempts cannot both succeed.
- **Realtime scoping**: `postgres_changes` honors RLS, so a user never receives call events for conversations they are not part of.
- **Iframe permissions**: `ConversationCall` requests only `camera; microphone; fullscreen; display-capture; autoplay` on the Jitsi iframe — identical to the audited `LiveVideoViewing` component. No additional permissions are granted.
- **No new secrets**: the feature uses the public `meet.jit.si` instance exactly as the scheduled-viewing flow does; no new env vars or credentials are introduced. (If a self-hosted/JaaS Jitsi is adopted later, room/JWT minting would move into `room.ts` + a server action, isolated by design.)
- **Listing-card entry point**: `requestListingVideoCall` reuses `getOrCreateInquiryConversation`, which already blocks messaging yourself about your own listing and resolves the correct landlord, so the card CTA cannot be used to call arbitrary users.

## Testing Strategy

- **Property-based tests** (fast-check or the project's PBT setup) cover the pure modules `call-state.ts` and `room.ts` against Properties 1–6.
- **Unit tests** cover `callOutcome` edge cases and `buildEmbedUrl` flag composition with concrete examples.
- **Integration tests** (mirroring `src/features/chat/integration.test.ts`) cover the server actions and RPC behavior: participant guard, single-active-call rejection, transition legality, idempotent decline/end, and listing-card → inquiry-conversation funneling. RLS scoping and Realtime delivery are asserted at the integration layer where the DB is involved.
- **Manual/e2e**: a two-participant call happy path (start → ring → accept → in-call → end) and the missed-call path, plus the listing-card CTA launching a call, validated against the embedded Jitsi room.
