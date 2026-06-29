# Requirements Document

## Introduction

This feature adds ad-hoc, on-demand video calling to RoomZA in two surfaces: inside a conversation at `/messages/[id]`, where either participant can start a live video call from the chat header, and on listing cards, where a renter can request an instant video call with the landlord. The listing-card entry point funnels into the inquiry conversation so both surfaces converge on a single call implementation.

The feature is brownfield and additive. It reuses RoomZA's existing Jitsi room/iframe pattern (currently scoped to scheduled viewings), the existing Supabase Realtime `postgres_changes` signaling already used by the chat, and the existing notification outbox. It introduces one new table (`call_sessions`), one new status enum, two `SECURITY`-scoped RPCs (`start_call_session`, `end_call_session`), and one additive notification type. The scheduled-viewing flow is left unchanged.

Call lifecycle, room-id minting, and state-transition rules are pushed into pure, property-testable modules (`call-state.ts`, `room.ts`), while cross-row invariants and access control are enforced by RLS plus the RPCs.

## Glossary

- **Call_Session**: A single ad-hoc video call attached to a conversation, persisted as a row in `public.call_sessions`, with a status of `ringing`, `active`, `ended`, `declined`, or `missed`.
- **Caller**: The conversation participant who started a Call_Session.
- **Callee**: The other conversation participant who receives an incoming Call_Session.
- **Participant**: A user whose identifier equals the `renter_id` or `landlord_id` of the conversation referenced by a Call_Session.
- **Non-Terminal Status**: A Call_Session status of `ringing` or `active`.
- **Terminal Status**: A Call_Session status of `ended`, `declined`, or `missed`.
- **Active Call**: A Call_Session whose status is a Non-Terminal Status (`ringing` or `active`).
- **Room**: The Jitsi meeting target for a Call_Session, identified by `room_id` and `join_url`, minted with the scheme `roomza-call-<uuid-without-dashes>` and `https://meet.jit.si/<room_id>`.
- **Call_State_Module**: The pure module `src/features/chat/call-state.ts` that encodes transition rules and outcome classification.
- **Room_Module**: The pure module `src/features/chat/room.ts` that mints room ids, join urls, and embed urls.
- **Start_Call_RPC**: The Postgres function `public.start_call_session`.
- **End_Call_RPC**: The Postgres function `public.end_call_session`.
- **Inquiry_Conversation**: The conversation resolved or created by `getOrCreateInquiryConversation(listingId)` linking a renter to a listing's landlord.
- **Notification_Outbox**: The existing `notification_events` outbox written through `enqueueNotificationEvent`.
- **Ring_Window**: The bounded no-answer interval after which a `ringing` Call_Session is recorded as `missed`.
- **System**: The RoomZA conversation-video-calling feature as a whole, including its server actions, RPCs, and client components.

## Requirements

### Requirement 1: Start a call from a conversation

**User Story:** As a conversation participant, I want to start a video call from the chat header, so that I can talk live with the other participant without leaving the conversation.

#### Acceptance Criteria

1. WHEN a Participant starts a call in a conversation that has no Active Call, THE Start_Call_RPC SHALL insert a Call_Session with status `ringing`, the requester as Caller, and the other Participant as Callee.
2. WHEN a Call_Session is created, THE System SHALL mint a Room using the scheme `roomza-call-<uuid-without-dashes>` for `room_id` and `https://meet.jit.si/<room_id>` for `join_url`.
3. WHEN a Call_Session is created, THE System SHALL set `started_at` to the creation time and leave `answered_at` and `ended_at` unset.
4. IF a non-Participant requests to start a call in a conversation, THEN THE Start_Call_RPC SHALL return `access_denied` and SHALL NOT create a Call_Session.
5. IF a Participant requests to start a call in a conversation that already has an Active Call, THEN THE Start_Call_RPC SHALL return `call_in_progress` and SHALL NOT create a second Active Call.
6. WHEN a Participant successfully starts a call, THE System SHALL render the embedded call surface for the Caller.

### Requirement 2: Receive, join, or decline an incoming call

**User Story:** As a callee, I want to be notified of an incoming call and choose to join or decline it, so that I control whether I take the call.

#### Acceptance Criteria

1. WHEN a Call_Session for a conversation enters status `ringing`, THE System SHALL deliver the change to the Callee's client through the Realtime `postgres_changes` subscription on `call_sessions` filtered by `conversation_id`.
2. WHILE a Call_Session is in status `ringing`, THE System SHALL display an incoming-call invite to the Callee with accept and decline controls.
3. WHEN the Callee accepts a `ringing` Call_Session, THE End_Call_RPC SHALL transition the Call_Session to status `active` and set `answered_at` to the transition time.
4. WHEN the Callee declines a `ringing` Call_Session, THE End_Call_RPC SHALL transition the Call_Session to status `declined` and set `ended_at` to the transition time.
5. WHEN a Call_Session transitions to `active`, THE System SHALL render the embedded call surface for the Callee using the shared Room.
6. IF a non-Participant requests to join or decline a Call_Session, THEN THE End_Call_RPC SHALL return `access_denied` and SHALL NOT change the Call_Session status.
7. IF a Participant requests to join a Call_Session whose status is not `ringing`, THEN THE End_Call_RPC SHALL return `invalid_transition` and SHALL NOT change the Call_Session status.

### Requirement 3: In-call experience with embedded Jitsi

**User Story:** As a participant in an active call, I want the call to run embedded in the app, so that I can see and hear the other participant without switching contexts.

#### Acceptance Criteria

1. WHILE a Call_Session is in status `active`, THE System SHALL render an embedded Jitsi iframe pointing at the embed url derived from the Call_Session `join_url`.
2. WHERE the embedded call iframe is rendered, THE System SHALL request only the `camera`, `microphone`, `fullscreen`, `display-capture`, and `autoplay` iframe permissions.
3. WHEN the Room_Module derives an embed url from a join url, THE Room_Module SHALL preserve the original join url as a prefix of the embed url.
4. WHEN a Participant reconnects or first renders the conversation, THE System SHALL seed the call surface from the current Active Call returned by the active-call query.
5. IF the embedded iframe fails to load or render for any reason, THEN THE System SHALL present an external link to open the Room in a separate browser context.

### Requirement 4: End a call and record its outcome

**User Story:** As a call participant, I want to end or leave a call and have the result recorded, so that the conversation history reflects what happened.

#### Acceptance Criteria

1. WHEN a Participant ends a Call_Session whose status is a Non-Terminal Status, THE End_Call_RPC SHALL transition the Call_Session to status `ended` and set `ended_at` to the transition time.
2. WHEN the Ring_Window elapses without the Callee answering a `ringing` Call_Session, THE System SHALL transition the Call_Session to status `missed` and set `ended_at` to the transition time.
3. IF a Participant requests a transition on a Call_Session that already holds a Terminal Status, THEN THE End_Call_RPC SHALL return `noop` with the current status and SHALL NOT change the Call_Session.
4. WHEN the Call_State_Module classifies a finished Call_Session whose `answered_at` is set, THE Call_State_Module SHALL classify the outcome as `completed`.
5. WHEN the Call_State_Module classifies a finished Call_Session whose `answered_at` is unset, THE Call_State_Module SHALL classify the outcome as `missed`, `declined`, or `cancelled` according to its Terminal Status and SHALL NOT classify it as `completed`.
6. WHERE call history is preserved in the transcript, THE System SHALL insert a system message into `messages` recording the call outcome.

### Requirement 5: Start a video call from a listing card

**User Story:** As a renter browsing listings, I want to request a video call directly from a listing card, so that I can speak with the landlord about a property without manually opening a conversation first.

#### Acceptance Criteria

1. WHEN a renter requests a video call from a listing card, THE System SHALL resolve or create the Inquiry_Conversation for the listing using `getOrCreateInquiryConversation`.
2. WHEN the Inquiry_Conversation is resolved, THE System SHALL start a Call_Session on that conversation through the same start-call path used inside a conversation.
3. WHEN the listing-card call is started successfully, THE System SHALL route the renter to `/messages/[conversationId]` with the call active.
4. IF a renter requests a video call on a listing the renter owns, THEN THE System SHALL reject the request and SHALL NOT create a Call_Session.

### Requirement 6: Notifications for incoming and missed calls

**User Story:** As a user, I want to be notified about incoming and missed calls, so that I do not miss a chance to connect even when I am not viewing the conversation.

#### Acceptance Criteria

1. WHEN a Call_Session is created in status `ringing`, THE System SHALL enqueue an `incoming_call` notification addressed to the Callee through the Notification_Outbox.
2. WHEN a `ringing` Call_Session transitions to `missed`, THE System SHALL enqueue a missed-call notification addressed to the Caller through the Notification_Outbox.
3. WHEN a `ringing` Call_Session transitions to `declined`, THE System SHALL enqueue a notification addressed to the Caller through the Notification_Outbox.
4. IF enqueueing a call notification fails, THEN THE System SHALL complete the call state transition without failing the originating action.

### Requirement 7: Access control and call validity

**User Story:** As a platform operator, I want call access and validity enforced server-side, so that only conversation participants can start or observe calls and a conversation never has more than one active call.

#### Acceptance Criteria

1. THE call_sessions SELECT policy SHALL restrict read access to rows where the requester is the Caller or the Callee.
2. WHILE a conversation has a Call_Session in a Non-Terminal Status, THE System SHALL reject creation of an additional Active Call for that conversation through a partial unique index.
3. THE System SHALL route every Call_Session insert and status change through the `SECURITY`-scoped Start_Call_RPC or End_Call_RPC and SHALL expose no client-writable insert or update policy on `call_sessions`.
4. WHEN the Start_Call_RPC evaluates a request, THE Start_Call_RPC SHALL verify Participant membership before minting a Room or inserting a Call_Session.
5. WHEN the End_Call_RPC evaluates a request, THE End_Call_RPC SHALL verify Participant membership before applying a status change, and IF the requester is not a Participant, THEN THE End_Call_RPC SHALL NOT apply a status change.
6. WHEN a Realtime `postgres_changes` event is delivered for `call_sessions`, THE System SHALL deliver the event only to clients that are the Caller or Callee of that Call_Session.

### Requirement 8: Call-state transition correctness

**User Story:** As a developer, I want call-state transition rules expressed as pure, verifiable rules, so that the UI and the database agree on which transitions are legal and call state stays consistent.

#### Acceptance Criteria

1. WHEN the Call_State_Module evaluates an action against a Terminal Status, THE Call_State_Module SHALL return no legal next status.
2. WHEN the Call_State_Module returns a non-null next status for a `ringing` Call_Session, THE next status SHALL be one of `active`, `declined`, `missed`, or `ended`.
3. WHEN the Call_State_Module returns a non-null next status for an `active` Call_Session, THE next status SHALL be `ended`.
4. WHEN the Call_State_Module evaluates the `join` action against a `ringing` status, THE Call_State_Module SHALL return `active`, and THE Call_State_Module SHALL return `active` for no other status-and-action combination.
5. WHEN the Room_Module mints a room id from a session id, THE Room_Module SHALL produce the same room id for the same session id, begin the room id with the `roomza-call-` prefix, and produce distinct room ids for distinct session ids.
6. WHEN the Room_Module builds a join url from a room id, THE join url SHALL begin with `https://meet.jit.si/` and end with that room id.
