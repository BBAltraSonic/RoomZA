create extension if not exists postgis with schema extensions;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'listing_status') then
    create type public.listing_status as enum ('draft', 'published', 'archived');
  end if;
end;
$$;

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  price integer not null check (price > 0),
  address text not null,
  latitude numeric(9,6) not null check (latitude between -90 and 90),
  longitude numeric(9,6) not null check (longitude between -180 and 180),
  location extensions.geometry(Point, 4326)
    generated always as (extensions.ST_SetSRID(extensions.ST_MakePoint(longitude, latitude), 4326)) stored,
  bedrooms numeric(3,1) not null check (bedrooms >= 0),
  bathrooms numeric(3,1) not null check (bathrooms >= 0),
  parking_type text not null,
  parking_count integer not null default 0 check (parking_count >= 0),
  electricity_type text not null,
  water_availability text not null,
  lease_duration text not null,
  availability_date date not null,
  metadata jsonb not null default '{}'::jsonb,
  status public.listing_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  bucket text not null default 'listing-images',
  path text not null,
  public_url text not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  unique (listing_id, sort_order)
);

create index if not exists listings_landlord_id_idx on public.listings (landlord_id);
create index if not exists listings_status_idx on public.listings (status);
create index if not exists listings_location_gix on public.listings using gist (location);
create index if not exists listings_status_price_idx on public.listings (status, price);
create index if not exists listing_images_listing_id_sort_order_idx
  on public.listing_images (listing_id, sort_order);

alter table public.listings enable row level security;
alter table public.listings force row level security;
alter table public.listing_images enable row level security;
alter table public.listing_images force row level security;

drop policy if exists "Anyone can read published listings" on public.listings;
drop policy if exists "Landlords can read their listings" on public.listings;
drop policy if exists "Landlords can insert their listings" on public.listings;
drop policy if exists "Landlords can update their listings" on public.listings;
drop policy if exists "Landlords can delete their listings" on public.listings;
drop policy if exists "Anyone can read published listing images" on public.listing_images;
drop policy if exists "Landlords can read their listing images" on public.listing_images;
drop policy if exists "Landlords can insert their listing images" on public.listing_images;
drop policy if exists "Landlords can update their listing images" on public.listing_images;
drop policy if exists "Landlords can delete their listing images" on public.listing_images;

create policy "Anyone can read published listings"
  on public.listings
  for select
  to anon, authenticated
  using (status = 'published');

create policy "Landlords can read their listings"
  on public.listings
  for select
  to authenticated
  using (landlord_id = (select auth.uid()));

create policy "Landlords can insert their listings"
  on public.listings
  for insert
  to authenticated
  with check (
    landlord_id = (select auth.uid())
    and public.has_profile_role('landlord')
  );

create policy "Landlords can update their listings"
  on public.listings
  for update
  to authenticated
  using (
    landlord_id = (select auth.uid())
    and public.has_profile_role('landlord')
  )
  with check (
    landlord_id = (select auth.uid())
    and public.has_profile_role('landlord')
  );

create policy "Landlords can delete their listings"
  on public.listings
  for delete
  to authenticated
  using (
    landlord_id = (select auth.uid())
    and public.has_profile_role('landlord')
  );

create policy "Anyone can read published listing images"
  on public.listing_images
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.listings
      where listings.id = listing_images.listing_id
        and listings.status = 'published'
    )
  );

create policy "Landlords can read their listing images"
  on public.listing_images
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.listings
      where listings.id = listing_images.listing_id
        and listings.landlord_id = (select auth.uid())
    )
  );

create policy "Landlords can insert their listing images"
  on public.listing_images
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.listings
      where listings.id = listing_images.listing_id
        and listings.landlord_id = (select auth.uid())
    )
  );

create policy "Landlords can update their listing images"
  on public.listing_images
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.listings
      where listings.id = listing_images.listing_id
        and listings.landlord_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.listings
      where listings.id = listing_images.listing_id
        and listings.landlord_id = (select auth.uid())
    )
  );

create policy "Landlords can delete their listing images"
  on public.listing_images
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.listings
      where listings.id = listing_images.listing_id
        and listings.landlord_id = (select auth.uid())
    )
  );

create or replace function public.get_published_listings_in_bbox(
  west double precision,
  south double precision,
  east double precision,
  north double precision
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
  order by listings.created_at desc
  limit 250;
$$;

revoke execute on function public.get_published_listings_in_bbox(double precision, double precision, double precision, double precision)
  from public;
grant execute on function public.get_published_listings_in_bbox(double precision, double precision, double precision, double precision)
  to anon, authenticated;
