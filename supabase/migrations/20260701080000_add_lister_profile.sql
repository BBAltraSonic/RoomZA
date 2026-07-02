-- Add public profile fields to profiles table
alter table public.profiles
  add column if not exists full_name text,
  add column if not exists avatar_url text,
  add column if not exists about text;

-- Drop restricted select policy and allow everyone to view profiles
drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles
  for select
  using (true);

-- Update handle_new_user trigger to populate name and avatar from oauth metadata
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, profiles.full_name),
        avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url),
        updated_at = now();

  return new;
end;
$$;

-- Drop and recreate the viewport search query RPC to return landlord details
drop function if exists public.get_published_listings_in_bbox_with_query(double precision, double precision, double precision, double precision, text, integer, integer, integer, integer, text);

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
  created_at timestamp with time zone,
  property_type text,
  availability_date date,
  landlord_id uuid,
  landlord_name text,
  landlord_avatar_url text,
  landlord_phone_verified boolean
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
    listings.availability_date,
    listings.landlord_id,
    profiles.full_name as landlord_name,
    profiles.avatar_url as landlord_avatar_url,
    profiles.phone_verified as landlord_phone_verified
  from public.listings
  left join public.profiles on profiles.id = listings.landlord_id
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
  order by listings.created_at desc
  limit 250;
$$;

grant execute on function public.get_published_listings_in_bbox_with_query(double precision, double precision, double precision, double precision, text, integer, integer, integer, integer, text) to anon, authenticated;
