-- Layer the evidence-based listing review signal onto the existing NSFAS-aware
-- discovery projection without changing the accreditation source of truth.
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
      review_signal.verified_at
    from public.listings listings
    left join public.profiles profiles on profiles.id = listings.landlord_id
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
      and (search_query is null or btrim(search_query) = '' or listings.id::text = btrim(search_query))
      and (min_price is null or (case when listings.listing_type = 'sale' then listings.sale_price else listings.price end) >= min_price)
      and (max_price is null or (case when listings.listing_type = 'sale' then listings.sale_price else listings.price end) <= max_price)
      and (min_beds is null or listings.bedrooms >= min_beds)
      and (min_baths is null or listings.bathrooms >= min_baths)
      and (property_type_filter is null or btrim(property_type_filter) = '' or listings.property_type = property_type_filter)
      and not exists (select 1 from public.listing_restrictions restriction where restriction.listing_id = listings.id and restriction.restored_at is null)
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
