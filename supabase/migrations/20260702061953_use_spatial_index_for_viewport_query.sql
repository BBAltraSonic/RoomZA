drop function if exists public.get_published_listings_in_bbox_with_query(
  double precision,
  double precision,
  double precision,
  double precision,
  text,
  integer,
  integer,
  integer,
  integer,
  text
);

create or replace function public.get_published_listings_in_bbox_with_query(
  west double precision,
  south double precision,
  east double precision,
  north double precision,
  search_query text default null,
  min_price integer default null,
  max_price integer default null,
  min_beds integer default null,
  min_baths integer default null,
  property_type_filter text default null
)
returns table (
  id uuid,
  title text,
  address text,
  price integer,
  latitude numeric,
  longitude numeric,
  bedrooms numeric,
  bathrooms numeric,
  thumbnail_url text,
  image_urls text[],
  created_at timestamp with time zone,
  property_type text,
  availability_date date,
  landlord_id uuid,
  landlord_name text,
  landlord_avatar_url text,
  landlord_phone_verified boolean
)
language plpgsql
stable
security invoker
set search_path = public, extensions
as $$
begin
  if to_regclass('public.listings_location_gix') is null then
    raise exception 'Required spatial index public.listings_location_gix is missing'
      using errcode = 'P0002',
            hint = 'Create public.listings_location_gix on public.listings using gist (location).';
  end if;

  return query
    select
      listings.id,
      listings.title,
      listings.address,
      listings.price,
      listings.latitude,
      listings.longitude,
      listings.bedrooms,
      listings.bathrooms,
      image.thumbnail_url,
      image.image_urls,
      listings.created_at,
      listings.property_type,
      listings.availability_date,
      listings.landlord_id,
      profiles.full_name as landlord_name,
      profiles.avatar_url as landlord_avatar_url,
      profiles.phone_verified as landlord_phone_verified
    from public.listings
    left join public.profiles on profiles.id = listings.landlord_id
    left join lateral (
      select
        (array_agg(listing_images.public_url order by listing_images.sort_order asc))[1] as thumbnail_url,
        array_agg(listing_images.public_url order by listing_images.sort_order asc) as image_urls
      from public.listing_images
      where listing_images.listing_id = listings.id
    ) as image on true
    where listings.status = 'published'
      and listings.location && extensions.ST_MakeEnvelope(west, south, east, north, 4326)
      and extensions.ST_Intersects(
        listings.location,
        extensions.ST_MakeEnvelope(west, south, east, north, 4326)
      )
      and (
        search_query is null
        or search_query = ''
        or listings.title ilike '%' || search_query || '%'
        or listings.address ilike '%' || search_query || '%'
        or listings.id::text = search_query
      )
      and (min_price is null or listings.price >= min_price)
      and (max_price is null or listings.price <= max_price)
      and (min_beds is null or listings.bedrooms >= min_beds)
      and (min_baths is null or listings.bathrooms >= min_baths)
      and (property_type_filter is null or property_type_filter = '' or listings.property_type = property_type_filter)
    order by listings.created_at desc
    limit 250;
end;
$$;

revoke execute on function public.get_published_listings_in_bbox_with_query(
  double precision,
  double precision,
  double precision,
  double precision,
  text,
  integer,
  integer,
  integer,
  integer,
  text
) from public;

grant execute on function public.get_published_listings_in_bbox_with_query(
  double precision,
  double precision,
  double precision,
  double precision,
  text,
  integer,
  integer,
  integer,
  integer,
  text
) to anon, authenticated;
