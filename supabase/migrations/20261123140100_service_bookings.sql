begin;

-- Service booking hours and bookable one-hour slots.
--
-- Same shape as landlord viewing hours (20261123120100), but per service: a
-- provider sets one weekly window per weekday, in South African time, on each
-- service they post. Signed-in customers see those windows as one-hour slots
-- over the next 14 days and request one; the provider accepts or declines. A
-- request expires at the slot's start if nobody answers.
--
-- A provider is one person: a slot is never offered when it overlaps a live
-- booking on any of their services, and the booking RPC re-checks that under a
-- per-provider lock.

create table public.service_hours (
  service_id uuid not null references public.service_submissions(id) on delete cascade,
  weekday smallint not null,
  start_minute smallint not null,
  end_minute smallint not null,
  updated_at timestamptz not null default now(),
  primary key (service_id, weekday),
  -- 0 = Sunday, as `extract(dow ...)` and JavaScript `getDay()` count.
  constraint service_hours_weekday check (weekday between 0 and 6),
  constraint service_hours_range check (start_minute >= 0 and end_minute <= 1440 and end_minute - start_minute >= 60),
  constraint service_hours_half_hours check (start_minute % 30 = 0 and end_minute % 30 = 0)
);

alter table public.service_hours enable row level security;
alter table public.service_hours force row level security;
revoke all on table public.service_hours from public, anon, authenticated;
grant select on table public.service_hours to authenticated;
-- Customers never read this table: they get derived slots from
-- `service_booking_availability`. Writes go through `set_service_hours`.
create policy "Providers read their services' hours" on public.service_hours
  for select to authenticated using (
    (select public.showing_session_access())
    and service_id in (select s.id from public.service_submissions s where s.poster_id = (select auth.uid()))
  );

create table public.service_bookings (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.service_submissions(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  slot_start timestamptz not null,
  status text not null default 'requested',
  -- What the provider needs to prepare: the job and where it is.
  note text not null,
  -- How the provider reaches the customer; services have no in-app messaging.
  customer_phone text not null,
  customer_name text,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint service_bookings_status check (status in ('requested', 'accepted', 'declined', 'cancelled', 'expired', 'completed')),
  constraint service_bookings_note check (char_length(btrim(note)) between 3 and 500),
  constraint service_bookings_phone check (customer_phone ~ '^\+?[0-9 ()-]{7,24}$'),
  constraint service_bookings_not_self check (customer_id <> provider_id)
);

-- One live booking per slot of a service, and one per customer per service.
-- Stale rows are swept to `expired`/`completed` before either is checked.
create unique index service_bookings_one_live_per_slot_uidx
  on public.service_bookings(service_id, slot_start) where status in ('requested', 'accepted');
create unique index service_bookings_one_live_per_customer_uidx
  on public.service_bookings(service_id, customer_id) where status in ('requested', 'accepted');
create index service_bookings_provider_slot_idx on public.service_bookings(provider_id, slot_start) where status in ('requested', 'accepted');
create index service_bookings_customer_idx on public.service_bookings(customer_id, created_at desc);

alter table public.service_bookings enable row level security;
alter table public.service_bookings force row level security;
revoke all on table public.service_bookings from public, anon, authenticated;
grant select on table public.service_bookings to authenticated;
create policy "Booking parties read their bookings" on public.service_bookings
  for select to authenticated using (
    (select public.showing_session_access())
    and (select auth.uid()) in (customer_id, provider_id)
  );

-- Lazily finishes rows whose time has passed so the live-row indexes only
-- hold bookings that still matter.
create function private.sweep_service_bookings(owner uuid)
returns void
language sql security definer set search_path = '' as $$
  update public.service_bookings set status = case status when 'requested' then 'expired' else 'completed' end
  where provider_id = owner and status in ('requested', 'accepted')
    and ((status = 'requested' and slot_start <= pg_catalog.statement_timestamp())
      or (status = 'accepted' and slot_start + interval '1 hour' <= pg_catalog.statement_timestamp()));
$$;
revoke all on function private.sweep_service_bookings(uuid) from public, anon, authenticated, service_role;

-- Replaces a service's whole weekly schedule atomically; an empty array clears it.
create function public.set_service_hours(target_service_id uuid, hours jsonb)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  saved integer;
begin
  if actor is null or not public.showing_session_access() then
    raise exception 'service hours access denied' using errcode = '42501';
  end if;
  if not exists(select 1 from public.service_submissions s where s.id = target_service_id and s.poster_id = actor) then
    raise exception 'service hours access denied' using errcode = '42501';
  end if;
  if hours is null or jsonb_typeof(hours) <> 'array' or jsonb_array_length(hours) > 7 then
    raise exception 'invalid service hours' using errcode = '22023';
  end if;
  delete from public.service_hours where service_id = target_service_id;
  insert into public.service_hours(service_id, weekday, start_minute, end_minute)
  select target_service_id, (entry->>'weekday')::smallint, (entry->>'startMinute')::smallint, (entry->>'endMinute')::smallint
  from jsonb_array_elements(hours) entry;
  get diagnostics saved = row_count;
  return saved;
end;
$$;
revoke all on function public.set_service_hours(uuid, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.set_service_hours(uuid, jsonb) to authenticated;

-- Open one-hour slot starts for one service, from an hour after `from_at` for
-- `day_count` South African calendar days. A slot is taken when it overlaps
-- any live booking the provider has, on this or another service.
create function private.service_open_slots(target_service_id uuid, from_at timestamptz, day_count integer)
returns table(slot_start timestamptz)
language sql stable security definer set search_path = '' as $$
  with owner as (
    select s.poster_id from public.service_submissions s where s.id = target_service_id
  ), days as (
    select (pg_catalog.timezone('Africa/Johannesburg', from_at))::date + offset_days as day
    from pg_catalog.generate_series(0, greatest(least(day_count, 31), 1) - 1) offset_days
  ), candidates as (
    select pg_catalog.timezone('Africa/Johannesburg', days.day + pg_catalog.make_interval(mins => minute_of_day)) as slot_start
    from days
    join public.service_hours hours
      on hours.service_id = target_service_id and hours.weekday = extract(dow from days.day)
    cross join lateral pg_catalog.generate_series(hours.start_minute::integer, hours.end_minute::integer - 60, 60) minute_of_day
  )
  select candidates.slot_start
  from candidates
  where candidates.slot_start >= from_at + interval '1 hour'
    and not exists (
      select 1 from public.service_bookings taken, owner
      where taken.provider_id = owner.poster_id
        and taken.status in ('requested', 'accepted')
        and taken.slot_start > candidates.slot_start - interval '1 hour'
        and taken.slot_start < candidates.slot_start + interval '1 hour'
    )
  order by candidates.slot_start;
$$;
revoke all on function private.service_open_slots(uuid, timestamptz, integer) from public, anon, authenticated, service_role;

-- Whether a published service is bookable by this viewer. Null when the service
-- is not public, its provider is unavailable, or either party blocked the other.
create function private.service_bookable(target_service_id uuid, viewer uuid)
returns uuid
language sql stable security definer set search_path = '' as $$
  select s.poster_id
  from public.service_submissions s
  join public.approved_services a on a.id = s.id
  where s.id = target_service_id
    and private.pinpoint_service_visible(s.id)
    and not exists(select 1 from public.profile_blocks b
      where (b.blocker_id = viewer and b.blocked_id = s.poster_id)
         or (b.blocker_id = s.poster_id and b.blocked_id = viewer));
$$;
revoke all on function private.service_bookable(uuid, uuid) from public, anon, authenticated, service_role;

-- What a customer may know about a service's calendar. Signed-out visitors
-- learn only whether it takes bookings, so they can be asked to sign in.
create function public.service_booking_availability(target_service_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  viewer uuid := auth.uid();
  provider uuid;
begin
  if viewer is null then
    if private.service_bookable(target_service_id, null) is null then
      return null;
    end if;
    return jsonb_build_object(
      'hasHours', exists(select 1 from public.service_hours h where h.service_id = target_service_id),
      'own', false, 'slots', '[]'::jsonb);
  end if;
  if not public.showing_session_access() then
    return null;
  end if;
  provider := private.service_bookable(target_service_id, viewer);
  if provider is null then
    return null;
  end if;
  return jsonb_build_object(
    'hasHours', exists(select 1 from public.service_hours h where h.service_id = target_service_id),
    'own', provider = viewer,
    'slots', case when provider = viewer then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('start', opening.slot_start, 'end', opening.slot_start + interval '1 hour') order by opening.slot_start)
      from private.service_open_slots(target_service_id, pg_catalog.statement_timestamp(), 14) opening
    ), '[]'::jsonb) end
  );
end;
$$;
revoke all on function public.service_booking_availability(uuid) from public, anon, authenticated, service_role;
grant execute on function public.service_booking_availability(uuid) to anon, authenticated;

-- Result tags: requested, request_in_progress, slot_unavailable, own_service,
-- service_unavailable, invalid_input, access_denied.
create function public.request_service_booking(target_service_id uuid, slot_start timestamptz, note text, phone text)
returns table(result text, booking_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  requester uuid := auth.uid();
  provider uuid;
  existing public.service_bookings%rowtype;
  new_id uuid;
begin
  if requester is null or not public.showing_session_access() then
    return query select 'access_denied'::text, null::uuid; return;
  end if;
  if slot_start is null or note is null or char_length(btrim(note)) not between 3 and 500
    or phone is null or btrim(phone) !~ '^\+?[0-9 ()-]{7,24}$' then
    return query select 'invalid_input'::text, null::uuid; return;
  end if;
  provider := private.service_bookable(target_service_id, requester);
  if provider is null then
    return query select 'service_unavailable'::text, null::uuid; return;
  end if;
  if provider = requester then
    return query select 'own_service'::text, null::uuid; return;
  end if;
  -- Serialises bookings per provider so two customers cannot take
  -- overlapping slots on different services at the same moment.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('service_booking:' || provider::text, 0));
  perform private.sweep_service_bookings(provider);
  select * into existing from public.service_bookings b
    where b.service_id = target_service_id and b.customer_id = requester and b.status in ('requested', 'accepted')
    order by b.created_at desc limit 1;
  if found then
    return query select 'request_in_progress'::text, existing.id; return;
  end if;
  -- 15 days, not 14: a slot shown on the last day of yesterday's calendar stays bookable.
  if not exists(select 1 from private.service_open_slots(target_service_id, pg_catalog.statement_timestamp(), 15) opening
    where opening.slot_start = request_service_booking.slot_start) then
    return query select 'slot_unavailable'::text, null::uuid; return;
  end if;
  new_id := gen_random_uuid();
  begin
    insert into public.service_bookings(id, service_id, customer_id, provider_id, slot_start, note, customer_phone, customer_name)
      values (new_id, target_service_id, requester, provider, request_service_booking.slot_start, btrim(note), btrim(phone),
        (select nullif(btrim(p.full_name), '') from public.profiles p where p.id = requester));
  exception when unique_violation then
    return query select 'slot_unavailable'::text, null::uuid; return;
  end;
  return query select 'requested'::text, new_id;
end;
$$;
revoke all on function public.request_service_booking(uuid, timestamptz, text, text) from public, anon, authenticated, service_role;
grant execute on function public.request_service_booking(uuid, timestamptz, text, text) to authenticated;

-- Provider: accept | decline a pending request. Either party: cancel a live
-- booking before its slot starts. Result tags: updated, noop, access_denied,
-- invalid_transition.
create function public.respond_service_booking(target_booking_id uuid, action text)
returns table(result text, new_status text)
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  booking public.service_bookings%rowtype;
  target text;
begin
  if actor is null or not public.showing_session_access() then
    return query select 'access_denied'::text, null::text; return;
  end if;
  target := case action when 'accept' then 'accepted' when 'decline' then 'declined' when 'cancel' then 'cancelled' end;
  if target is null then
    return query select 'invalid_transition'::text, null::text; return;
  end if;
  select * into booking from public.service_bookings b where b.id = target_booking_id for update;
  if not found or actor not in (booking.customer_id, booking.provider_id) then
    return query select 'access_denied'::text, null::text; return;
  end if;
  if action in ('accept', 'decline') and actor <> booking.provider_id then
    return query select 'access_denied'::text, null::text; return;
  end if;
  if booking.status = target then
    return query select 'noop'::text, booking.status; return;
  end if;
  if booking.slot_start <= pg_catalog.statement_timestamp()
    or (action in ('accept', 'decline') and booking.status <> 'requested')
    or (action = 'cancel' and booking.status not in ('requested', 'accepted')) then
    return query select 'invalid_transition'::text, booking.status; return;
  end if;
  update public.service_bookings set status = target, responded_at = pg_catalog.statement_timestamp()
    where id = booking.id;
  return query select 'updated'::text, target;
end;
$$;
revoke all on function public.respond_service_booking(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.respond_service_booking(uuid, text) to authenticated;

notify pgrst, 'reload schema';
commit;
