create or replace function public.get_published_listings_in_bbox_with_query(
  west double precision,
  south double precision,
  east double precision,
  north double precision,
  search_query text default null
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
  thumbnail_url text
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
    image.public_url as thumbnail_url
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
    and (
      search_query is null
      or search_query = ''
      or listings.title ilike '%' || search_query || '%'
      or listings.address ilike '%' || search_query || '%'
      or listings.id::text = search_query
    )
  order by listings.created_at desc
  limit 250;
$$;

revoke execute on function public.get_published_listings_in_bbox_with_query(double precision, double precision, double precision, double precision, text) from public;
grant execute on function public.get_published_listings_in_bbox_with_query(double precision, double precision, double precision, double precision, text) to anon, authenticated;
