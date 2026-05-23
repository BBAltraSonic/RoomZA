drop function if exists public.get_published_listings_in_bbox_with_query(double precision, double precision, double precision, double precision, text);

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
  property_type_filter text default null,
  pet_friendly_filter boolean default null
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
  created_at timestamp with time zone,
  property_type text,
  availability_date date
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    listings.id,
    listings.title,
    listings.address,
    listings.price,
    listings.latitude,
    listings.longitude,
    listings.bedrooms,
    listings.bathrooms,
    image.public_url as thumbnail_url,
    listings.created_at,
    listings.property_type,
    listings.availability_date
  from public.listings
  left join lateral (
    select listing_images.public_url
    from public.listing_images
    where listing_images.listing_id = listings.id
    order by listing_images.sort_order asc
    limit 1
  ) as image on true
  where listings.status = 'published'
    and listings.longitude between least(west, east) and greatest(west, east)
    and listings.latitude between least(south, north) and greatest(south, north)
    and (search_query is null or search_query = '' or listings.title ilike '%' || search_query || '%' or listings.address ilike '%' || search_query || '%' or listings.id::text = search_query)
    and (min_price is null or listings.price >= min_price)
    and (max_price is null or listings.price <= max_price)
    and (min_beds is null or listings.bedrooms >= min_beds)
    and (min_baths is null or listings.bathrooms >= min_baths)
    and (property_type_filter is null or property_type_filter = '' or listings.property_type = property_type_filter)
    and (pet_friendly_filter is null or not pet_friendly_filter or (listings.metadata->>'petFriendly')::boolean = true)
  order by listings.created_at desc
  limit 250;
$$;

revoke execute on function public.get_published_listings_in_bbox_with_query(double precision, double precision, double precision, double precision, text, integer, integer, integer, integer, text, boolean) from public;
grant execute on function public.get_published_listings_in_bbox_with_query(double precision, double precision, double precision, double precision, text, integer, integer, integer, integer, text, boolean) to anon, authenticated;
