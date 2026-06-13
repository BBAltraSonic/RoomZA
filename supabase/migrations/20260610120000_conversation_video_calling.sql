-- Conversation video calling: ad-hoc, on-demand video calls attached to conversations.
-- Additive, brownfield migration. Reuses the existing Jitsi room/iframe pattern and
-- notification outbox. Introduces one enum, one table, and one additive notification type.
-- RPCs (start_call_session / end_call_session) are authored in a follow-up migration.

-- Change 1: call_status enum.
-- `ringing` and `active` are non-terminal; `ended`, `declined`, `missed` are terminal.
create type public.call_status as enum ('ringing', 'active', 'ended', 'declined', 'missed');

-- Change 2: call_sessions table.
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

-- At most one non-terminal call per conversation (single-active-call invariant, Req 7.2).
create unique index call_sessions_one_active_per_convo_uidx
  on public.call_sessions(conversation_id)
  where status in ('ringing', 'active');

-- Rooms are globally unique.
create unique index call_sessions_room_id_uidx
  on public.call_sessions(room_id);

-- Lookup index for fetching a conversation's sessions.
create index call_sessions_conversation_id_idx
  on public.call_sessions(conversation_id);

alter table public.call_sessions enable row level security;
alter table public.call_sessions force row level security;

-- Only the two participants of the parent conversation can read a session (Req 7.1).
-- There are intentionally NO insert/update policies: all writes go through the
-- SECURITY-scoped RPCs (Req 7.3), keeping state transitions authoritative and the
-- single-active-call invariant enforced server-side. Realtime postgres_changes
-- respects this SELECT policy, so each participant only receives events for their
-- own sessions (Req 7.6).
drop policy if exists "Participants read call sessions" on public.call_sessions;
create policy "Participants read call sessions"
  on public.call_sessions for select
  to authenticated
  using (
    caller_id = (select auth.uid())
    or callee_id = (select auth.uid())
  );

-- Change 5: additive notification type for incoming/missed-call notifications (Req 6.1).
alter type public.notification_type add value if not exists 'incoming_call';

-- Change 3: start_call_session RPC (Requirements 1, 7).
-- Evaluates participant membership FIRST, enforces the single-active-call invariant
-- via the partial unique index, mints the room, and inserts the `ringing` row atomically.
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

  -- Participant check FIRST (Req 7.4).
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
    -- A non-terminal call already exists for this conversation (Req 1.5, 7.2).
    return query select 'call_in_progress'::text, null::uuid; return;
  end;

  return query select 'started'::text, new_id;
end;
$$;

revoke all on function public.start_call_session(uuid) from public, anon;
grant execute on function public.start_call_session(uuid) to authenticated;

-- Change 4: end_call_session RPC (Requirements 2, 4, 7).
-- Single entry point for every state transition off `ringing`/`active`. Validates that
-- the requester is a participant and that the requested transition is legal, then applies
-- it with the correct timestamp. The legality of each `(from, action) -> to` move mirrors
-- the pure call-state.ts module (DB is authoritative; TS mirrors for the UI).
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

  -- Participant check (Req 7.5); also covers a missing session.
  if sess.id is null or (sess.caller_id <> requester and sess.callee_id <> requester) then
    return query select 'access_denied'::text, null::text; return;
  end if;

  -- Idempotent: already terminal => report current state, no-op (Req 4.3).
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

  -- Illegal move (e.g. join on a non-ringing session) (Req 2.7).
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
