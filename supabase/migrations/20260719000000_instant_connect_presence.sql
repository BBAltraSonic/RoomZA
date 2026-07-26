-- Instant Connect Phase 1 — Presence (persisted-first hybrid).
-- Additive, brownfield migration. Adds the one genuinely missing primitive:
-- an online/busy/offline signal plus a `last_seen_at` heartbeat on profiles.
--
-- Per the design's fixed-plan constraint (§3.1), presence is PERSISTED-FIRST:
-- ambient badges (map, cards, lists, chat header, detail panel) read the
-- denormalised `presence_status` column on queries the app already makes, so a
-- browsing user consumes ZERO Realtime connections. The heartbeat is an HTTP
-- RPC (`touch_presence`), not a socket. A scheduled sweep converges
-- `presence_status` to the truth even if the ephemeral live layer is never used.

-- Change 1: presence columns on profiles.
-- `last_seen_at`      — updated by the throttled `touch_presence` heartbeat.
-- `presence_status`   — denormalised, query-friendly snapshot for ambient reads.
-- `availability_mode` — the user's explicit control:
--                         'auto'      derives status from presence,
--                         'available' / 'busy' pin it,
--                         'invisible' suppresses all live signals (privacy).
alter table public.profiles
  add column if not exists last_seen_at timestamptz,
  add column if not exists presence_status text not null default 'offline'
    check (presence_status in ('available', 'busy', 'offline')),
  add column if not exists availability_mode text not null default 'auto'
    check (availability_mode in ('auto', 'available', 'busy', 'invisible'));

-- Index supporting the sweep (`presence_status <> 'offline' and last_seen_at < ...`)
-- and ambient freshness filters on the viewport/detail queries.
create index if not exists profiles_presence_idx
  on public.profiles(presence_status, last_seen_at);

-- Change 2: touch_presence RPC — the throttled heartbeat.
-- SECURITY definer: direct clients cannot read or write raw heartbeat data.
-- The function is locked to auth.uid(), uses an empty search_path, and is
-- executable only by authenticated users.
-- Write-throttled: only persists when the row is stale (> 45s) to bound write
-- volume even if a client heartbeats more often than intended.
--
-- `desired` is the caller's requested status ('available' | 'busy'); the stored
-- `presence_status` is resolved against `availability_mode` so the DB snapshot
-- already reflects the user's explicit control:
--   invisible            -> always 'offline' (never leak presence)
--   available / busy pin  -> that pinned value
--   auto                  -> the desired live status
create or replace function public.touch_presence(desired text default 'available')
returns table(result text, presence_status text)
language plpgsql security definer set search_path = ''
as $$
declare
  requester uuid := auth.uid();
  prof public.profiles%rowtype;
  resolved text;
begin
  if requester is null then
    return query select 'unauthenticated'::text, null::text; return;
  end if;

  if desired is null or desired not in ('available', 'busy', 'offline') then
    desired := 'available';
  end if;

  select * into prof from public.profiles where id = requester for update;
  if prof.id is null then
    return query select 'not_found'::text, null::text; return;
  end if;

  resolved := case
    when desired = 'offline' then 'offline'
    else case prof.availability_mode
      when 'invisible' then 'offline'
      when 'available' then 'available'
      when 'busy'      then 'busy'
      else desired
    end
  end;

  -- Throttle: skip the write when the row was refreshed within the last 45s AND
  -- the resolved status is unchanged. A status change always writes through.
  if prof.last_seen_at is not null
     and prof.last_seen_at > pg_catalog.now() - interval '45 seconds'
     and prof.presence_status = resolved then
    return query select 'throttled'::text, prof.presence_status; return;
  end if;

  update public.profiles
    set last_seen_at = pg_catalog.now(),
        presence_status = resolved,
        updated_at = pg_catalog.now()
    where id = requester;

  return query select 'updated'::text, resolved;
end;
$$;

revoke all on function public.touch_presence(text) from public, anon;
grant execute on function public.touch_presence(text) to authenticated;

comment on function public.touch_presence(text) is
  'Throttled presence heartbeat. Writes last_seen_at/presence_status for the caller''s own profile, resolved against availability_mode. Persisted-first: drives every ambient badge with zero Realtime connections.';

-- Change 3: authoritative availability control. Direct clients cannot write
-- presence_status or last_seen_at; this narrow RPC updates the caller only.
create or replace function public.set_availability_mode(target_mode text)
returns table(availability_mode text, presence_status text)
language plpgsql security definer set search_path = ''
as $$
declare
  requester uuid := auth.uid();
  resolved text;
begin
  if requester is null then
    raise exception 'Authentication required';
  end if;

  if target_mode is null or target_mode not in ('auto', 'available', 'busy', 'invisible') then
    raise exception 'Invalid availability mode';
  end if;

  resolved := case target_mode
    when 'available' then 'available'
    when 'busy' then 'busy'
    else 'offline'
  end;

  update public.profiles
    set availability_mode = target_mode,
        presence_status = resolved,
        last_seen_at = case
          when resolved = 'offline' then last_seen_at
          else pg_catalog.now()
        end,
        updated_at = pg_catalog.now()
    where id = requester;

  if not found then
    raise exception 'Profile not found';
  end if;

  return query select target_mode, resolved;
end;
$$;

revoke all on function public.set_availability_mode(text) from public, anon;
grant execute on function public.set_availability_mode(text) to authenticated;

comment on function public.set_availability_mode(text) is
  'Sets the caller''s availability and presence atomically without exposing last_seen_at.';

-- Preserve public-profile reads through explicit safe columns while keeping raw
-- heartbeat timestamps private and presence writes server-authoritative.
revoke select, update on table public.profiles from authenticated;
grant select (
  id, email, role, created_at, updated_at, phone, phone_verified,
  email_verified_at, full_name, avatar_url, about, presence_status,
  availability_mode
) on table public.profiles to authenticated;
grant update (
  email, role, updated_at, phone, email_verified_at, full_name,
  avatar_url, about, availability_mode
) on table public.profiles to authenticated;

-- Change 4: sweep_stale_presence — the staleness sweep (§3.1).
-- Scheduled by Supabase pg_cron every two minutes. Any profile marked
-- non-offline but not seen for > 2 min is forced offline. Idempotent.
-- SECURITY definer + a fixed empty search_path are required to update all
-- profiles; only service_role can invoke this function directly.
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
  return swept;
end;
$$;

revoke all on function public.sweep_stale_presence() from public, anon, authenticated;
-- Invoked only by the authenticated cron route via the service-role client.
grant execute on function public.sweep_stale_presence() to service_role;

comment on function public.sweep_stale_presence() is
  'Staleness sweep (cron, ~2 min): forces non-offline profiles unseen for > 2 min to offline. Converges presence_status to truth even if the ephemeral live layer is never used.';
