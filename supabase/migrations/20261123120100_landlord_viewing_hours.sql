begin;

-- Landlord viewing hours and bookable showing slots.
--
-- A landlord sets one weekly window per weekday in South African time. Renters
-- see those windows as 30-minute slots over the next 14 days, minus slots the
-- landlord already has a live showing in, and request one. The request is an
-- ordinary showing request (window 'scheduled') that the landlord accepts or
-- declines, and it expires at the slot's start if nobody answers.

create table public.landlord_viewing_hours (
  landlord_id uuid not null references public.profiles(id) on delete cascade,
  weekday smallint not null,
  start_minute smallint not null,
  end_minute smallint not null,
  updated_at timestamptz not null default now(),
  primary key (landlord_id, weekday),
  -- 0 = Sunday, as `extract(dow ...)` and JavaScript `getDay()` count.
  constraint landlord_viewing_hours_weekday check (weekday between 0 and 6),
  constraint landlord_viewing_hours_range check (start_minute >= 0 and end_minute <= 1440 and end_minute - start_minute >= 30),
  constraint landlord_viewing_hours_half_hours check (start_minute % 30 = 0 and end_minute % 30 = 0)
);

alter table public.landlord_viewing_hours enable row level security;
alter table public.landlord_viewing_hours force row level security;
revoke all on table public.landlord_viewing_hours from public, anon, authenticated;
grant select on table public.landlord_viewing_hours to authenticated;
-- Renters never read this table: they get derived slots from
-- `listing_viewing_availability`. Writes go through `set_viewing_hours`.
create policy "Landlords read their own viewing hours" on public.landlord_viewing_hours
  for select to authenticated using (landlord_id = (select auth.uid()) and (select public.showing_session_access()));

alter table public.showing_requests add column scheduled_for timestamptz;
alter table public.showing_requests add constraint showing_requests_scheduled_shape
  check ((window_choice = 'scheduled') = (scheduled_for is not null));
-- A landlord is in one place at a time: one live request per slot across all
-- of their listings. Requests whose slot has passed no longer collide with
-- future slots, so expired-but-unswept rows are harmless here.
create unique index showing_requests_one_live_per_landlord_slot_uidx
  on public.showing_requests(landlord_id, scheduled_for)
  where scheduled_for is not null and status in ('requested', 'accepted', 'checked_in');

-- Replaces the whole weekly schedule atomically; an empty array clears it.
create function public.set_viewing_hours(hours jsonb)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  saved integer;
begin
  if actor is null or not public.showing_session_access() then
    raise exception 'viewing hours access denied' using errcode = '42501';
  end if;
  if hours is null or jsonb_typeof(hours) <> 'array' or jsonb_array_length(hours) > 7 then
    raise exception 'invalid viewing hours' using errcode = '22023';
  end if;
  delete from public.landlord_viewing_hours where landlord_id = actor;
  insert into public.landlord_viewing_hours(landlord_id, weekday, start_minute, end_minute)
  select actor, (entry->>'weekday')::smallint, (entry->>'startMinute')::smallint, (entry->>'endMinute')::smallint
  from jsonb_array_elements(hours) entry;
  get diagnostics saved = row_count;
  return saved;
end;
$$;
revoke all on function public.set_viewing_hours(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.set_viewing_hours(jsonb) to authenticated;

-- Open slot starts for one landlord, from an hour after `from_at` for
-- `day_count` South African calendar days. Shared by the renter calendar and
-- the booking RPC so both apply the same rules.
create function private.landlord_open_viewing_slots(owner uuid, from_at timestamptz, day_count integer)
returns table(slot_start timestamptz)
language sql stable security definer set search_path = '' as $$
  with days as (
    select (pg_catalog.timezone('Africa/Johannesburg', from_at))::date + offset_days as day
    from pg_catalog.generate_series(0, greatest(least(day_count, 31), 1) - 1) offset_days
  ), candidates as (
    select pg_catalog.timezone('Africa/Johannesburg', days.day + pg_catalog.make_interval(mins => minute_of_day)) as slot_start
    from days
    join public.landlord_viewing_hours hours
      on hours.landlord_id = owner and hours.weekday = extract(dow from days.day)
    cross join lateral pg_catalog.generate_series(hours.start_minute::integer, hours.end_minute::integer - 30, 30) minute_of_day
  )
  select candidates.slot_start
  from candidates
  where candidates.slot_start >= from_at + interval '1 hour'
    and not exists (
      select 1 from public.showing_requests taken
      where taken.landlord_id = owner
        and taken.scheduled_for = candidates.slot_start
        and taken.status in ('requested', 'accepted', 'checked_in')
    )
  order by candidates.slot_start;
$$;
revoke all on function private.landlord_open_viewing_slots(uuid, timestamptz, integer) from public, anon, authenticated, service_role;

-- What a signed-in renter may know about a listing's landlord: whether they set
-- viewing hours, whether it is inside those hours now, and the open slots.
-- Returns null when the listing cannot be booked by this viewer.
create function public.listing_viewing_availability(target_listing_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  viewer uuid := auth.uid();
  listing public.listings%rowtype;
  local_now timestamp := pg_catalog.timezone('Africa/Johannesburg', pg_catalog.statement_timestamp());
  minute_now integer := extract(hour from local_now)::integer * 60 + extract(minute from local_now)::integer;
begin
  if viewer is null or not public.showing_session_access() then
    return null;
  end if;
  select * into listing from public.listings l where l.id = target_listing_id;
  if not found or listing.status <> 'published'
    or exists(select 1 from public.listing_restrictions r where r.listing_id = listing.id and r.restored_at is null)
    or exists(select 1 from public.profile_blocks b
      where (b.blocker_id = viewer and b.blocked_id = listing.landlord_id)
         or (b.blocker_id = listing.landlord_id and b.blocked_id = viewer)) then
    return null;
  end if;
  return jsonb_build_object(
    'hasHours', exists(select 1 from public.landlord_viewing_hours h where h.landlord_id = listing.landlord_id),
    'inHoursNow', exists(select 1 from public.landlord_viewing_hours h
      where h.landlord_id = listing.landlord_id and h.weekday = extract(dow from local_now)
        and minute_now >= h.start_minute and minute_now < h.end_minute),
    'slots', coalesce((
      select jsonb_agg(jsonb_build_object('start', opening.slot_start, 'end', opening.slot_start + interval '30 minutes') order by opening.slot_start)
      from private.landlord_open_viewing_slots(listing.landlord_id, pg_catalog.statement_timestamp(), 14) opening
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.listing_viewing_availability(uuid) from public, anon, authenticated, service_role;
grant execute on function public.listing_viewing_availability(uuid) to authenticated;

-- Same guards and result tags as `private.request_showing`, plus
-- `slot_unavailable` when the slot is outside the landlord's hours, too soon,
-- or was just taken by someone else.
create function private.request_scheduled_showing(target_listing_id uuid, slot_start timestamptz)
returns table(result text, request_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  requester uuid := auth.uid();
  listing public.listings%rowtype;
  owner public.profiles%rowtype;
  existing public.showing_requests%rowtype;
  new_id uuid;
begin
  if requester is null or not public.showing_session_access() then
    return query select 'access_denied'::text, null::uuid; return;
  end if;
  if slot_start is null then
    return query select 'invalid_input'::text, null::uuid; return;
  end if;
  select * into listing from public.listings l where l.id = target_listing_id for update;
  if not found or listing.status <> 'published'
    or exists(select 1 from public.listing_restrictions r where r.listing_id = listing.id and r.restored_at is null) then
    return query select 'listing_unavailable'::text, null::uuid; return;
  end if;
  if listing.landlord_id = requester then
    return query select 'own_listing'::text, null::uuid; return;
  end if;
  if exists(select 1 from public.profile_blocks b
    where (b.blocker_id = requester and b.blocked_id = listing.landlord_id)
       or (b.blocker_id = listing.landlord_id and b.blocked_id = requester)) then
    return query select 'access_denied'::text, null::uuid; return;
  end if;
  select * into owner from public.profiles p where p.id = listing.landlord_id for share;
  if not found or exists(select 1 from public.account_suspensions s where s.user_id = owner.id
    and s.restored_at is null and (s.suspended_until is null or s.suspended_until > statement_timestamp()))
    or exists(select 1 from auth.users u where u.id = owner.id and u.banned_until > statement_timestamp()) then
    return query select 'listing_unavailable'::text, null::uuid; return;
  end if;
  select * into existing from public.showing_requests s
    where s.listing_id = listing.id and s.renter_id = requester and s.status in ('requested', 'accepted', 'checked_in')
    order by s.requested_at desc, s.id limit 1 for update;
  if found then
    if existing.status = 'requested' and existing.expires_at < statement_timestamp() then
      update public.showing_requests set status = 'expired' where id = existing.id;
    else
      return query select 'request_in_progress'::text, existing.id; return;
    end if;
  end if;
  -- 15 days, not 14: a slot shown on the last day of yesterday's calendar stays bookable.
  if not exists(select 1 from private.landlord_open_viewing_slots(owner.id, statement_timestamp(), 15) opening
    where opening.slot_start = request_scheduled_showing.slot_start) then
    return query select 'slot_unavailable'::text, null::uuid; return;
  end if;
  new_id := gen_random_uuid();
  begin
    insert into public.showing_requests(id, listing_id, renter_id, landlord_id, status, window_choice, scheduled_for, expires_at)
      values (new_id, listing.id, requester, listing.landlord_id, 'requested', 'scheduled', request_scheduled_showing.slot_start, request_scheduled_showing.slot_start);
  exception when unique_violation then
    -- Another renter took this slot on one of the landlord's other listings.
    return query select 'slot_unavailable'::text, null::uuid; return;
  end;
  return query select 'requested'::text, new_id;
end;
$$;
revoke all on function private.request_scheduled_showing(uuid, timestamptz) from public, anon, authenticated, service_role;
grant execute on function private.request_scheduled_showing(uuid, timestamptz) to authenticated;

create function public.request_scheduled_showing(target_listing_id uuid, slot_start timestamptz)
returns table(result text, request_id uuid)
language sql security invoker set search_path = '' as $$
  select * from private.request_scheduled_showing(target_listing_id, slot_start);
$$;
revoke all on function public.request_scheduled_showing(uuid, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.request_scheduled_showing(uuid, timestamptz) to authenticated;

-- An accepted showing booked for next week must not keep the landlord from
-- taking a "Right now" request today. Only showings under way or due within
-- 30 minutes count as busy. The rest of the function is unchanged.
create or replace function private.request_showing(target_listing_id uuid,window_choice public.showing_window,eta_minutes int default null)
returns table(result text,request_id uuid)
language plpgsql security definer set search_path='' as $$
declare
  requester uuid:=auth.uid();
  listing public.listings%rowtype;
  owner public.profiles%rowtype;
  existing public.showing_requests%rowtype;
  new_id uuid;
  available_now boolean;
begin
  if requester is null or not public.showing_session_access() then
    return query select 'access_denied'::text,null::uuid;return;
  end if;
  if window_choice is null or window_choice='scheduled' or (eta_minutes is not null and eta_minutes not between 0 and 1440) then
    return query select 'invalid_input'::text,null::uuid;return;
  end if;
  select * into listing from public.listings l where l.id=target_listing_id for update;
  if not found or listing.status<>'published'
    or exists(select 1 from public.listing_restrictions r where r.listing_id=listing.id and r.restored_at is null) then
    return query select 'listing_unavailable'::text,null::uuid;return;
  end if;
  if listing.landlord_id=requester then
    return query select 'own_listing'::text,null::uuid;return;
  end if;
  if exists(select 1 from public.profile_blocks b
    where (b.blocker_id=requester and b.blocked_id=listing.landlord_id)
       or (b.blocker_id=listing.landlord_id and b.blocked_id=requester)) then
    return query select 'access_denied'::text,null::uuid;return;
  end if;
  select * into owner from public.profiles p where p.id=listing.landlord_id for share;
  if not found or exists(select 1 from public.account_suspensions s where s.user_id=owner.id
    and s.restored_at is null and (s.suspended_until is null or s.suspended_until>statement_timestamp()))
    or exists(select 1 from auth.users u where u.id=owner.id and u.banned_until>statement_timestamp()) then
    return query select 'listing_unavailable'::text,null::uuid;return;
  end if;
  select * into existing from public.showing_requests s
    where s.listing_id=listing.id and s.renter_id=requester and s.status in ('requested','accepted','checked_in')
    order by s.requested_at desc,s.id limit 1 for update;
  if found then
    if existing.status='requested' and existing.expires_at<statement_timestamp() then
      update public.showing_requests set status='expired' where id=existing.id;
    else
      return query select 'request_in_progress'::text,existing.id;return;
    end if;
  end if;
  available_now:=
    (owner.availability_mode='available' and owner.last_seen_at>=statement_timestamp()-interval '20 minutes')
    or (owner.availability_mode='auto' and owner.last_seen_at>=statement_timestamp()-interval '90 seconds'
      and not exists(select 1 from public.call_sessions c where c.status in ('ringing','active') and owner.id in (c.caller_id,c.callee_id))
      and not exists(select 1 from public.showing_requests s where s.landlord_id=owner.id and s.status in ('accepted','checked_in')
        and (s.status='checked_in' or s.scheduled_for is null or s.scheduled_for<=statement_timestamp()+interval '30 minutes')));
  if window_choice='now' and not coalesce(available_now,false) then
    return query select 'landlord_unavailable'::text,null::uuid;return;
  end if;
  new_id:=gen_random_uuid();
  insert into public.showing_requests(id,listing_id,renter_id,landlord_id,status,window_choice,eta_minutes,expires_at)
    values(new_id,listing.id,requester,listing.landlord_id,'requested',window_choice,eta_minutes,public.showing_window_expiry(window_choice));
  return query select 'requested'::text,new_id;
end;
$$;

notify pgrst, 'reload schema';
commit;
