create table public.landlord_trust_metrics (
  landlord_id uuid primary key references public.profiles(id) on delete cascade,
  median_first_response_seconds integer,
  reply_sample_size integer not null default 0,
  window_started_at timestamptz not null,
  window_ended_at timestamptz not null,
  calculated_at timestamptz not null default now(),
  constraint landlord_trust_metrics_response_nonnegative
    check (median_first_response_seconds is null or median_first_response_seconds >= 0),
  constraint landlord_trust_metrics_sample_nonnegative
    check (reply_sample_size >= 0),
  constraint landlord_trust_metrics_window_order
    check (window_ended_at >= window_started_at),
  constraint landlord_trust_metrics_publish_threshold
    check (median_first_response_seconds is null or reply_sample_size >= 5)
);

comment on table public.landlord_trust_metrics is
  'Public-safe cached landlord reply metrics. Raw conversation and message data never leaves their protected tables.';

alter table public.landlord_trust_metrics enable row level security;
alter table public.landlord_trust_metrics force row level security;

grant select on public.landlord_trust_metrics to anon, authenticated;
revoke insert, update, delete on public.landlord_trust_metrics from public, anon, authenticated;

create policy "Published landlords have public trust metrics"
on public.landlord_trust_metrics
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.listings listing
    where listing.landlord_id = landlord_trust_metrics.landlord_id
      and listing.status = 'published'
      and not exists (
        select 1
        from public.listing_restrictions restriction
        where restriction.listing_id = listing.id
          and restriction.restored_at is null
      )
  )
);

create or replace function public.refresh_landlord_trust_metrics()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  refresh_time timestamptz := now();
  refreshed_rows integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('public.refresh_landlord_trust_metrics', 0)
  );

  delete from public.landlord_trust_metrics;

  with first_message as (
    select distinct on (message.conversation_id)
      message.conversation_id,
      message.sender_id,
      message.created_at
    from public.messages message
    order by message.conversation_id, message.created_at, message.id
  ),
  response_samples as (
    select
      conversation.landlord_id,
      pg_catalog.date_part('epoch', landlord_reply.created_at - first_message.created_at) as response_seconds
    from public.conversations conversation
    join first_message on first_message.conversation_id = conversation.id
    join lateral (
      select message.created_at
      from public.messages message
      where message.conversation_id = conversation.id
        and message.sender_id = conversation.landlord_id
        and message.created_at > first_message.created_at
      order by message.created_at, message.id
      limit 1
    ) landlord_reply on true
    where first_message.sender_id = conversation.renter_id
      and first_message.created_at >= refresh_time - interval '90 days'
      and landlord_reply.created_at > first_message.created_at
  ),
  aggregates as (
    select
      response_samples.landlord_id,
      count(*)::integer as reply_sample_size,
      round(
        percentile_cont(0.5) within group (order by response_samples.response_seconds)
      )::integer as median_seconds
    from response_samples
    where response_samples.response_seconds >= 0
    group by response_samples.landlord_id
  )
  insert into public.landlord_trust_metrics (
    landlord_id,
    median_first_response_seconds,
    reply_sample_size,
    window_started_at,
    window_ended_at,
    calculated_at
  )
  select
    aggregates.landlord_id,
    case when aggregates.reply_sample_size >= 5 then aggregates.median_seconds else null end,
    aggregates.reply_sample_size,
    refresh_time - interval '90 days',
    refresh_time,
    refresh_time
  from aggregates;

  get diagnostics refreshed_rows = row_count;
  return refreshed_rows;
end;
$$;

revoke all on function public.refresh_landlord_trust_metrics() from public, anon, authenticated;
grant execute on function public.refresh_landlord_trust_metrics() to service_role;

comment on function public.refresh_landlord_trust_metrics() is
  'Rebuilds cached 90-day median first-response metrics. A median is published only with at least five answered renter-initiated conversations.';

select public.refresh_landlord_trust_metrics();

create extension if not exists pg_cron;

select cron.unschedule(jobid)
from cron.job
where jobname = 'refresh-landlord-trust-metrics';

select cron.schedule(
  'refresh-landlord-trust-metrics',
  '0 */6 * * *',
  $cron$select public.refresh_landlord_trust_metrics();$cron$
);

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
  listing_type_filter public.listing_type default 'rent'
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
  created_at timestamp with time zone,
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
  listing_reviewed_at timestamp with time zone
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
  if min_price is not null and max_price is not null and min_price > max_price then
    raise exception 'Invalid discovery price range' using errcode = '22023';
  end if;

  return query
    select
      listings.id,
      listings.title,
      listings.address,
      listings.price,
      listings.sale_price,
      case when listings.listing_type = 'sale' then listings.sale_price else listings.price end,
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
        select 1 from public.listing_accreditations accreditation
        where accreditation.listing_id = listings.id and accreditation.nsfas_approved
      ),
      coalesce((listings.metadata->'amenities'->'essentials') ? 'furnished', false),
      listings.landlord_id,
      profiles.full_name,
      profiles.avatar_url,
      coalesce(profiles.phone_verified, false),
      profiles.email_verified_at is not null,
      landlord_metrics.median_first_response_seconds,
      review_signal.verified_at
    from public.listings listings
    left join public.profiles profiles on profiles.id = listings.landlord_id
    left join public.landlord_trust_metrics landlord_metrics on landlord_metrics.landlord_id = listings.landlord_id
    left join lateral (
      select
        (array_agg(listing_images.public_url order by listing_images.sort_order asc))[1] as thumbnail_url,
        array_agg(listing_images.public_url order by listing_images.sort_order asc) as image_urls
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
        and (verification_checks.expires_at is null or verification_checks.expires_at > now())
      order by verification_checks.verified_at desc
      limit 1
    ) review_signal on true
    where listings.status = 'published'
      and listings.listing_type = listing_type_filter
      and listings.location operator(extensions.&&) extensions.st_makeenvelope(west, south, east, north, 4326)
      and extensions.st_intersects(listings.location, extensions.st_makeenvelope(west, south, east, north, 4326))
      and (
        search_query is null
        or btrim(search_query) = ''
        or position(lower(btrim(search_query)) in lower(coalesce(listings.title, '') || ' ' || coalesce(listings.address, ''))) > 0
      )
      and (min_price is null or (case when listings.listing_type = 'sale' then listings.sale_price else listings.price end) >= min_price)
      and (max_price is null or (case when listings.listing_type = 'sale' then listings.sale_price else listings.price end) <= max_price)
      and (min_beds is null or listings.bedrooms >= min_beds)
      and (min_baths is null or listings.bathrooms >= min_baths)
      and (property_type_filter is null or btrim(property_type_filter) = '' or listings.property_type = property_type_filter)
      and not exists (
        select 1
        from public.listing_restrictions restriction
        where restriction.listing_id = listings.id and restriction.restored_at is null
      )
    order by listings.created_at desc
    limit 250;
end;
$$;

revoke all on function public.get_published_listings_in_bbox_with_query(
  double precision, double precision, double precision, double precision,
  text, integer, integer, integer, integer, text, public.listing_type
) from public, anon, authenticated;
grant execute on function public.get_published_listings_in_bbox_with_query(
  double precision, double precision, double precision, double precision,
  text, integer, integer, integer, integer, text, public.listing_type
) to anon, authenticated;

comment on function public.get_published_listings_in_bbox_with_query(
  double precision, double precision, double precision, double precision,
  text, integer, integer, integer, integer, text, public.listing_type
) is 'Bounded public discovery projection with public listing and landlord trust signals.';
