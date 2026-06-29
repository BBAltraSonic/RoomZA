# Implementation Plan: Conversation Video Calling

## Overview

This plan implements ad-hoc video calling for RoomZA conversations and listing cards as a brownfield, additive change on top of the existing Next.js + Supabase stack. It is sequenced bottom-up: database migration first, then the pure property-tested modules (`call-state.ts`, `room.ts`), then the guarded server actions, then the realtime client components, and finally wiring into the conversation route and listing cards. Each task builds on the previous one so there is no orphaned code — every module is consumed by a later integration step.

The pure modules mirror the authoritative DB transition rules and room-minting scheme, and are validated by property-based tests against Correctness Properties 1–6. Server actions and RPC behavior are validated by integration tests mirroring `src/features/chat/integration.test.ts`.

## Tasks

- [x] 1. Create database migration and regenerate types
  - [x] 1.1 Author the `conversation_video_calling` migration
    - Create `supabase/migrations/<timestamp>_conversation_video_calling.sql`
    - Add `public.call_status` enum (`ringing`, `active`, `ended`, `declined`, `missed`)
    - Create `public.call_sessions` table with `conversation_id`, `listing_id`, `caller_id`, `callee_id`, `status`, `provider`, `room_id`, `join_url`, `started_at`, `answered_at`, `ended_at`, `created_at`
    - Add partial unique index `call_sessions_one_active_per_convo_uidx` on `conversation_id WHERE status IN ('ringing','active')` (single-active-call invariant)
    - Add unique index `call_sessions_room_id_uidx` on `room_id` and the `conversation_id` lookup index
    - Enable RLS and add the SELECT-only "Participants read call sessions" policy (caller or callee); add NO insert/update policies
    - Add additive enum value `alter type public.notification_type add value if not exists 'incoming_call'`
    - _Requirements: 7.1, 7.2, 7.3, 6.1_

  - [x] 1.2 Author the `start_call_session` and `end_call_session` RPCs
    - Add `start_call_session(target_conversation_id uuid)`: participant check first, mint room `roomza-call-<uuid-without-dashes>` + `https://meet.jit.si/<room>`, insert `ringing` row, catch `unique_violation` → `call_in_progress`, return `access_denied`/`started`/`unauthenticated`
    - Add `end_call_session(target_session_id uuid, action text)`: `select ... for update`, participant check, idempotent `noop` on terminal status, legal `(status, action) → next_status` mapping (`join→active`, `decline→declined`, `missed→missed` from `ringing`; `end→ended` from any non-terminal), set `answered_at`/`ended_at` accordingly, return `invalid_transition` otherwise
    - `revoke all` from `public, anon`; `grant execute` to `authenticated` on both functions
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.3, 2.4, 2.6, 2.7, 4.1, 4.3, 7.3, 7.4, 7.5_

  - [x] 1.3 Regenerate Supabase types
    - Regenerate `src/lib/supabase/types.ts` so `call_sessions`, `call_status`, the new RPCs, and the `incoming_call` notification type are typed
    - _Requirements: 7.3_

- [x] 2. Implement pure call-state module
  - [x] 2.1 Implement `src/features/chat/call-state.ts`
    - Define `CallStatus`, `CallAction`, `NON_TERMINAL`, `TERMINAL` exports
    - Implement `isTerminal(status)`, `nextStatus(status, action)` mirroring the RPC rule set (terminal states absorbing; `join` only `ringing→active`; `decline`/`missed` only from `ringing`; `end` from any non-terminal → `ended`)
    - Implement `callOutcome({ status, answeredAt })` → `completed` iff `answeredAt` set, else `missed`/`declined`/`cancelled` by terminal status
    - _Requirements: 4.4, 4.5, 8.1, 8.2, 8.3, 8.4_

  - [ ]* 2.2 Write property test for terminal-state and transition rules
    - **Property 1: Terminal states are absorbing** — `isTerminal(s)` ⇒ `nextStatus(s, a) === null` for all actions
    - **Property 2: Legal transitions advance toward termination** — non-null results from `ringing` ∈ {active, declined, missed, ended}; from `active` = ended; never returns same non-terminal; never `active→ringing`
    - **Property 3: `join` is the only path to `active`** — `nextStatus(s,a) === "active"` iff `s === "ringing"` and `a === "join"`
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 4.1, 2.3, 7.2**

  - [ ]* 2.3 Write property + unit tests for outcome classification
    - **Property 4: Outcome classification matches answered history** — `callOutcome` returns `completed` iff `answeredAt` non-null; never `completed` when null
    - Unit tests for each terminal status edge case (`missed`/`declined`/`cancelled`)
    - **Validates: Requirements 4.4, 4.5, 6.2**

- [x] 3. Implement pure room module
  - [x] 3.1 Implement `src/features/chat/room.ts`
    - Implement `buildRoomId(sessionId)` → `roomza-call-` + uuid with dashes stripped
    - Implement `buildJoinUrl(roomId)` → `https://meet.jit.si/` + roomId
    - Implement `buildEmbedUrl(joinUrl)` appending the same prejoin/deeplink config flags the viewing iframe uses, preserving `joinUrl` as a prefix
    - _Requirements: 1.2, 3.1, 3.3, 8.5, 8.6_

  - [ ]* 3.2 Write property + unit tests for room minting
    - **Property 5: Room id / join url deterministic, unique-preserving, well-formed** — same id → same room id; `roomza-call-` prefix; no `-` after prefix; distinct ids → distinct room ids; `buildJoinUrl` starts with `https://meet.jit.si/` and ends with the room id
    - **Property 6: Embed url preserves the join target** — `buildEmbedUrl(url)` starts with `url`
    - Unit test for `buildEmbedUrl` flag composition with a concrete example
    - **Validates: Requirements 1.2, 3.1, 3.3, 8.5, 8.6**

- [x] 4. Checkpoint - pure modules verified
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement conversation call server actions
  - [x] 5.1 Create `src/features/chat/call-actions.ts` with start/get
    - `startCall(conversationId)`: auth + participant check, call `start_call_session` RPC, map `access_denied`/`call_in_progress`/`started` to `ActionResult`, return the new `CallSession`
    - `getActiveCall(conversationId)`: return current non-terminal session for the conversation (for initial render / reconnect)
    - Reuse the `ActionResult` discriminated-union shape and `@/lib/supabase/server` client per existing conventions
    - _Requirements: 1.1, 1.4, 1.5, 1.6, 3.4, 7.4_

  - [x] 5.2 Add join/decline/end transitions to `call-actions.ts`
    - `joinCall(sessionId)`: thin wrapper over `end_call_session(id, 'join')`, map `invalid_transition`/`access_denied`/`noop`/`updated`
    - `declineCall(sessionId)`: `end_call_session(id, 'decline')`
    - `endCall(sessionId, reason?: "end" | "missed")`: `end_call_session(id, reason ?? 'end')` (also serves the ring-timeout missed path)
    - _Requirements: 2.3, 2.4, 2.6, 2.7, 4.1, 4.2, 4.3, 7.5_

  - [x] 5.3 Wire notification outbox and system messages
    - On `startCall` success, enqueue an `incoming_call` notification to the callee via `enqueueNotificationEvent` (non-fatal on failure)
    - On `declineCall` and on `endCall(..., "missed")`, enqueue a missed/declined notification to the caller (non-fatal)
    - On terminal transition, optionally insert a system message into `messages` recording the call outcome (reuse `callOutcome`)
    - _Requirements: 4.6, 6.1, 6.2, 6.3, 6.4_

  - [x] 5.4 Add `requestListingVideoCall` to `src/features/chat/actions.ts`
    - Reuse `getOrCreateInquiryConversation(listingId)` (already rejects calling about your own listing), then call `startCall` on the resolved conversation
    - Return `{ conversationId, session }` so the client can route to `/messages/[conversationId]` with the call active
    - _Requirements: 5.1, 5.2, 5.4_

  - [ ]* 5.5 Write integration tests for actions and RPC behavior
    - Mirror `src/features/chat/integration.test.ts` structure
    - Cover: participant guard (`access_denied`), single-active-call rejection (`call_in_progress`), transition legality (`invalid_transition` for join on non-ringing), idempotent decline/end (`noop` on terminal), missed/declined notification recipient = caller, incoming notification recipient = callee, listing-card funnel routing through `getOrCreateInquiryConversation` and rejecting own-listing requests
    - _Requirements: 1.4, 1.5, 2.6, 2.7, 4.3, 5.1, 5.2, 5.4, 6.1, 6.2, 6.3, 7.4, 7.5_

- [x] 6. Checkpoint - server actions verified
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement client call components
  - [x] 7.1 Implement `CallButton` and add it to `ChatHeader`
    - Video-call icon button that calls `startCall(conversationId)`; show disabled/in-progress state when a call already exists
    - Surface the `call_in_progress` error by offering to join the existing session
    - _Requirements: 1.1, 1.6_

  - [x] 7.2 Implement `ConversationCall` embedded Jitsi component
    - Render the Jitsi iframe using `buildEmbedUrl(session.join_url)`, reusing the `LiveVideoViewing` iframe pattern from `src/features/viewings/components/live-video-viewing.tsx`
    - Request only `camera; microphone; fullscreen; display-capture; autoplay` permissions
    - Provide the external-link "Open" fallback on iframe failure; wire the End-call control to `endCall(sessionId)`
    - _Requirements: 3.1, 3.2, 3.5, 4.1_

  - [x] 7.3 Implement `IncomingCallBanner` with realtime subscription
    - Subscribe to `call_sessions` via Supabase Realtime `postgres_changes` on channel `call_${conversationId}` filtered by `conversation_id`, reusing the `src/features/chat/chat-box.tsx` subscription pattern
    - Render ring invite with Accept (`joinCall`) / Decline (`declineCall`) controls while `ringing`
    - Run the no-answer Ring_Window timeout that calls `endCall(sessionId, "missed")` on expiry
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 4.2, 6.2_

  - [x] 7.4 Implement `ConversationCallProvider`
    - Wrap the chat surface, hold active-session state seeded from `getActiveCall`, host `IncomingCallBanner` and `ConversationCall`
    - Render `ConversationCall` when the session is `active` (for both caller and callee); reconcile via `getActiveCall` on realtime reconnect
    - _Requirements: 2.5, 3.4_

  - [ ]* 7.5 Write unit tests for provider/banner state selection
    - Test that the provider renders `ConversationCall` only for `active` sessions and the banner only for `ringing`, and reconciles from a seeded active call
    - _Requirements: 2.5, 3.4_

- [x] 8. Integrate into routes and listing cards
  - [x] 8.1 Wire `ConversationCallProvider` into the conversation route
    - In `src/app/messages/[id]/page.tsx`, seed `getActiveCall(conversation.id)` and render `ConversationCallProvider` around `ChatBox`
    - _Requirements: 2.5, 3.4_

  - [x] 8.2 Add `ListingVideoCallButton` to listing cards
    - Add the "Video call" CTA to the `PropertyCard` action row and the mobile `listing-card`
    - On click, call `requestListingVideoCall(listingId)` then route to `/messages/[conversationId]` with the call active
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 8.3 Write integration test for the listing-card funnel
    - Assert the card CTA path resolves/creates the inquiry conversation and starts a call through the same start-call path, and routes to `/messages/[conversationId]`
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 9. Final checkpoint - full feature verified
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP, but they validate the correctness properties and action/RPC guards.
- Property tests (2.2, 2.3, 3.2) validate Correctness Properties 1–6 from the design against the pure modules.
- Integration tests (5.5, 8.3) cover I/O-bound criteria — participant guard, single-active-call, transition legality, idempotency, notifications, and the listing-card funnel — mirroring `src/features/chat/integration.test.ts`.
- Each task references specific requirement clauses for traceability; the migration and RPCs (task 1) are authoritative and the pure modules (tasks 2–3) mirror them for the UI.
- The feature is additive: the scheduled-viewing flow (`book_viewing_slot_atomic`, `/viewings/[id]/live`) is untouched.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1"] },
    { "id": 1, "tasks": ["1.2", "2.2", "2.3", "3.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["5.1", "5.4"] },
    { "id": 4, "tasks": ["5.2"] },
    { "id": 5, "tasks": ["5.3", "5.5"] },
    { "id": 6, "tasks": ["7.1", "7.2", "7.3"] },
    { "id": 7, "tasks": ["7.4"] },
    { "id": 8, "tasks": ["7.5", "8.1", "8.2"] },
    { "id": 9, "tasks": ["8.3"] }
  ]
}
```
