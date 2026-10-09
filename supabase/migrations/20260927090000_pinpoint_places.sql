-- Stable, app-owned identifiers for South African discovery places.
create table if not exists public.discovery_places (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null unique,
  level text not null check (level in ('neighbourhood', 'locality', 'place', 'municipality')),
  name text not null,
  region text not null,
  full_address text not null,
  center_lat double precision not null check (center_lat between -90 and 90),
  center_lng double precision not null check (center_lng between -180 and 180),
  west double precision not null check (west between -180 and 180),
  south double precision not null check (south between -90 and 90),
  east double precision not null check (east between -180 and 180),
  north double precision not null check (north between -90 and 90),
  created_at timestamptz not null default now(),
  check (west < east and south < north),
  check (center_lng between west and east and center_lat between south and north)
);

create index if not exists discovery_places_name_idx on public.discovery_places (lower(name));
alter table public.discovery_places enable row level security;
revoke all on public.discovery_places from public, anon, authenticated;
create policy "Anyone can read discovery places" on public.discovery_places
  for select to anon, authenticated using (true);
grant select on public.discovery_places to anon, authenticated;
grant select, insert on public.discovery_places to service_role;
-- Inserts come from the server's service role after validating geocoder data.
