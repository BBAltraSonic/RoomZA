-- Instant Connect Phase 2: live tours, safe discovery presence, live-map
-- filters, response predictions, and bounded activity summaries.
--
-- Ambient discovery remains persisted-first. The viewport projection exposes
-- only the swept coarse presence status and derived aggregates. Realtime
-- Presence is authorized only for a single active tour topic.

create type public.live_tour_status as enum ('live', 'ended');

create table public.live_tours (
  id uuid primary key,
  listing_id uuid not null references public.listings(id) on delete cascade,
  host_id uuid not null references public.profiles(id),
  status public.live_tour_status not null default 'live',
  provider text not null default 'jitsi'
    check (provider = 'jitsi'),
  room_id text not null,
  join_url text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  peak_viewers integer not null default 0
    check (peak_viewers >= 0),
  constraint live_tours_room_id_uidx unique (room_id),
  constraint live_tours_join_url_uidx unique (join_url),
  constraint live_tours_end_state_check check (
    (status = 'live' and ended_at is null)
    or (status = 'ended' and ended_at is not null)
  )
);

create unique index live_tours_one_live_per_listing_uidx
  on public.live_tours(listing_id)
  where status = 'live';

create index live_tours_listing_status_idx
  on public.live_tours(listing_id, status, started_at desc);

create index live_tours_host_status_idx
  on public.live_tours(host_id, status, started_at desc);

create index if not exists analytics_events_listing_activity_idx
  on public.analytics_events ((properties ->> 'listingId'), event_name, created_at desc);

create index if not exists showing_requests_listing_status_idx
  on public.showing_requests (listing_id, status, requested_at desc);

alter table public.live_tours enable row level security;
alter table public.live_tours force row level security;

grant select on table public.live_tours to authenticated;
revoke insert, update, delete on table public.live_tours
  from public, anon, authenticated;

create policy "Authenticated users read active tours and hosts read own history"
  on public.live_tours for select
  to authenticated
  using (
    host_id = (select auth.uid())
    or (
      status = 'live'
      and exists (
        select 1
        from public.listings
        where listings.id = live_tours.listing_id
          and listings.status = 'published'
      )
    )
  );

alter publication supabase_realtime add table public.live_tours;

-- The caller supplies a UUID and the URLs produced by the shared room helpers.
-- The RPC validates their exact deterministic relationship before inserting.
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
  if requester is null then
    return query
      select 'unauthenticated'::text, null::uuid, null::text, null::text;
    return;
  end if;

  select *
  into listing
  from public.listings
  where id = target_listing_id;

  if listing.id is null or listing.landlord_id <> requester then
    return query
      select 'access_denied'::text, null::uuid, null::text, null::text;
    return;
  end if;

  if listing.status <> 'published' then
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

revoke all on function public.start_live_tour(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.start_live_tour(uuid, uuid, text, text)
  to authenticated;

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

  update public.live_tours
  set
    status = 'ended',
    ended_at = now(),
    peak_viewers = greatest(
      peak_viewers,
      least(10000, greatest(0, coalesce(observed_peak_viewers, 0)))
    )
  where id = target_tour_id;

  return query
    select 'ended'::text, target_tour_id, 'ended'::text;
end;
$$;

revoke all on function public.end_live_tour(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.end_live_tour(uuid, integer)
  to authenticated;

alter type public.notification_type
  add value if not exists 'live_tour_started';

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
    and not exists (
      select 1
      from public.listing_restrictions
      where listing_restrictions.listing_id = listings.id
        and listing_restrictions.restored_at is null
    )
  limit 1;
$$;

revoke all on function public.get_active_public_live_tour(uuid)
  from public, anon, authenticated;
grant execute on function public.get_active_public_live_tour(uuid)
  to anon, authenticated;

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
      and not exists (
        select 1
        from public.listing_restrictions
        where listing_restrictions.listing_id = listings.id
          and listing_restrictions.restored_at is null
      );
end;
$$;

revoke all on function public.get_active_public_live_tours(uuid[])
  from public, anon, authenticated;
grant execute on function public.get_active_public_live_tours(uuid[])
  to anon, authenticated;

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

revoke all on function public.get_public_listing_live_activity(uuid)
  from public, anon, authenticated;
grant execute on function public.get_public_listing_live_activity(uuid)
  to anon, authenticated;

-- Private Presence topics are authorized at channel join time through a
-- boolean-only helper outside the Data API exposed schema. Keeping the lookup
-- out of public-table RLS avoids recursive/nested policy evaluation inside the
-- Realtime authorization connection.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.can_access_live_tour_presence(
  target_topic text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_tour_id uuid;
begin
  if (select auth.uid()) is null
    or target_topic !~
      '^presence:tour:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    return false;
  end if;

  target_tour_id :=
    replace(target_topic, 'presence:tour:', '')::uuid;

  return exists (
    select 1
    from public.live_tours
    join public.listings
      on listings.id = live_tours.listing_id
    where live_tours.id = target_tour_id
      and live_tours.status = 'live'
      and listings.status = 'published'
      and not exists (
        select 1
        from public.listing_restrictions
        where listing_restrictions.listing_id = live_tours.listing_id
          and listing_restrictions.restored_at is null
      )
  );
end;
$$;

revoke all on function private.can_access_live_tour_presence(text)
  from public, anon, authenticated;
grant execute on function private.can_access_live_tour_presence(text)
  to authenticated;

create policy "Authenticated users receive active live tour presence"
  on realtime.messages for select
  to authenticated
  using (
    -- Realtime probes both read extensions when Presence is enabled. Broadcast
    -- remains read-only here; the INSERT policy below still permits Presence
    -- messages only.
    realtime.messages.extension in ('presence', 'broadcast')
    and (
      select private.can_access_live_tour_presence(
        (select realtime.topic())
      )
    )
  );

create policy "Authenticated users publish active live tour presence"
  on realtime.messages for insert
  to authenticated
  with check (
    realtime.messages.extension = 'presence'
    and (
      select private.can_access_live_tour_presence(
        (select realtime.topic())
      )
    )
  );

-- Replace the public discovery RPC with a Phase-2 projection. The function
-- remains a bounded, read-only SECURITY DEFINER projection because it composes
-- public trust evidence from RLS-protected source tables. It never returns raw
-- heartbeat timestamps, viewer identities, or private tour membership.
drop function if exists public.get_published_listings_in_bbox_with_query(
  double precision, double precision, double precision, double precision,
  text, integer, integer, integer, integer, text, public.listing_type
);

create function public.get_published_listings_in_bbox_with_query(
  west double precision,
  south double precision,
  east double precision,
  north double precision,
  search_query text default null,
  min_price integer default null,
  max_price integer default null,
  min_beds integer default null,
  min_baths integer default null,
  property_type_filter text default null,
  listing_type_filter public.listing_type default 'rent',
  available_now_filter boolean default false,
  live_tours_filter boolean default false,
  instant_viewings_filter boolean default false,
  replies_under_5_filter boolean default false
)
returns table (
  id uuid,
  title text,
  address text,
  price integer,
  sale_price integer,
  display_price integer,
  listing_type public.listing_type,
  latitude numeric,
  longitude numeric,
  bedrooms numeric,
  bathrooms numeric,
  parking_count integer,
  thumbnail_url text,
  image_urls text[],
  created_at timestamptz,
  property_type text,
  availability_date date,
  nsfas_approved boolean,
  furnished boolean,
  landlord_id uuid,
  landlord_name text,
  landlord_avatar_url text,
  landlord_phone_verified boolean,
  landlord_email_verified boolean,
  landlord_median_first_response_seconds integer,
  landlord_presence_status text,
  landlord_predicted_response_seconds integer,
  listing_reviewed_at timestamptz,
  live_tour_id uuid,
  has_live_tour boolean,
  has_instant_viewing boolean,
  viewed_today integer,
  viewing_now integer,
  last_scheduled_at timestamptz,
  last_rented_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if west is null or east is null or south is null or north is null
    or west < -180 or east > 180 or south < -90 or north > 90
    or west >= east or south >= north then
    raise exception 'Invalid discovery bounds' using errcode = '22023';
  end if;

  if min_price is not null and max_price is not null
    and min_price > max_price then
    raise exception 'Invalid discovery price range' using errcode = '22023';
  end if;

  return query
    select
      listings.id,
      listings.title,
      listings.address,
      listings.price,
      listings.sale_price,
      case
        when listings.listing_type = 'sale'
          then listings.sale_price
        else listings.price
      end,
      listings.listing_type,
      listings.latitude,
      listings.longitude,
      listings.bedrooms,
      listings.bathrooms,
      listings.parking_count,
      image.thumbnail_url,
      image.image_urls,
      listings.created_at,
      listings.property_type,
      listings.availability_date,
      exists (
        select 1
        from public.listing_accreditations accreditation
        where accreditation.listing_id = listings.id
          and accreditation.nsfas_approved
      ),
      coalesce(
        (listings.metadata -> 'amenities' -> 'essentials') ? 'furnished',
        false
      ),
      listings.landlord_id,
      profiles.full_name,
      profiles.avatar_url,
      coalesce(profiles.phone_verified, false),
      profiles.email_verified_at is not null,
      landlord_metrics.median_first_response_seconds,
      case
        when profiles.presence_status in ('available', 'busy')
          then profiles.presence_status
        else 'offline'
      end,
      case
        when profiles.presence_status = 'available'
          then greatest(
            60,
            least(
              coalesce(landlord_metrics.median_first_response_seconds, 300),
              300
            )
          )
        when profiles.presence_status = 'busy'
          then greatest(
            60,
            least(
              coalesce(landlord_metrics.median_first_response_seconds, 1200),
              1200
            )
          )
        else landlord_metrics.median_first_response_seconds
      end,
      review_signal.verified_at,
      live_tour.id,
      live_tour.id is not null,
      active_showing.has_active,
      activity.viewed_today,
      least(
        99,
        activity.recent_viewers
          + active_showing.active_count
          + case when live_tour.id is null then 0 else 1 end
      ),
      greatest(
        active_showing.last_requested_at,
        scheduled_viewing.last_created_at
      ),
      activity.last_rented_at
    from public.listings listings
    left join public.profiles profiles
      on profiles.id = listings.landlord_id
    left join public.landlord_trust_metrics landlord_metrics
      on landlord_metrics.landlord_id = listings.landlord_id
    left join lateral (
      select
        (array_agg(
          listing_images.public_url
          order by listing_images.sort_order asc
        ))[1] as thumbnail_url,
        array_agg(
          listing_images.public_url
          order by listing_images.sort_order asc
        ) as image_urls
      from public.listing_images listing_images
      where listing_images.listing_id = listings.id
    ) image on true
    left join lateral (
      select verification_checks.verified_at
      from public.verification_checks
      where verification_checks.listing_id = listings.id
        and verification_checks.check_key = 'listing_review'
        and verification_checks.status = 'verified'
        and verification_checks.verified_at is not null
        and (
          verification_checks.expires_at is null
          or verification_checks.expires_at > now()
        )
      order by verification_checks.verified_at desc
      limit 1
    ) review_signal on true
    left join lateral (
      select live_tours.id
      from public.live_tours
      where live_tours.listing_id = listings.id
        and live_tours.status = 'live'
      limit 1
    ) live_tour on true
    left join lateral (
      select
        count(*)::integer as active_count,
        count(*) > 0 as has_active,
        max(showing_requests.requested_at) as last_requested_at
      from public.showing_requests
      where showing_requests.listing_id = listings.id
        and showing_requests.status in ('accepted', 'checked_in')
    ) active_showing on true
    left join lateral (
      select max(viewings.created_at) as last_created_at
      from public.viewings
      join public.applications
        on applications.id = viewings.application_id
      where applications.listing_id = listings.id
        and viewings.status <> 'cancelled'
    ) scheduled_viewing on true
    left join lateral (
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
      from public.analytics_events
      where analytics_events.properties ->> 'listingId' = listings.id::text
        and analytics_events.event_name in ('listing_view', 'listing_rented')
        and analytics_events.created_at >= now() - interval '90 days'
    ) activity on true
    where listings.status = 'published'
      and listings.listing_type = listing_type_filter
      and listings.location operator(extensions.&&)
        extensions.st_makeenvelope(west, south, east, north, 4326)
      and extensions.st_intersects(
        listings.location,
        extensions.st_makeenvelope(west, south, east, north, 4326)
      )
      and (
        search_query is null
        or btrim(search_query) = ''
        or position(
          lower(btrim(search_query))
          in lower(
            coalesce(listings.title, '')
              || ' '
              || coalesce(listings.address, '')
          )
        ) > 0
      )
      and (
        min_price is null
        or (
          case
            when listings.listing_type = 'sale'
              then listings.sale_price
            else listings.price
          end
        ) >= min_price
      )
      and (
        max_price is null
        or (
          case
            when listings.listing_type = 'sale'
              then listings.sale_price
            else listings.price
          end
        ) <= max_price
      )
      and (min_beds is null or listings.bedrooms >= min_beds)
      and (min_baths is null or listings.bathrooms >= min_baths)
      and (
        property_type_filter is null
        or btrim(property_type_filter) = ''
        or listings.property_type = property_type_filter
      )
      and (
        not available_now_filter
        or profiles.presence_status = 'available'
      )
      and (
        not live_tours_filter
        or live_tour.id is not null
      )
      and (
        not instant_viewings_filter
        or active_showing.has_active
      )
      and (
        not replies_under_5_filter
        or case
          when profiles.presence_status = 'available'
            then greatest(
              60,
              least(
                coalesce(
                  landlord_metrics.median_first_response_seconds,
                  300
                ),
                300
              )
            )
          when profiles.presence_status = 'busy'
            then greatest(
              60,
              least(
                coalesce(
                  landlord_metrics.median_first_response_seconds,
                  1200
                ),
                1200
              )
            )
          else landlord_metrics.median_first_response_seconds
        end <= 300
      )
      and not exists (
        select 1
        from public.listing_restrictions restriction
        where restriction.listing_id = listings.id
          and restriction.restored_at is null
      )
    order by
      (live_tour.id is not null) desc,
      (profiles.presence_status = 'available') desc,
      listings.created_at desc
    limit 250;
end;
$$;

revoke all on function public.get_published_listings_in_bbox_with_query(
  double precision, double precision, double precision, double precision,
  text, integer, integer, integer, integer, text, public.listing_type,
  boolean, boolean, boolean, boolean
) from public, anon, authenticated;

grant execute on function public.get_published_listings_in_bbox_with_query(
  double precision, double precision, double precision, double precision,
  text, integer, integer, integer, integer, text, public.listing_type,
  boolean, boolean, boolean, boolean
) to anon, authenticated;

comment on function public.get_published_listings_in_bbox_with_query(
  double precision, double precision, double precision, double precision,
  text, integer, integer, integer, integer, text, public.listing_type,
  boolean, boolean, boolean, boolean
) is
  'Bounded public discovery projection with safe Instant Connect Phase 2 signals.';
