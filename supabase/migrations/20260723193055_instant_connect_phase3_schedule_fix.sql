-- Qualify the scheduled timestamp inside the function because its RETURNS
-- TABLE column is also named scheduled_at.

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
  scheduled_enabled boolean;
begin
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
  where id = target_listing_id;

  if listing.id is null or listing.landlord_id <> requester then
    return query
      select 'access_denied'::text, null::uuid, null::timestamptz;
    return;
  end if;

  if listing.status <> 'published' then
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

revoke all on function public.schedule_live_tour(
  uuid, uuid, text, text, timestamptz, integer
) from public, anon, authenticated;
grant execute on function public.schedule_live_tour(
  uuid, uuid, text, text, timestamptz, integer
) to authenticated;
