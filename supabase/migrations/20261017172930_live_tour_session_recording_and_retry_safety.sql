begin;

-- Derived caller identity only: a signed JWT cannot outlive its Auth session.
create function public.live_tour_session_access() returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce(private.rental_viewing_account_eligible(auth.uid(),nullif(auth.jwt()->>'session_id','')::uuid),false);
$$;
revoke all on function public.live_tour_session_access() from public,anon,authenticated,service_role;
grant execute on function public.live_tour_session_access() to authenticated,service_role,postgres;
create policy "Live tour sessions only" on public.live_tours
  as restrictive for select to authenticated using ((select public.live_tour_session_access()));
create policy "Live recording consent sessions only" on public.live_tour_recording_consents
  as restrictive for select to authenticated using ((select public.live_tour_session_access()));

create function private.live_tour_listing_available(target_listing uuid,expected_host uuid)
returns boolean language sql stable security invoker set search_path='' as $$
  select exists(select 1 from public.listings l join auth.users u on u.id=l.landlord_id
    where l.id=target_listing and l.landlord_id=expected_host and l.status='published'
      and not coalesce(u.is_anonymous,false)
      and (u.banned_until is null or u.banned_until<=statement_timestamp())
      and not exists(select 1 from public.account_suspensions a where a.user_id=u.id and a.restored_at is null
        and (a.suspended_until is null or a.suspended_until>statement_timestamp()))
      and not exists(select 1 from public.listing_restrictions r where r.listing_id=l.id and r.restored_at is null));
$$;
revoke all on function private.live_tour_listing_available(uuid,uuid) from public,anon,authenticated,service_role;
-- The existing presence authorizer retains its postgres owner. That trusted
-- definer needs the predicate; browser roles receive no direct grant.
grant execute on function private.live_tour_listing_available(uuid,uuid) to postgres;

-- Owners retain management access; public viewers lose room access as soon as
-- publication, restrictions or host account eligibility changes.
create function public.live_tour_listing_visible(target_listing uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce((select private.live_tour_listing_available(l.id,l.landlord_id)
    from public.listings l where l.id=target_listing),false);
$$;
revoke all on function public.live_tour_listing_visible(uuid) from public,anon,authenticated,service_role;
grant execute on function public.live_tour_listing_visible(uuid) to authenticated,postgres;
create policy "Available tour listings for viewers" on public.live_tours
  as restrictive for select to authenticated
  using (host_id=(select auth.uid()) or public.live_tour_listing_visible(listing_id));

-- Bind withdrawal to the participant set validated for this recording attempt.
-- This private working set exposes no historical participant identities through
-- the public tour row. It is not a media-provider roster or recording proof.
create table private.live_tour_recording_participants (
  tour_id uuid not null references public.live_tours(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key(tour_id,user_id)
);
alter table private.live_tour_recording_participants enable row level security;
alter table private.live_tour_recording_participants force row level security;
revoke all on private.live_tour_recording_participants from public,anon,authenticated,service_role;

create function private.start_live_tour(
  target_listing_id uuid,
  target_tour_id uuid,
  target_room_id text,
  target_join_url text
)
returns table (
  result text,
  tour_id uuid,
  room_id text,
  join_url text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester uuid := auth.uid();
  listing public.listings%rowtype;
  active_tour public.live_tours%rowtype;
  expected_room_id text := 'roomza-tour-' || replace(target_tour_id::text, '-', '');
  expected_join_url text;
begin
  if not coalesce(private.rental_viewing_account_eligible(auth.uid(),nullif(auth.jwt()->>'session_id','')::uuid),false) then
    return query select 'access_denied'::text,null::uuid,null::text,null::text; return;
  end if;
  if requester is null then
    return query
      select 'unauthenticated'::text, null::uuid, null::text, null::text;
    return;
  end if;

  select *
  into listing
  from public.listings
  where id = target_listing_id for update;

  if listing.id is null or listing.landlord_id <> requester then
    return query
      select 'access_denied'::text, null::uuid, null::text, null::text;
    return;
  end if;

  if not private.live_tour_listing_available(target_listing_id,requester) then
    return query
      select 'listing_unavailable'::text, null::uuid, null::text, null::text;
    return;
  end if;

  expected_join_url := 'https://meet.jit.si/' || expected_room_id;
  if target_tour_id is null
    or target_room_id is distinct from expected_room_id
    or target_join_url is distinct from expected_join_url then
    return query
      select 'invalid_room'::text, null::uuid, null::text, null::text;
    return;
  end if;

  select *
  into active_tour
  from public.live_tours
  where listing_id = target_listing_id
    and status = 'live'
  limit 1;

  if active_tour.id is not null then
    return query
      select
        'already_live'::text,
        active_tour.id,
        active_tour.room_id,
        active_tour.join_url;
    return;
  end if;

  begin
    insert into public.live_tours (
      id,
      listing_id,
      host_id,
      room_id,
      join_url
    )
    values (
      target_tour_id,
      target_listing_id,
      requester,
      target_room_id,
      target_join_url
    );
  exception when unique_violation then
    select *
    into active_tour
    from public.live_tours
    where listing_id = target_listing_id
      and status = 'live'
    limit 1;

    if active_tour.id is not null then
      return query
        select
          'already_live'::text,
          active_tour.id,
          active_tour.room_id,
          active_tour.join_url;
      return;
    end if;

    raise;
  end;

  return query
    select
      'started'::text,
      target_tour_id,
      target_room_id,
      target_join_url;
end;
$$;
revoke all on function private.start_live_tour(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function private.start_live_tour(uuid,uuid,text,text) to authenticated;

create or replace function public.start_live_tour(
  target_listing_id uuid,
  target_tour_id uuid,
  target_room_id text,
  target_join_url text
)
returns table (
  result text,
  tour_id uuid,
  room_id text,
  join_url text
)
language sql security invoker set search_path='' as $$ select * from private.start_live_tour(target_listing_id,target_tour_id,target_room_id,target_join_url); $$;
revoke all on function public.start_live_tour(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.start_live_tour(uuid,uuid,text,text) to authenticated;

create function private.schedule_live_tour(
  target_listing_id uuid,
  target_tour_id uuid,
  target_room_id text,
  target_join_url text,
  target_scheduled_at timestamptz,
  target_duration_minutes integer default 30
)
returns table (
  result text,
  tour_id uuid,
  scheduled_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester uuid := auth.uid();
  listing public.listings%rowtype;
  expected_room_id text :=
    'roomza-tour-' || replace(target_tour_id::text, '-', '');
  expected_join_url text;
  future_tour_count integer;
  existing_tour public.live_tours%rowtype;
  scheduled_enabled boolean;
begin
  if not coalesce(private.rental_viewing_account_eligible(auth.uid(),nullif(auth.jwt()->>'session_id','')::uuid),false) then
    return query select 'access_denied'::text,null::uuid,null::timestamptz; return;
  end if;
  if requester is null then
    return query
      select 'unauthenticated'::text, null::uuid, null::timestamptz;
    return;
  end if;

  select enabled
  into scheduled_enabled
  from public.app_feature_flags
  where key = 'instant_connect_scheduled_tours';

  if not coalesce(scheduled_enabled, false) then
    return query
      select 'feature_disabled'::text, null::uuid, null::timestamptz;
    return;
  end if;

  select *
  into listing
  from public.listings
  where id = target_listing_id for update;

  if listing.id is null or listing.landlord_id <> requester then
    return query
      select 'access_denied'::text, null::uuid, null::timestamptz;
    return;
  end if;

  if not private.live_tour_listing_available(target_listing_id,requester) then
    return query
      select 'listing_unavailable'::text, null::uuid, null::timestamptz;
    return;
  end if;

  if target_scheduled_at is null
    or target_scheduled_at < now() + interval '15 minutes'
    or target_scheduled_at > now() + interval '90 days' then
    return query
      select 'invalid_schedule'::text, null::uuid, null::timestamptz;
    return;
  end if;

  if target_duration_minutes is null
    or target_duration_minutes not between 15 and 120 then
    return query
      select 'invalid_duration'::text, null::uuid, null::timestamptz;
    return;
  end if;

  expected_join_url := 'https://meet.jit.si/' || expected_room_id;
  if target_tour_id is null
    or target_room_id is distinct from expected_room_id
    or target_join_url is distinct from expected_join_url then
    return query
      select 'invalid_room'::text, null::uuid, null::timestamptz;
    return;
  end if;

  -- A lost committed response recovers the existing exact slot. The listing
  -- lock also serializes concurrent retries without modifying that schedule.
  select * into existing_tour from public.live_tours t
    where t.listing_id=target_listing_id and t.host_id=requester and t.status='scheduled'
      and t.scheduled_at=target_scheduled_at and t.scheduled_duration_minutes=target_duration_minutes limit 1;
  if existing_tour.id is not null then
    return query select 'scheduled'::text,existing_tour.id,existing_tour.scheduled_at; return;
  end if;

  select count(*)::integer
  into future_tour_count
  from public.live_tours scheduled_tour
  where scheduled_tour.host_id = requester
    and scheduled_tour.status = 'scheduled'
    and scheduled_tour.scheduled_at > now();

  if future_tour_count >= 20 then
    return query
      select 'schedule_limit'::text, null::uuid, null::timestamptz;
    return;
  end if;

  begin
    insert into public.live_tours (
      id,
      listing_id,
      host_id,
      status,
      room_id,
      join_url,
      scheduled_at,
      scheduled_duration_minutes,
      started_at
    )
    values (
      target_tour_id,
      target_listing_id,
      requester,
      'scheduled',
      target_room_id,
      target_join_url,
      target_scheduled_at,
      target_duration_minutes,
      null
    );
  exception when unique_violation then
    return query
      select 'schedule_conflict'::text, null::uuid, null::timestamptz;
    return;
  end;

  return query
    select 'scheduled'::text, target_tour_id, target_scheduled_at;
end;
$$;
revoke all on function private.schedule_live_tour(uuid,uuid,text,text,timestamptz,integer) from public,anon,authenticated,service_role;
grant execute on function private.schedule_live_tour(uuid,uuid,text,text,timestamptz,integer) to authenticated;

create or replace function public.schedule_live_tour(
  target_listing_id uuid,
  target_tour_id uuid,
  target_room_id text,
  target_join_url text,
  target_scheduled_at timestamptz,
  target_duration_minutes integer default 30
)
returns table (
  result text,
  tour_id uuid,
  scheduled_at timestamptz
)
language sql security invoker set search_path='' as $$ select * from private.schedule_live_tour(target_listing_id,target_tour_id,target_room_id,target_join_url,target_scheduled_at,target_duration_minutes); $$;
revoke all on function public.schedule_live_tour(uuid,uuid,text,text,timestamptz,integer) from public,anon,authenticated,service_role;
grant execute on function public.schedule_live_tour(uuid,uuid,text,text,timestamptz,integer) to authenticated;

create function private.start_scheduled_live_tour(
  target_tour_id uuid
)
returns table (
  result text,
  tour_id uuid,
  new_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester uuid := auth.uid();
  tour public.live_tours%rowtype;
begin
  if not coalesce(private.rental_viewing_account_eligible(auth.uid(),nullif(auth.jwt()->>'session_id','')::uuid),false) then
    return query select 'access_denied'::text,null::uuid,null::text; return;
  end if;
  -- Match the listing-to-tour lock order used by starts and scheduling.
  perform 1 from public.listings l where l.id=(select t.listing_id from public.live_tours t where t.id=target_tour_id) for update;
  select *
  into tour
  from public.live_tours
  where id = target_tour_id
  for update;

  if requester is null
    or tour.id is null
    or tour.host_id <> requester then
    return query
      select 'access_denied'::text, null::uuid, null::text;
    return;
  end if;

  if tour.status = 'live' then
    return query
      select 'already_live'::text, tour.id, tour.status::text;
    return;
  end if;

  if not coalesce((select enabled from public.app_feature_flags where key='instant_connect_scheduled_tours'),false) then
    return query select 'feature_disabled'::text,null::uuid,tour.status::text; return;
  end if;
  if not private.live_tour_listing_available(tour.listing_id,requester) then
    return query select 'listing_unavailable'::text,null::uuid,tour.status::text; return;
  end if;

  if tour.status <> 'scheduled' then
    return query
      select 'invalid_state'::text, tour.id, tour.status::text;
    return;
  end if;

  if now() < tour.scheduled_at - interval '30 minutes'
    or now() > tour.scheduled_at
      + make_interval(mins => tour.scheduled_duration_minutes + 120) then
    return query
      select 'outside_start_window'::text, tour.id, tour.status::text;
    return;
  end if;

  if exists (
    select 1
    from public.live_tours active
    where active.listing_id = tour.listing_id
      and active.status = 'live'
      and active.id <> tour.id
  ) then
    return query
      select 'already_live'::text, tour.id, tour.status::text;
    return;
  end if;

  update public.live_tours
  set
    status = 'live',
    started_at = now()
  where id = target_tour_id;

  return query
    select 'started'::text, target_tour_id, 'live'::text;
end;
$$;
revoke all on function private.start_scheduled_live_tour(uuid) from public,anon,authenticated,service_role;
grant execute on function private.start_scheduled_live_tour(uuid) to authenticated;

create or replace function public.start_scheduled_live_tour(
  target_tour_id uuid
)
returns table (
  result text,
  tour_id uuid,
  new_status text
)
language sql security invoker set search_path='' as $$ select * from private.start_scheduled_live_tour(target_tour_id); $$;
revoke all on function public.start_scheduled_live_tour(uuid) from public,anon,authenticated,service_role;
grant execute on function public.start_scheduled_live_tour(uuid) to authenticated;

create function private.cancel_scheduled_live_tour(
  target_tour_id uuid
)
returns table (
  result text,
  tour_id uuid,
  new_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester uuid := auth.uid();
  tour public.live_tours%rowtype;
begin
  if not coalesce(private.rental_viewing_account_eligible(auth.uid(),nullif(auth.jwt()->>'session_id','')::uuid),false) then
    return query select 'access_denied'::text,null::uuid,null::text; return;
  end if;
  -- Match the listing-to-tour lock order used by starts and scheduling.
  perform 1 from public.listings l where l.id=(select t.listing_id from public.live_tours t where t.id=target_tour_id) for update;
  select *
  into tour
  from public.live_tours
  where id = target_tour_id
  for update;

  if requester is null
    or tour.id is null
    or tour.host_id <> requester then
    return query
      select 'access_denied'::text, null::uuid, null::text;
    return;
  end if;

  if tour.status = 'cancelled' then
    return query
      select 'noop'::text, tour.id, tour.status::text;
    return;
  end if;

  if tour.status <> 'scheduled' then
    return query
      select 'invalid_state'::text, tour.id, tour.status::text;
    return;
  end if;

  update public.live_tours
  set
    status = 'cancelled',
    ended_at = now()
  where id = target_tour_id;

  return query
    select 'cancelled'::text, target_tour_id, 'cancelled'::text;
end;
$$;
revoke all on function private.cancel_scheduled_live_tour(uuid) from public,anon,authenticated,service_role;
grant execute on function private.cancel_scheduled_live_tour(uuid) to authenticated;

create or replace function public.cancel_scheduled_live_tour(
  target_tour_id uuid
)
returns table (
  result text,
  tour_id uuid,
  new_status text
)
language sql security invoker set search_path='' as $$ select * from private.cancel_scheduled_live_tour(target_tour_id); $$;
revoke all on function public.cancel_scheduled_live_tour(uuid) from public,anon,authenticated,service_role;
grant execute on function public.cancel_scheduled_live_tour(uuid) to authenticated;

create function private.end_live_tour(
  target_tour_id uuid,
  observed_peak_viewers integer default 0
)
returns table (
  result text,
  tour_id uuid,
  new_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester uuid := auth.uid();
  tour public.live_tours%rowtype;
begin
  if not coalesce(private.rental_viewing_account_eligible(auth.uid(),nullif(auth.jwt()->>'session_id','')::uuid),false) then
    return query select 'access_denied'::text,null::uuid,null::text; return;
  end if;
  -- Match the listing-to-tour lock order used by starts and scheduling.
  perform 1 from public.listings l where l.id=(select t.listing_id from public.live_tours t where t.id=target_tour_id) for update;
  select *
  into tour
  from public.live_tours
  where id = target_tour_id
  for update;

  if requester is null
    or tour.id is null
    or tour.host_id <> requester then
    return query
      select 'access_denied'::text, null::uuid, null::text;
    return;
  end if;

  if tour.status = 'ended' then
    return query
      select 'noop'::text, tour.id, tour.status::text;
    return;
  end if;

  if tour.status <> 'live' then
    return query
      select 'invalid_state'::text, tour.id, tour.status::text;
    return;
  end if;

  update public.live_tours
  set
    status = 'ended',
    ended_at = now(),
    peak_viewers = greatest(
      peak_viewers,
      least(10000, greatest(0, coalesce(observed_peak_viewers, 0)))
    ),
    recording_status = case
      when recording_status = 'recording'
        then 'stopped'::public.live_tour_recording_status
      else recording_status
    end,
    recording_ended_at = case
      when recording_status = 'recording' then now()
      else recording_ended_at
    end,
    recording_retention_expires_at = case
      when recording_status = 'recording' then now() + interval '30 days'
      else recording_retention_expires_at
    end
  where id = target_tour_id;

  return query
    select 'ended'::text, target_tour_id, 'ended'::text;
end;
$$;
revoke all on function private.end_live_tour(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function private.end_live_tour(uuid,integer) to authenticated;

create or replace function public.end_live_tour(
  target_tour_id uuid,
  observed_peak_viewers integer default 0
)
returns table (
  result text,
  tour_id uuid,
  new_status text
)
language sql security invoker set search_path='' as $$ select * from private.end_live_tour(target_tour_id,observed_peak_viewers); $$;
revoke all on function public.end_live_tour(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.end_live_tour(uuid,integer) to authenticated;

create function private.set_live_tour_recording_consent(
  target_tour_id uuid,
  target_granted boolean,
  target_policy_version text default 'phase3-v1'
)
returns table (
  result text,
  tour_id uuid,
  granted boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester uuid := auth.uid();
  tour public.live_tours%rowtype;
  can_stop boolean;
begin
  if not coalesce(private.rental_viewing_account_eligible(auth.uid(),nullif(auth.jwt()->>'session_id','')::uuid),false) then
    return query select 'access_denied'::text,null::uuid,false; return;
  end if;
  -- Match the listing-to-tour lock order used by starts and scheduling.
  perform 1 from public.listings l where l.id=(select t.listing_id from public.live_tours t where t.id=target_tour_id) for update;
  if requester is null then
    return query
      select 'unauthenticated'::text, null::uuid, false;
    return;
  end if;

  select *
  into tour
  from public.live_tours
  where id = target_tour_id for update;

  if tour.id is null
    or not private.live_tour_listing_available(tour.listing_id,tour.host_id)
    or tour.status <> 'live'
    or not exists (
      select 1
      from public.listings
      where listings.id = tour.listing_id
        and listings.status = 'published'
    ) then
    return query
      select 'tour_unavailable'::text, null::uuid, false;
    return;
  end if;

  if target_granted is null
    or target_policy_version is null
    or char_length(target_policy_version) not between 3 and 80
    or (target_granted and target_policy_version<>'phase3-v1') then
    return query
      select 'invalid_consent'::text, null::uuid, false;
    return;
  end if;

  select exists(select 1 from private.live_tour_recording_participants p where p.tour_id=target_tour_id and p.user_id=requester)
    or (not exists(select 1 from private.live_tour_recording_participants p where p.tour_id=target_tour_id)
      and exists(select 1 from public.live_tour_recording_consents c where c.tour_id=target_tour_id and c.user_id=requester and c.granted)) into can_stop;

  insert into public.live_tour_recording_consents (
    tour_id,
    user_id,
    granted,
    policy_version,
    consented_at,
    revoked_at,
    updated_at
  )
  values (
    target_tour_id,
    requester,
    target_granted,
    target_policy_version,
    case when target_granted then now() else null end,
    case when target_granted then null else now() end,
    now()
  )
  on conflict on constraint live_tour_recording_consents_pkey do update
  set
    granted = excluded.granted,
    policy_version = excluded.policy_version,
    consented_at = excluded.consented_at,
    revoked_at = excluded.revoked_at,
    updated_at = excluded.updated_at;

  -- Consent withdrawal stops the persisted recording atomically, even if
  -- the host browser is offline. Existing recording metadata is retained.
  if not target_granted and can_stop then
    update public.live_tours set recording_status='stopped',recording_ended_at=now(),
      recording_retention_expires_at=coalesce(recording_retention_expires_at,now()+interval '30 days')
      where id=target_tour_id and recording_status='recording';
  end if;

  insert into public.consent_events (
    user_id,
    consent_key,
    granted,
    source
  )
  values (
    requester,
    'live_tour_recording',
    target_granted,
    'live_tour'
  );

  return query
    select 'updated'::text, target_tour_id, target_granted;
end;
$$;
revoke all on function private.set_live_tour_recording_consent(uuid,boolean,text) from public,anon,authenticated,service_role;
grant execute on function private.set_live_tour_recording_consent(uuid,boolean,text) to authenticated;

create or replace function public.set_live_tour_recording_consent(
  target_tour_id uuid,
  target_granted boolean,
  target_policy_version text default 'phase3-v1'
)
returns table (
  result text,
  tour_id uuid,
  granted boolean
)
language sql security invoker set search_path='' as $$ select * from private.set_live_tour_recording_consent(target_tour_id,target_granted,target_policy_version); $$;
revoke all on function public.set_live_tour_recording_consent(uuid,boolean,text) from public,anon,authenticated,service_role;
grant execute on function public.set_live_tour_recording_consent(uuid,boolean,text) to authenticated;

create function private.start_live_tour_recording(
  target_tour_id uuid,
  target_participant_ids uuid[]
)
returns table (
  result text,
  tour_id uuid,
  missing_consents integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester uuid := auth.uid();
  tour public.live_tours%rowtype;
  participant_ids uuid[];
  missing_count integer;
  recording_enabled boolean;
begin
  if not coalesce(private.rental_viewing_account_eligible(auth.uid(),nullif(auth.jwt()->>'session_id','')::uuid),false) then
    return query select 'access_denied'::text,null::uuid,0; return;
  end if;
  -- Match the listing-to-tour lock order used by starts and scheduling.
  perform 1 from public.listings l where l.id=(select t.listing_id from public.live_tours t where t.id=target_tour_id) for update;
  select *
  into tour
  from public.live_tours
  where id = target_tour_id
  for update;

  if requester is null
    or tour.id is null
    or tour.host_id <> requester then
    return query
      select 'access_denied'::text, null::uuid, 0;
    return;
  end if;

  select enabled
  into recording_enabled
  from public.app_feature_flags
  where key = 'instant_connect_recording';

  if not coalesce(recording_enabled, false) then
    return query
      select 'feature_disabled'::text, tour.id, 0;
    return;
  end if;

  if not private.live_tour_listing_available(tour.listing_id,requester) then
    return query select 'tour_unavailable'::text,tour.id,0; return;
  end if;

  if tour.status <> 'live' then
    return query
      select 'tour_unavailable'::text, tour.id, 0;
    return;
  end if;

  if coalesce(array_length(target_participant_ids, 1), 0) > 250 then
    return query
      select 'too_many_participants'::text, tour.id, 0;
    return;
  end if;

  select array_agg(distinct participant_id)
  into participant_ids
  from unnest(
    array_append(
      coalesce(target_participant_ids, array[]::uuid[]),
      requester
    )
  ) participant_id;

  if coalesce(array_length(participant_ids, 1), 0) < 2 then
    return query
      select 'viewer_required'::text, tour.id, 1;
    return;
  end if;

  select count(*)::integer
  into missing_count
  from unnest(participant_ids) participant_id
  where not exists (
    select 1
    from public.live_tour_recording_consents
    where live_tour_recording_consents.tour_id = target_tour_id
      and live_tour_recording_consents.user_id = participant_id
      and live_tour_recording_consents.policy_version='phase3-v1'
      and live_tour_recording_consents.granted
      and live_tour_recording_consents.revoked_at is null
  );

  if missing_count > 0 then
    if tour.recording_status='recording' then
      update public.live_tours set recording_status='stopped',recording_ended_at=now(),
        recording_retention_expires_at=coalesce(recording_retention_expires_at,now()+interval '30 days') where id=target_tour_id;
    elsif tour.recording_started_at is null and tour.recording_ended_at is null then
      update public.live_tours set recording_status='awaiting_consent' where id=target_tour_id;
    end if;

    return query
      select 'consent_required'::text, tour.id, missing_count;
    return;
  end if;

  if tour.recording_status='recording' then
    insert into private.live_tour_recording_participants(tour_id,user_id)
      select target_tour_id,participant_id from unnest(participant_ids) participant_id on conflict do nothing;
    return query select 'recording'::text,tour.id,0; return;
  end if;
  delete from private.live_tour_recording_participants p where p.tour_id=target_tour_id;
  insert into private.live_tour_recording_participants(tour_id,user_id)
    select target_tour_id,participant_id from unnest(participant_ids) participant_id;

  update public.live_tours
  set
    recording_status = 'recording',
    recording_started_at = now(),
    recording_ended_at = null,
    recording_retention_expires_at = null,
    recording_error = null
  where id = target_tour_id;

  return query
    select 'recording'::text, tour.id, 0;
end;
$$;
revoke all on function private.start_live_tour_recording(uuid,uuid[]) from public,anon,authenticated,service_role;
grant execute on function private.start_live_tour_recording(uuid,uuid[]) to authenticated;

create or replace function public.start_live_tour_recording(
  target_tour_id uuid,
  target_participant_ids uuid[]
)
returns table (
  result text,
  tour_id uuid,
  missing_consents integer
)
language sql security invoker set search_path='' as $$ select * from private.start_live_tour_recording(target_tour_id,target_participant_ids); $$;
revoke all on function public.start_live_tour_recording(uuid,uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.start_live_tour_recording(uuid,uuid[]) to authenticated;

create function private.finish_live_tour_recording(
  target_tour_id uuid,
  target_result text,
  target_error text default null
)
returns table (
  result text,
  tour_id uuid,
  new_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester uuid := auth.uid();
  tour public.live_tours%rowtype;
  next_status public.live_tour_recording_status;
begin
  if not coalesce(private.rental_viewing_account_eligible(auth.uid(),nullif(auth.jwt()->>'session_id','')::uuid),false) then
    return query select 'access_denied'::text,null::uuid,null::text; return;
  end if;
  -- Match the listing-to-tour lock order used by starts and scheduling.
  perform 1 from public.listings l where l.id=(select t.listing_id from public.live_tours t where t.id=target_tour_id) for update;
  select *
  into tour
  from public.live_tours
  where id = target_tour_id
  for update;

  if requester is null
    or tour.id is null
    or tour.host_id <> requester then
    return query
      select 'access_denied'::text, null::uuid, null::text;
    return;
  end if;

  if target_result is null or target_result not in ('stopped', 'failed') then
    return query
      select 'invalid_result'::text, tour.id, tour.recording_status::text;
    return;
  end if;

  if tour.recording_status in ('stopped','failed') then
    return query select tour.recording_status::text,tour.id,tour.recording_status::text; return;
  end if;

  if tour.recording_status <> 'recording' then
    return query
      select 'invalid_state'::text, tour.id, tour.recording_status::text;
    return;
  end if;

  next_status := target_result::public.live_tour_recording_status;

  update public.live_tours
  set
    recording_status = next_status,
    recording_ended_at = now(),
    recording_retention_expires_at = case
      when next_status = 'stopped' then now() + interval '30 days'
      else null
    end,
    recording_error = case
      when next_status = 'failed'
        then left(coalesce(target_error, 'Recording provider failed.'), 1000)
      else null
    end
  where id = target_tour_id;

  return query
    select target_result, tour.id, next_status::text;
end;
$$;
revoke all on function private.finish_live_tour_recording(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function private.finish_live_tour_recording(uuid,text,text) to authenticated;

create or replace function public.finish_live_tour_recording(
  target_tour_id uuid,
  target_result text,
  target_error text default null
)
returns table (
  result text,
  tour_id uuid,
  new_status text
)
language sql security invoker set search_path='' as $$ select * from private.finish_live_tour_recording(target_tour_id,target_result,target_error); $$;
revoke all on function public.finish_live_tour_recording(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.finish_live_tour_recording(uuid,text,text) to authenticated;

create function private.set_live_tour_recording_link(
  target_tour_id uuid,
  target_recording_url text,
  target_external_id text default null
)
returns table (
  result text,
  tour_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester uuid := auth.uid();
  tour public.live_tours%rowtype;
begin
  if not coalesce(private.rental_viewing_account_eligible(auth.uid(),nullif(auth.jwt()->>'session_id','')::uuid),false) then
    return query select 'access_denied'::text,null::uuid; return;
  end if;
  -- Match the listing-to-tour lock order used by starts and scheduling.
  perform 1 from public.listings l where l.id=(select t.listing_id from public.live_tours t where t.id=target_tour_id) for update;
  select *
  into tour
  from public.live_tours
  where id = target_tour_id
  for update;

  if requester is null
    or tour.id is null
    or tour.host_id <> requester then
    return query
      select 'access_denied'::text, null::uuid;
    return;
  end if;

  if not coalesce((select enabled from public.app_feature_flags where key='instant_connect_recording'),false)
    or not private.live_tour_listing_available(tour.listing_id,requester)
    or tour.recording_status<>'stopped' or tour.recording_started_at is null or tour.recording_ended_at is null then
    return query select 'recording_unavailable'::text,tour.id; return;
  end if;

  if target_recording_url is null
    or char_length(target_recording_url) > 2000
    or target_recording_url !~ '^https://' then
    return query
      select 'invalid_url'::text, tour.id;
    return;
  end if;

  update public.live_tours
  set
    recording_url = target_recording_url,
    recording_external_id = left(target_external_id, 500),
    recording_retention_expires_at = coalesce(
      recording_retention_expires_at,
      now() + interval '30 days'
    )
  where id = target_tour_id;

  return query
    select 'saved'::text, tour.id;
end;
$$;
revoke all on function private.set_live_tour_recording_link(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function private.set_live_tour_recording_link(uuid,text,text) to authenticated;

create or replace function public.set_live_tour_recording_link(
  target_tour_id uuid,
  target_recording_url text,
  target_external_id text default null
)
returns table (
  result text,
  tour_id uuid
)
language sql security invoker set search_path='' as $$ select * from private.set_live_tour_recording_link(target_tour_id,target_recording_url,target_external_id); $$;
revoke all on function public.set_live_tour_recording_link(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.set_live_tour_recording_link(uuid,text,text) to authenticated;

-- Realtime authorization is subject to the same live account/session boundary.
create or replace function private.can_access_live_tour_presence(target_topic text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare target_tour uuid;
begin
  if not public.live_tour_session_access() or target_topic is null
    or target_topic !~ '^presence:tour:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then return false; end if;
  target_tour:=replace(target_topic,'presence:tour:','')::uuid;
  return exists(select 1 from public.live_tours t where t.id=target_tour and t.status='live'
    and private.live_tour_listing_available(t.listing_id,t.host_id));
end; $$;
revoke all on function private.can_access_live_tour_presence(text) from public,anon,authenticated,service_role;
grant execute on function private.can_access_live_tour_presence(text) to authenticated;

-- Serialize notification creation with the same listing/tour locks as cancellation.
-- Service callers supply audience IDs, but cannot bypass the current tour state.
create or replace function private.record_scheduled_live_tour_notifications(
  target_tour_id uuid,
  target_scheduled_at timestamptz,
  target_kind text,
  target_recipient_ids uuid[],
  target_message text
)
returns table(result text, event_ids uuid[])
language plpgsql
security definer
set search_path = ''
as $$
declare
  listing_uuid uuid;
  current_tour public.live_tours%rowtype;
  scheduling_enabled boolean;
  created_ids uuid[];
begin
  if target_kind not in ('live_tour_scheduled','live_tour_reminder')
    or target_kind is null or target_scheduled_at is null
    or cardinality(target_recipient_ids)>3000
    or target_message is null or length(target_message)>2000 then
    return query select 'invalid_parameters'::text, '{}'::uuid[];
    return;
  end if;
  select t.listing_id into listing_uuid from public.live_tours t where t.id=target_tour_id;
  if listing_uuid is null then
    return query select 'skipped'::text, '{}'::uuid[];
    return;
  end if;
  perform 1 from public.listings l where l.id=listing_uuid for update;
  select t.* into current_tour from public.live_tours t where t.id=target_tour_id for update;
  select f.enabled into scheduling_enabled from public.app_feature_flags f
    where f.key='instant_connect_scheduled_tours' for share;
  if current_tour.id is null or current_tour.status<>'scheduled'
    or current_tour.scheduled_at is distinct from target_scheduled_at
    or current_tour.scheduled_at<=now()
    or not coalesce(scheduling_enabled,false)
    or not private.live_tour_listing_available(current_tour.listing_id,current_tour.host_id)
    or (target_kind='live_tour_reminder' and current_tour.reminder_sent_at is not null) then
    return query select 'skipped'::text, '{}'::uuid[];
    return;
  end if;
  with inserted as (
    insert into public.notification_events(
      recipient_id,actor_id,category,source_kind,source_id,type,idempotency_key,payload
    )
    select distinct recipient_id,current_tour.host_id,'viewings'::public.notification_category,'tour',current_tour.id,
      target_kind::public.notification_type,target_kind||':'||current_tour.id::text||':'||recipient_id::text,
      jsonb_build_object('tourId',current_tour.id,'listingId',current_tour.listing_id,
        'scheduledAt',current_tour.scheduled_at,'message',target_message)
    from unnest(coalesce(target_recipient_ids,'{}'::uuid[])) as audience(recipient_id)
    where recipient_id is not null and recipient_id<>current_tour.host_id
    on conflict(idempotency_key) where idempotency_key is not null do nothing
    returning id
  ) select coalesce(array_agg(id),'{}'::uuid[]) into created_ids from inserted;
  return query select 'recorded'::text, created_ids;
end;
$$;
revoke all on function private.record_scheduled_live_tour_notifications(uuid,timestamptz,text,uuid[],text) from public,anon,authenticated,service_role;
grant execute on function private.record_scheduled_live_tour_notifications(uuid,timestamptz,text,uuid[],text) to service_role;

create or replace function public.record_scheduled_live_tour_notifications(
  target_tour_id uuid,
  target_scheduled_at timestamptz,
  target_kind text,
  target_recipient_ids uuid[],
  target_message text
)
returns table(result text,event_ids uuid[])
language sql
security invoker
set search_path = ''
as $$
  select * from private.record_scheduled_live_tour_notifications(
    target_tour_id,target_scheduled_at,target_kind,target_recipient_ids,target_message
  );
$$;
revoke all on function public.record_scheduled_live_tour_notifications(uuid,timestamptz,text,uuid[],text) from public,anon,authenticated,service_role;
grant execute on function public.record_scheduled_live_tour_notifications(uuid,timestamptz,text,uuid[],text) to service_role;

-- Historical room URLs, roster and recording metadata remain host-only.
-- A live eligible viewer receives only the final status and public listing link.
create or replace function private.get_live_tour_terminal_state(target_tour_id uuid)
returns table(status public.live_tour_status,listing_id uuid)
language sql stable security definer set search_path = '' as $$
  select t.status,t.listing_id from public.live_tours t
  where t.id=target_tour_id and t.status in ('ended','cancelled')
    and coalesce(private.rental_viewing_account_eligible(auth.uid(),nullif(auth.jwt()->>'session_id','')::uuid),false)
    and private.live_tour_listing_available(t.listing_id,t.host_id)
  limit 1;
$$;
revoke all on function private.get_live_tour_terminal_state(uuid) from public,anon,authenticated,service_role;
grant execute on function private.get_live_tour_terminal_state(uuid) to authenticated;
create or replace function public.get_live_tour_terminal_state(target_tour_id uuid)
returns table(status public.live_tour_status,listing_id uuid)
language sql stable security invoker set search_path = '' as $$
  select * from private.get_live_tour_terminal_state(target_tour_id);
$$;
revoke all on function public.get_live_tour_terminal_state(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_live_tour_terminal_state(uuid) to authenticated;

-- Public projections retain their safe shape while suppressing unavailable hosts.
create or replace function public.get_active_public_live_tour(
  target_listing_id uuid
)
returns table (
  tour_id uuid,
  listing_id uuid,
  started_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select live_tours.id, live_tours.listing_id, live_tours.started_at
  from public.live_tours
  join public.listings
    on listings.id = live_tours.listing_id
  where live_tours.listing_id = target_listing_id
    and live_tours.status = 'live'
    and listings.status = 'published'
    and private.live_tour_listing_available(listings.id,listings.landlord_id)
    and not exists (
      select 1
      from public.listing_restrictions
      where listing_restrictions.listing_id = listings.id
        and listing_restrictions.restored_at is null
    )
  limit 1;
$$;

create or replace function public.get_active_public_live_tours(
  target_listing_ids uuid[]
)
returns table (
  tour_id uuid,
  listing_id uuid,
  started_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(array_length(target_listing_ids, 1), 0) > 250 then
    raise exception 'Too many listing ids' using errcode = '22023';
  end if;

  return query
    select live_tours.id, live_tours.listing_id, live_tours.started_at
    from public.live_tours
    join public.listings
      on listings.id = live_tours.listing_id
    where live_tours.listing_id = any(coalesce(target_listing_ids, array[]::uuid[]))
      and live_tours.status = 'live'
      and listings.status = 'published'
    and private.live_tour_listing_available(listings.id,listings.landlord_id)
      and not exists (
        select 1
        from public.listing_restrictions
        where listing_restrictions.listing_id = listings.id
          and listing_restrictions.restored_at is null
      );
end;
$$;

create or replace function public.get_upcoming_public_live_tour(
  target_listing_id uuid
)
returns table (
  tour_id uuid,
  listing_id uuid,
  scheduled_at timestamptz,
  duration_minutes integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    live_tours.id,
    live_tours.listing_id,
    live_tours.scheduled_at,
    live_tours.scheduled_duration_minutes
  from public.live_tours
  join public.listings
    on listings.id = live_tours.listing_id
  where live_tours.listing_id = target_listing_id
    and live_tours.status = 'scheduled'
    and live_tours.scheduled_at >= now() - interval '30 minutes'
    and exists (
      select 1
      from public.app_feature_flags
      where key = 'instant_connect_scheduled_tours'
        and enabled
    )
    and listings.status = 'published'
    and private.live_tour_listing_available(listings.id,listings.landlord_id)
    and not exists (
      select 1
      from public.listing_restrictions
      where listing_restrictions.listing_id = listings.id
        and listing_restrictions.restored_at is null
    )
  order by live_tours.scheduled_at
  limit 1;
$$;

create or replace function public.get_upcoming_public_live_tours(
  target_listing_ids uuid[]
)
returns table (
  tour_id uuid,
  listing_id uuid,
  scheduled_at timestamptz,
  duration_minutes integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(array_length(target_listing_ids, 1), 0) > 250 then
    raise exception 'Too many listing ids' using errcode = '22023';
  end if;

  return query
    select distinct on (live_tours.listing_id)
      live_tours.id,
      live_tours.listing_id,
      live_tours.scheduled_at,
      live_tours.scheduled_duration_minutes
    from public.live_tours
    join public.listings
      on listings.id = live_tours.listing_id
    where live_tours.listing_id =
      any(coalesce(target_listing_ids, array[]::uuid[]))
      and live_tours.status = 'scheduled'
      and live_tours.scheduled_at >= now() - interval '30 minutes'
      and exists (
        select 1
        from public.app_feature_flags
        where key = 'instant_connect_scheduled_tours'
          and enabled
      )
      and listings.status = 'published'
    and private.live_tour_listing_available(listings.id,listings.landlord_id)
      and not exists (
        select 1
        from public.listing_restrictions
        where listing_restrictions.listing_id = listings.id
          and listing_restrictions.restored_at is null
      )
    order by live_tours.listing_id, live_tours.scheduled_at;
end;
$$;

create or replace function public.get_public_live_tour_status(
  target_tour_id uuid
)
returns table(status public.live_tour_status)
language sql
stable
security definer
set search_path = ''
as $$
  select live_tours.status
  from public.live_tours
  join public.listings
    on listings.id = live_tours.listing_id
  where live_tours.id = target_tour_id
    and listings.status = 'published'
    and private.live_tour_listing_available(listings.id,listings.landlord_id)
    and not exists (
      select 1
      from public.listing_restrictions
      where listing_restrictions.listing_id = live_tours.listing_id
        and listing_restrictions.restored_at is null
    )
  limit 1;
$$;

create or replace function public.get_public_listing_live_activity(
  target_listing_id uuid
)
returns table (
  viewed_today integer,
  viewing_now integer,
  last_scheduled_at timestamptz,
  last_rented_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select listings.id
    from public.listings
    where listings.id = target_listing_id
      and listings.status = 'published'
    and private.live_tour_listing_available(listings.id,listings.landlord_id)
      and not exists (
        select 1
        from public.listing_restrictions
        where listing_restrictions.listing_id = listings.id
          and listing_restrictions.restored_at is null
      )
  ),
  analytics as (
    select
      count(*) filter (
        where analytics_events.event_name = 'listing_view'
          and analytics_events.created_at >= date_trunc('day', now())
      )::integer as viewed_today,
      count(distinct coalesce(
        analytics_events.user_id::text,
        analytics_events.id::text
      )) filter (
        where analytics_events.event_name = 'listing_view'
          and analytics_events.created_at >= now() - interval '15 minutes'
      )::integer as recent_viewers,
      max(analytics_events.created_at) filter (
        where analytics_events.event_name = 'listing_rented'
      ) as last_rented_at
    from target
    left join public.analytics_events
      on analytics_events.properties ->> 'listingId' = target.id::text
      and analytics_events.event_name in ('listing_view', 'listing_rented')
      and analytics_events.created_at >= now() - interval '90 days'
  ),
  showings as (
    select
      count(showing_requests.id)::integer as active_count,
      max(showing_requests.requested_at) as last_requested_at
    from target
    left join public.showing_requests
      on showing_requests.listing_id = target.id
      and showing_requests.status in ('accepted', 'checked_in')
  ),
  tours as (
    select count(live_tours.id)::integer as active_count
    from target
    left join public.live_tours
      on live_tours.listing_id = target.id
      and live_tours.status = 'live'
  ),
  scheduled as (
    select max(viewings.created_at) as last_created_at
    from target
    left join public.applications
      on applications.listing_id = target.id
    left join public.viewings
      on viewings.application_id = applications.id
      and viewings.status <> 'cancelled'
  )
  select
    analytics.viewed_today,
    least(
      99,
      analytics.recent_viewers + showings.active_count + tours.active_count
    ),
    greatest(showings.last_requested_at, scheduled.last_created_at),
    analytics.last_rented_at
  from analytics, showings, tours, scheduled
  where exists (select 1 from target);
$$;

notify pgrst,'reload schema';
commit;
