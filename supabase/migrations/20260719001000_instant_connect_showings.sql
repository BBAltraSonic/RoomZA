-- Instant Connect Phase 1 — Instant showing requests.
-- Additive, brownfield migration. Mirrors the `call_sessions` playbook exactly:
-- one enum, one table, a partial unique index enforcing a single live request
-- per pair, SELECT-only RLS with all writes funnelled through SECURITY-scoped
-- RPCs, and additive notification types. The pure TS mirror lives in
-- `src/features/showings/showing-status.ts`.

-- Change 1: showing_status enum.
-- Non-terminal: `requested`, `accepted`, `checked_in`.
-- Terminal:     `declined`, `completed`, `cancelled`, `expired`.
create type public.showing_status as enum (
  'requested', 'accepted', 'checked_in', 'declined', 'completed', 'cancelled', 'expired'
);

-- Change 2: showing_window enum — the renter's requested urgency (§3.3).
create type public.showing_window as enum ('now', 'within_15', 'within_30', 'today');

-- Change 3: showing_requests table.
create table public.showing_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  renter_id uuid not null references public.profiles(id),
  landlord_id uuid not null references public.profiles(id),
  status public.showing_status not null default 'requested',
  window_choice public.showing_window not null,
  eta_minutes int,
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,       -- when a still-`requested` row auto-expires
  responded_at timestamptz,              -- accept/decline time
  checked_in_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint showing_requests_eta_nonnegative check (eta_minutes is null or eta_minutes >= 0),
  constraint showing_requests_distinct_parties check (renter_id <> landlord_id)
);

-- At most one live (non-terminal) request per renter+listing pair
-- (single-live-request invariant, mirrors call_sessions_one_active_per_convo).
create unique index showing_requests_one_live_per_pair_uidx
  on public.showing_requests(listing_id, renter_id)
  where status in ('requested', 'accepted', 'checked_in');

-- Landlord inbox lookup + the expiry sweep predicate.
create index showing_requests_landlord_idx
  on public.showing_requests(landlord_id, status);
create index showing_requests_expiry_idx
  on public.showing_requests(status, expires_at);

alter table public.showing_requests enable row level security;
alter table public.showing_requests force row level security;

grant select on table public.showing_requests to authenticated;
revoke insert, update, delete on table public.showing_requests from public, anon, authenticated;

-- Only the two parties can read a request. No insert/update policies: every
-- write goes through the SECURITY-scoped RPCs below, keeping the state machine
-- authoritative and the single-live invariant server-enforced. Realtime
-- postgres_changes respects this SELECT policy, so each party only receives
-- events for their own requests.
drop policy if exists "Parties read showing requests" on public.showing_requests;
create policy "Parties read showing requests"
  on public.showing_requests for select
  to authenticated
  using (
    renter_id = (select auth.uid())
    or landlord_id = (select auth.uid())
  );

alter publication supabase_realtime add table public.showing_requests;

-- Change 4: additive notification types.
alter type public.notification_type add value if not exists 'showing_request';
alter type public.notification_type add value if not exists 'showing_accepted';
alter type public.notification_type add value if not exists 'showing_declined';

-- Voice and video share the existing call-session signalling path.
alter table public.call_sessions
  add column if not exists media_mode text not null default 'video'
  check (media_mode in ('voice', 'video'));

create or replace function public.start_call_session(
  target_conversation_id uuid,
  requested_media_mode text
)
returns table(result text, session_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  convo public.conversations%rowtype;
  requester uuid := auth.uid();
  other_party uuid;
  new_id uuid := extensions.gen_random_uuid();
  generated_room text;
  resolved_media_mode text;
begin
  if requester is null then
    return query select 'unauthenticated'::text, null::uuid; return;
  end if;

  resolved_media_mode := case when requested_media_mode = 'voice' then 'voice' else 'video' end;
  select * into convo from public.conversations where id = target_conversation_id;

  if convo.id is null or (convo.renter_id <> requester and convo.landlord_id <> requester) then
    return query select 'access_denied'::text, null::uuid; return;
  end if;

  other_party := case when convo.renter_id = requester then convo.landlord_id else convo.renter_id end;
  generated_room := 'roomza-call-' || replace(new_id::text, '-', '');

  begin
    insert into public.call_sessions (
      id, conversation_id, listing_id, caller_id, callee_id, status,
      room_id, join_url, media_mode
    ) values (
      new_id, convo.id, convo.listing_id, requester, other_party, 'ringing',
      generated_room, 'https://meet.jit.si/' || generated_room, resolved_media_mode
    );
  exception when unique_violation then
    return query select 'call_in_progress'::text, null::uuid; return;
  end;

  return query select 'started'::text, new_id;
end;
$$;

revoke all on function public.start_call_session(uuid, text) from public, anon, authenticated;
grant execute on function public.start_call_session(uuid, text) to authenticated;

create or replace function public.start_call_session(target_conversation_id uuid)
returns table(result text, session_id uuid)
language sql security invoker set search_path = ''
as $$
  select * from public.start_call_session(target_conversation_id, 'video');
$$;

revoke all on function public.start_call_session(uuid) from public, anon, authenticated;
grant execute on function public.start_call_session(uuid) to authenticated;

alter function public.end_call_session(uuid, text) security definer;
alter function public.end_call_session(uuid, text) set search_path = '';
revoke all on function public.end_call_session(uuid, text) from public, anon, authenticated;
grant execute on function public.end_call_session(uuid, text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'call_sessions'
  ) then
    alter publication supabase_realtime add table public.call_sessions;
  end if;
end;
$$;

-- Change 5: expiry helper — maps a window choice to an interval from now().
-- `now` and `within_15` share a 15-minute grace so an immediate request does
-- not expire before the landlord can glance at it.
create or replace function public.showing_window_expiry(choice public.showing_window)
returns timestamptz
language sql stable set search_path = ''
as $$
  select pg_catalog.now() + case choice
    when 'now'       then interval '15 minutes'
    when 'within_15' then interval '15 minutes'
    when 'within_30' then interval '30 minutes'
    when 'today'     then interval '12 hours'
  end;
$$;

-- Change 6: request_showing RPC (§3.3).
-- Participant/authorisation check FIRST (requester must not be the landlord,
-- listing must exist and be published), then enforces the single-live invariant
-- via the partial unique index and inserts the `requested` row atomically.
create or replace function public.request_showing(
  target_listing_id uuid,
  window_choice public.showing_window,
  eta_minutes int default null
)
returns table(result text, request_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  requester uuid := auth.uid();
  listing public.listings%rowtype;
  new_id uuid := extensions.gen_random_uuid();
begin
  if requester is null then
    return query select 'unauthenticated'::text, null::uuid; return;
  end if;

  select * into listing from public.listings where id = target_listing_id;

  if listing.id is null or listing.status <> 'published' then
    return query select 'listing_unavailable'::text, null::uuid; return;
  end if;

  -- A landlord cannot request a showing on their own listing (Req: distinct parties).
  if listing.landlord_id = requester then
    return query select 'own_listing'::text, null::uuid; return;
  end if;

  begin
    insert into public.showing_requests (
      id, listing_id, renter_id, landlord_id, status, window_choice, eta_minutes, expires_at
    ) values (
      new_id, listing.id, requester, listing.landlord_id, 'requested',
      window_choice, eta_minutes, public.showing_window_expiry(window_choice)
    );
  exception when unique_violation then
    -- A live request already exists for this renter+listing pair.
    return query select 'request_in_progress'::text, null::uuid; return;
  end;

  return query select 'requested'::text, new_id;
end;
$$;

revoke all on function public.request_showing(uuid, public.showing_window, int) from public, anon, authenticated;
grant execute on function public.request_showing(uuid, public.showing_window, int) to authenticated;

-- Change 7: respond_showing RPC — the single entry point for every transition
-- off a non-terminal state. Validates the requester is a party and the move is
-- legal, then applies it with the correct timestamp. The legality of each
-- `(from, action) -> to` move mirrors the pure showing-status.ts module.
--
-- Actions: 'accept' | 'decline' (landlord), 'check_in' (renter),
--          'complete' (either party), 'cancel' (either party).
create or replace function public.respond_showing(target_request_id uuid, action text)
returns table(result text, new_status text)
language plpgsql security definer set search_path = ''
as $$
declare
  req public.showing_requests%rowtype;
  requester uuid := auth.uid();
  next_status public.showing_status;
  resolved_conversation_id uuid;
begin
  select * into req from public.showing_requests where id = target_request_id for update;

  -- Party check; also covers a missing request.
  if req.id is null or (req.renter_id <> requester and req.landlord_id <> requester) then
    return query select 'access_denied'::text, null::text; return;
  end if;

  -- Idempotent: already terminal => report current state, no-op.
  if req.status in ('declined', 'completed', 'cancelled', 'expired') then
    return query select 'noop'::text, req.status::text; return;
  end if;

  -- Auto-expire a stale `requested` row on touch, so a late accept resolves
  -- deterministically against the same rule the sweep applies.
  if req.status = 'requested' and req.expires_at < pg_catalog.now() then
    update public.showing_requests set status = 'expired' where id = req.id;
    return query select 'noop'::text, 'expired'::text; return;
  end if;

  next_status := case
    -- Landlord-only responses to a pending request.
    when action = 'accept'   and req.status = 'requested' and req.landlord_id = requester then 'accepted'
    when action = 'decline'  and req.status = 'requested' and req.landlord_id = requester then 'declined'
    -- Renter checks in once accepted.
    when action = 'check_in' and req.status = 'accepted'  and req.renter_id = requester   then 'checked_in'
    -- Either party can complete a checked-in showing.
    when action = 'complete' and req.status = 'checked_in'                                then 'completed'
    -- Either party can cancel any non-terminal request.
    when action = 'cancel'                                                                then 'cancelled'
    else null
  end;

  if next_status is null then
    return query select 'invalid_transition'::text, req.status::text; return;
  end if;

  if next_status = 'accepted' then
    insert into public.conversations (listing_id, renter_id, landlord_id, type)
    values (req.listing_id, req.renter_id, req.landlord_id, 'inquiry')
    on conflict (listing_id, renter_id)
    do update set landlord_id = excluded.landlord_id
    returning id into resolved_conversation_id;
  end if;

  update public.showing_requests
    set status = next_status,
        conversation_id = case when next_status = 'accepted' then resolved_conversation_id else conversation_id end,
        responded_at = case when next_status in ('accepted','declined') then pg_catalog.now() else responded_at end,
        checked_in_at = case when next_status = 'checked_in' then pg_catalog.now() else checked_in_at end,
        completed_at = case when next_status = 'completed' then pg_catalog.now() else completed_at end
    where id = target_request_id;

  return query select 'updated'::text, next_status::text;
end;
$$;

revoke all on function public.respond_showing(uuid, text) from public, anon, authenticated;
grant execute on function public.respond_showing(uuid, text) to authenticated;

-- Change 8: extend the presence sweep to also expire stale showing requests.
-- Re-declared here (after showing_requests exists) so the single cron tick both
-- reconciles presence and expires abandoned requests. SECURITY definer: it must
-- update rows across all users.
create or replace function public.sweep_stale_presence()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  swept integer;
begin
  update public.profiles
    set presence_status = 'offline',
        updated_at = pg_catalog.now()
    where presence_status <> 'offline'
      and (last_seen_at is null or last_seen_at < pg_catalog.now() - interval '2 minutes');
  get diagnostics swept = row_count;

  -- Expire showing requests still `requested` past their window.
  update public.showing_requests
    set status = 'expired'
    where status = 'requested'
      and expires_at < pg_catalog.now();

  return swept;
end;
$$;

revoke all on function public.sweep_stale_presence() from public, anon, authenticated;
grant execute on function public.sweep_stale_presence() to service_role;

create extension if not exists pg_cron;

select cron.unschedule(jobid)
from cron.job
where jobname = 'sweep-instant-connect-presence';

select cron.schedule(
  'sweep-instant-connect-presence',
  '*/2 * * * *',
  $cron$select public.sweep_stale_presence();$cron$
);
