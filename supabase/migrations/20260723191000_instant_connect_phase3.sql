-- Instant Connect Phase 3: scheduled open houses, scalable multi-viewer
-- moderation, picture-in-picture support, and legally gated recording
-- consent/state. All writes remain behind participant-first RPC boundaries.

alter table public.live_tours
  alter column started_at drop not null,
  add column scheduled_at timestamptz,
  add column scheduled_duration_minutes integer not null default 30
    check (scheduled_duration_minutes between 15 and 120),
  add column reminder_sent_at timestamptz,
  add column recording_status public.live_tour_recording_status
    not null default 'off',
  add column recording_started_at timestamptz,
  add column recording_ended_at timestamptz,
  add column recording_retention_expires_at timestamptz,
  add column recording_external_id text,
  add column recording_url text,
  add column recording_error text;

alter table public.live_tours
  drop constraint if exists live_tours_end_state_check;

alter table public.live_tours
  add constraint live_tours_lifecycle_check check (
    (
      status = 'scheduled'
      and scheduled_at is not null
      and started_at is null
      and ended_at is null
    )
    or (
      status = 'live'
      and started_at is not null
      and ended_at is null
    )
    or (
      status = 'ended'
      and ended_at is not null
    )
    or (
      status = 'cancelled'
      and scheduled_at is not null
      and started_at is null
      and ended_at is not null
    )
  ),
  add constraint live_tours_recording_state_check check (
    (
      recording_status in ('off', 'awaiting_consent')
      and recording_started_at is null
      and recording_ended_at is null
    )
    or (
      recording_status = 'recording'
      and recording_started_at is not null
      and recording_ended_at is null
    )
    or (
      recording_status in ('stopped', 'failed')
      and recording_ended_at is not null
    )
  ),
  add constraint live_tours_recording_url_check check (
    recording_url is null
    or (
      char_length(recording_url) <= 2000
      and recording_url ~ '^https://'
    )
  ),
  add constraint live_tours_recording_external_id_check check (
    recording_external_id is null
    or char_length(recording_external_id) <= 500
  ),
  add constraint live_tours_recording_error_check check (
    recording_error is null
    or char_length(recording_error) <= 1000
  );

create unique index live_tours_scheduled_slot_uidx
  on public.live_tours(listing_id, scheduled_at)
  where status = 'scheduled';

create index live_tours_upcoming_idx
  on public.live_tours(scheduled_at, listing_id)
  where status = 'scheduled';

create table public.live_tour_recording_consents (
  tour_id uuid not null references public.live_tours(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  granted boolean not null,
  policy_version text not null default 'phase3-v1'
    check (char_length(policy_version) between 3 and 80),
  consented_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (tour_id, user_id),
  constraint live_tour_recording_consent_state_check check (
    (
      granted
      and consented_at is not null
      and revoked_at is null
    )
    or (
      not granted
      and revoked_at is not null
    )
  )
);

alter table public.live_tour_recording_consents enable row level security;
alter table public.live_tour_recording_consents force row level security;

-- Phase 3 alert/reminder workers use the server-only service client. Data API
-- grants are separate from RLS and are required even for service_role.
grant select on table public.listings to service_role;
grant select on table public.user_favorites to service_role;
grant select on table public.search_alerts to service_role;
grant select on table public.notification_preferences to service_role;
grant select, insert, update on table public.notification_events to service_role;
grant select, update on table public.live_tours to service_role;

grant select on table public.live_tour_recording_consents to authenticated;
revoke insert, update, delete on table public.live_tour_recording_consents
  from public, anon, authenticated;

create policy "Tour participants read own recording consent and hosts read roster"
  on public.live_tour_recording_consents for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.live_tours
      where live_tours.id = live_tour_recording_consents.tour_id
        and live_tours.host_id = (select auth.uid())
    )
  );

alter publication supabase_realtime
  add table public.live_tour_recording_consents;

create table public.app_feature_flags (
  key text primary key check (key ~ '^[a-z0-9_]{3,80}$'),
  enabled boolean not null default false,
  description text not null default ''
    check (char_length(description) <= 500),
  updated_at timestamptz not null default now()
);

alter table public.app_feature_flags enable row level security;
alter table public.app_feature_flags force row level security;
revoke all on table public.app_feature_flags from public, anon, authenticated;
grant select, insert, update, delete on table public.app_feature_flags
  to service_role;

insert into public.app_feature_flags (key, enabled, description)
values
  (
    'instant_connect_scheduled_tours',
    true,
    'Scheduled open houses and reminder delivery.'
  ),
  (
    'instant_connect_moderation',
    true,
    'Host moderation controls and scalable viewer roster.'
  ),
  (
    'instant_connect_picture_in_picture',
    true,
    'Document Picture-in-Picture for embedded live tours.'
  ),
  (
    'instant_connect_recording',
    false,
    'Legally approved recording. Keep disabled until legal review is complete.'
  )
on conflict (key) do nothing;

create or replace function public.get_public_instant_connect_phase3_flags()
returns table (
  scheduled_tours boolean,
  moderation boolean,
  picture_in_picture boolean,
  recording boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(
      (
        select enabled
        from public.app_feature_flags
        where key = 'instant_connect_scheduled_tours'
      ),
      false
    ),
    coalesce(
      (
        select enabled
        from public.app_feature_flags
        where key = 'instant_connect_moderation'
      ),
      false
    ),
    coalesce(
      (
        select enabled
        from public.app_feature_flags
        where key = 'instant_connect_picture_in_picture'
      ),
      false
    ),
    coalesce(
      (
        select enabled
        from public.app_feature_flags
        where key = 'instant_connect_recording'
      ),
      false
    );
$$;

revoke all on function public.get_public_instant_connect_phase3_flags()
  from public, anon, authenticated;
grant execute on function public.get_public_instant_connect_phase3_flags()
  to anon, authenticated;

drop policy if exists
  "Authenticated users read active tours and hosts read own history"
  on public.live_tours;

create policy "Authenticated users read public current tours and hosts read history"
  on public.live_tours for select
  to authenticated
  using (
    host_id = (select auth.uid())
    or (
      status in ('scheduled', 'live')
      and exists (
        select 1
        from public.listings
        where listings.id = live_tours.listing_id
          and listings.status = 'published'
      )
      and (select public.is_listing_unrestricted(live_tours.listing_id))
    )
  );

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

create or replace function public.start_scheduled_live_tour(
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

revoke all on function public.start_scheduled_live_tour(uuid)
  from public, anon, authenticated;
grant execute on function public.start_scheduled_live_tour(uuid)
  to authenticated;

create or replace function public.cancel_scheduled_live_tour(
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

revoke all on function public.cancel_scheduled_live_tour(uuid)
  from public, anon, authenticated;
grant execute on function public.cancel_scheduled_live_tour(uuid)
  to authenticated;

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
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester uuid := auth.uid();
  tour public.live_tours%rowtype;
begin
  if requester is null then
    return query
      select 'unauthenticated'::text, null::uuid, false;
    return;
  end if;

  select *
  into tour
  from public.live_tours
  where id = target_tour_id;

  if tour.id is null
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
    or char_length(target_policy_version) not between 3 and 80 then
    return query
      select 'invalid_consent'::text, null::uuid, false;
    return;
  end if;

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

revoke all on function public.set_live_tour_recording_consent(
  uuid, boolean, text
) from public, anon, authenticated;
grant execute on function public.set_live_tour_recording_consent(
  uuid, boolean, text
) to authenticated;

create or replace function public.start_live_tour_recording(
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
      and live_tour_recording_consents.granted
      and live_tour_recording_consents.revoked_at is null
  );

  if missing_count > 0 then
    update public.live_tours
    set recording_status = 'awaiting_consent'
    where id = target_tour_id;

    return query
      select 'consent_required'::text, tour.id, missing_count;
    return;
  end if;

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

revoke all on function public.start_live_tour_recording(uuid, uuid[])
  from public, anon, authenticated;
grant execute on function public.start_live_tour_recording(uuid, uuid[])
  to authenticated;

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
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester uuid := auth.uid();
  tour public.live_tours%rowtype;
  next_status public.live_tour_recording_status;
begin
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

  if target_result not in ('stopped', 'failed') then
    return query
      select 'invalid_result'::text, tour.id, tour.recording_status::text;
    return;
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

revoke all on function public.finish_live_tour_recording(
  uuid, text, text
) from public, anon, authenticated;
grant execute on function public.finish_live_tour_recording(
  uuid, text, text
) to authenticated;

create or replace function public.set_live_tour_recording_link(
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

revoke all on function public.set_live_tour_recording_link(
  uuid, text, text
) from public, anon, authenticated;
grant execute on function public.set_live_tour_recording_link(
  uuid, text, text
) to authenticated;

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
    and not exists (
      select 1
      from public.listing_restrictions
      where listing_restrictions.listing_id = listings.id
        and listing_restrictions.restored_at is null
    )
  order by live_tours.scheduled_at
  limit 1;
$$;

revoke all on function public.get_upcoming_public_live_tour(uuid)
  from public, anon, authenticated;
grant execute on function public.get_upcoming_public_live_tour(uuid)
  to anon, authenticated;

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
      and not exists (
        select 1
        from public.listing_restrictions
        where listing_restrictions.listing_id = listings.id
          and listing_restrictions.restored_at is null
      )
    order by live_tours.listing_id, live_tours.scheduled_at;
end;
$$;

revoke all on function public.get_upcoming_public_live_tours(uuid[])
  from public, anon, authenticated;
grant execute on function public.get_upcoming_public_live_tours(uuid[])
  to anon, authenticated;

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
    and not exists (
      select 1
      from public.listing_restrictions
      where listing_restrictions.listing_id = live_tours.listing_id
        and listing_restrictions.restored_at is null
    )
  limit 1;
$$;

revoke all on function public.get_public_live_tour_status(uuid)
  from public, anon, authenticated;
grant execute on function public.get_public_live_tour_status(uuid)
  to authenticated;

create or replace function public.purge_expired_live_tour_recording_links()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  update public.live_tours
  set
    recording_url = null,
    recording_external_id = null,
    recording_error = null
  where recording_retention_expires_at <= now()
    and (
      recording_url is not null
      or recording_external_id is not null
      or recording_error is not null
    );

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.purge_expired_live_tour_recording_links()
  from public, anon, authenticated;
grant execute on function public.purge_expired_live_tour_recording_links()
  to service_role;

alter table public.consent_events
  drop constraint if exists consent_events_consent_key_check,
  drop constraint if exists consent_events_source_check;

alter table public.consent_events
  add constraint consent_events_consent_key_check check (
    consent_key in (
      'marketing',
      'location_personalization',
      'live_tour_recording'
    )
  ),
  add constraint consent_events_source_check check (
    source in (
      'signup',
      'settings',
      'privacy_request',
      'live_tour'
    )
  );

create or replace function public.end_live_tour(
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

revoke all on function public.end_live_tour(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.end_live_tour(uuid, integer)
  to authenticated;

comment on table public.live_tour_recording_consents is
  'Per-tour explicit consent history. Recording remains disabled by default until legal review enables the feature flag.';

comment on function public.start_live_tour_recording(uuid, uuid[]) is
  'Host-only recording gate requiring the host and every supplied active participant to hold current explicit consent.';
