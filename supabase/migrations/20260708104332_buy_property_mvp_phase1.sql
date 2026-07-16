do $$
begin
  if not exists (select 1 from pg_type where typname = 'listing_type') then
    create type public.listing_type as enum ('rent', 'sale');
  end if;

  if not exists (select 1 from pg_type where typname = 'purchase_stage') then
    create type public.purchase_stage as enum (
      'property_saved',
      'viewing_scheduled',
      'viewing_completed',
      'contacted_seller',
      'negotiating',
      'sale_agreed',
      'purchase_complete'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'buyer_interest_status') then
    create type public.buyer_interest_status as enum ('interested', 'negotiating', 'accepted', 'declined');
  end if;
end;
$$;

alter table public.listings
  add column if not exists listing_type public.listing_type not null default 'rent',
  add column if not exists sale_price integer check (sale_price is null or sale_price > 0);

update public.listings
set listing_type = 'rent'
where listing_type is null;

alter table public.listings
  drop constraint if exists listings_sale_price_required_for_sale,
  add constraint listings_sale_price_required_for_sale
    check (listing_type <> 'sale' or sale_price is not null);

create index if not exists listings_listing_type_status_idx
  on public.listings(listing_type, status);

create index if not exists listings_sale_price_idx
  on public.listings(sale_price)
  where listing_type = 'sale';

create table if not exists public.buyer_interests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  status public.buyer_interest_status not null default 'interested',
  viewing_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (buyer_id, listing_id)
);

create table if not exists public.buyer_interest_private_notes (
  buyer_interest_id uuid primary key references public.buyer_interests(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists buyer_interests_buyer_id_idx
  on public.buyer_interests(buyer_id);

create index if not exists buyer_interests_seller_id_idx
  on public.buyer_interests(seller_id);

create index if not exists buyer_interests_listing_status_idx
  on public.buyer_interests(listing_id, status);

create table if not exists public.purchase_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  current_stage public.purchase_stage not null default 'property_saved',
  completed_stages public.purchase_stage[] not null default '{}'::public.purchase_stage[],
  updated_at timestamptz not null default now(),
  unique (user_id, listing_id)
);

create index if not exists purchase_progress_user_id_idx
  on public.purchase_progress(user_id);

create index if not exists purchase_progress_listing_id_idx
  on public.purchase_progress(listing_id);

alter table public.viewing_slot_offers
  alter column application_id drop not null,
  add column if not exists buyer_interest_id uuid references public.buyer_interests(id) on delete cascade;

alter table public.viewing_slot_offers
  drop constraint if exists viewing_slot_offers_one_subject,
  add constraint viewing_slot_offers_one_subject
    check ((application_id is not null)::integer + (buyer_interest_id is not null)::integer = 1);

drop index if exists public.viewing_slot_offers_buyer_interest_id_idx;
create index viewing_slot_offers_buyer_interest_id_idx
  on public.viewing_slot_offers(buyer_interest_id)
  where buyer_interest_id is not null;

create unique index if not exists viewing_slot_offers_slot_buyer_interest_uidx
  on public.viewing_slot_offers(slot_id, buyer_interest_id)
  where buyer_interest_id is not null;

alter table public.viewings
  alter column application_id drop not null,
  add column if not exists buyer_interest_id uuid references public.buyer_interests(id) on delete cascade;

alter table public.viewings
  drop constraint if exists viewings_one_subject,
  add constraint viewings_one_subject
    check ((application_id is not null)::integer + (buyer_interest_id is not null)::integer = 1);

drop index if exists public.viewings_buyer_interest_id_idx;
create index viewings_buyer_interest_id_idx
  on public.viewings(buyer_interest_id)
  where buyer_interest_id is not null;

alter table public.buyer_interests enable row level security;
alter table public.buyer_interests force row level security;
alter table public.buyer_interest_private_notes enable row level security;
alter table public.buyer_interest_private_notes force row level security;
alter table public.purchase_progress enable row level security;
alter table public.purchase_progress force row level security;

drop policy if exists "Buyers can create sale interest" on public.buyer_interests;
create policy "Buyers can create sale interest"
  on public.buyer_interests for insert
  to authenticated
  with check (
    buyer_id = (select auth.uid())
    and public.has_profile_role('renter')
    and exists (
      select 1
      from public.listings
      where listings.id = buyer_interests.listing_id
        and listings.landlord_id = buyer_interests.seller_id
        and listings.listing_type = 'sale'
        and listings.status = 'published'
    )
  );

drop policy if exists "Buyers can view their sale interest" on public.buyer_interests;
create policy "Buyers can view their sale interest"
  on public.buyer_interests for select
  to authenticated
  using (buyer_id = (select auth.uid()));

drop policy if exists "Sellers can view buyer interest" on public.buyer_interests;
create policy "Sellers can view buyer interest"
  on public.buyer_interests for select
  to authenticated
  using (seller_id = (select auth.uid()));

drop policy if exists "Sellers can update buyer interest" on public.buyer_interests;
create policy "Sellers can update buyer interest"
  on public.buyer_interests for update
  to authenticated
  using (seller_id = (select auth.uid()))
  with check (seller_id = (select auth.uid()));

drop policy if exists "Sellers can manage private buyer interest notes" on public.buyer_interest_private_notes;
create policy "Sellers can manage private buyer interest notes"
  on public.buyer_interest_private_notes for all
  to authenticated
  using (seller_id = (select auth.uid()))
  with check (
    seller_id = (select auth.uid())
    and exists (
      select 1
      from public.buyer_interests
      where buyer_interests.id = buyer_interest_private_notes.buyer_interest_id
        and buyer_interests.seller_id = buyer_interest_private_notes.seller_id
    )
  );

drop policy if exists "Users can view their purchase progress" on public.purchase_progress;
create policy "Users can view their purchase progress"
  on public.purchase_progress for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can create their purchase progress" on public.purchase_progress;
create policy "Users can create their purchase progress"
  on public.purchase_progress for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.listings
      where listings.id = purchase_progress.listing_id
        and listings.listing_type = 'sale'
        and listings.status = 'published'
    )
  );

drop policy if exists "Users can update their purchase progress" on public.purchase_progress;
create policy "Users can update their purchase progress"
  on public.purchase_progress for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can view relevant viewing slots" on public.viewing_slots;
create policy "Users can view relevant viewing slots"
  on public.viewing_slots for select
  to authenticated
  using (
    created_by = (select auth.uid())
    or exists (
      select 1 from public.viewing_slot_offers vso
      join public.applications a on a.id = vso.application_id
      where vso.slot_id = viewing_slots.id
        and a.renter_id = (select auth.uid())
    )
    or exists (
      select 1 from public.viewing_slot_offers vso
      join public.buyer_interests bi on bi.id = vso.buyer_interest_id
      where vso.slot_id = viewing_slots.id
        and bi.buyer_id = (select auth.uid())
    )
  );

drop policy if exists "Users can update relevant viewing slots" on public.viewing_slots;
create policy "Users can update relevant viewing slots"
  on public.viewing_slots for update
  to authenticated
  using (
    created_by = (select auth.uid())
    or exists (
      select 1 from public.viewing_slot_offers vso
      join public.applications a on a.id = vso.application_id
      where vso.slot_id = viewing_slots.id
        and a.renter_id = (select auth.uid())
    )
    or exists (
      select 1 from public.viewing_slot_offers vso
      join public.buyer_interests bi on bi.id = vso.buyer_interest_id
      where vso.slot_id = viewing_slots.id
        and bi.buyer_id = (select auth.uid())
    )
  )
  with check (
    created_by = (select auth.uid())
    or exists (
      select 1 from public.viewing_slot_offers vso
      join public.applications a on a.id = vso.application_id
      where vso.slot_id = viewing_slots.id
        and a.renter_id = (select auth.uid())
    )
    or exists (
      select 1 from public.viewing_slot_offers vso
      join public.buyer_interests bi on bi.id = vso.buyer_interest_id
      where vso.slot_id = viewing_slots.id
        and bi.buyer_id = (select auth.uid())
    )
  );

drop policy if exists "Users can view relevant slot offers" on public.viewing_slot_offers;
create policy "Users can view relevant slot offers"
  on public.viewing_slot_offers for select
  to authenticated
  using (
    exists (
      select 1 from public.applications a
      join public.listings l on l.id = a.listing_id
      where a.id = viewing_slot_offers.application_id
        and l.landlord_id = (select auth.uid())
    )
    or exists (
      select 1 from public.applications
      where applications.id = viewing_slot_offers.application_id
        and applications.renter_id = (select auth.uid())
    )
    or exists (
      select 1 from public.buyer_interests bi
      where bi.id = viewing_slot_offers.buyer_interest_id
        and (bi.seller_id = (select auth.uid()) or bi.buyer_id = (select auth.uid()))
    )
  );

drop policy if exists "Landlords can insert slot offers" on public.viewing_slot_offers;
create policy "Landlords can insert slot offers"
  on public.viewing_slot_offers for insert
  to authenticated
  with check (
    exists (
      select 1 from public.applications a
      join public.listings l on l.id = a.listing_id
      where a.id = viewing_slot_offers.application_id
        and l.landlord_id = (select auth.uid())
    )
    or exists (
      select 1 from public.buyer_interests bi
      where bi.id = viewing_slot_offers.buyer_interest_id
        and bi.seller_id = (select auth.uid())
    )
  );

drop policy if exists "Landlords can update slot offers" on public.viewing_slot_offers;
create policy "Landlords can update slot offers"
  on public.viewing_slot_offers for update
  to authenticated
  using (
    exists (
      select 1 from public.applications a
      join public.listings l on l.id = a.listing_id
      where a.id = viewing_slot_offers.application_id
        and l.landlord_id = (select auth.uid())
    )
    or exists (
      select 1 from public.buyer_interests bi
      where bi.id = viewing_slot_offers.buyer_interest_id
        and bi.seller_id = (select auth.uid())
    )
  );

drop policy if exists "Landlords can delete slot offers" on public.viewing_slot_offers;
create policy "Landlords can delete slot offers"
  on public.viewing_slot_offers for delete
  to authenticated
  using (
    exists (
      select 1 from public.applications a
      join public.listings l on l.id = a.listing_id
      where a.id = viewing_slot_offers.application_id
        and l.landlord_id = (select auth.uid())
    )
    or exists (
      select 1 from public.buyer_interests bi
      where bi.id = viewing_slot_offers.buyer_interest_id
        and bi.seller_id = (select auth.uid())
    )
  );

drop policy if exists "Users can view relevant viewings" on public.viewings;
create policy "Users can view relevant viewings"
  on public.viewings for select
  to authenticated
  using (
    exists (
      select 1 from public.applications a
      join public.listings l on l.id = a.listing_id
      where a.id = viewings.application_id
        and l.landlord_id = (select auth.uid())
    )
    or exists (
      select 1 from public.applications
      where applications.id = viewings.application_id
        and applications.renter_id = (select auth.uid())
    )
    or exists (
      select 1 from public.buyer_interests bi
      where bi.id = viewings.buyer_interest_id
        and (bi.seller_id = (select auth.uid()) or bi.buyer_id = (select auth.uid()))
    )
  );

drop policy if exists "Users can create relevant viewings" on public.viewings;
create policy "Users can create relevant viewings"
  on public.viewings for insert
  to authenticated
  with check (
    exists (
      select 1 from public.applications a
      join public.viewing_slot_offers vso
        on vso.application_id = a.id
       and vso.slot_id = viewings.slot_id
      where a.id = viewings.application_id
        and a.renter_id = (select auth.uid())
    )
    or exists (
      select 1 from public.buyer_interests bi
      join public.viewing_slot_offers vso
        on vso.buyer_interest_id = bi.id
       and vso.slot_id = viewings.slot_id
      where bi.id = viewings.buyer_interest_id
        and bi.buyer_id = (select auth.uid())
    )
  );

drop policy if exists "Users can update relevant viewings" on public.viewings;
create policy "Users can update relevant viewings"
  on public.viewings for update
  to authenticated
  using (
    exists (
      select 1 from public.applications a
      join public.listings l on l.id = a.listing_id
      where a.id = viewings.application_id
        and l.landlord_id = (select auth.uid())
    )
    or exists (
      select 1 from public.buyer_interests bi
      where bi.id = viewings.buyer_interest_id
        and bi.seller_id = (select auth.uid())
    )
  );

create or replace function public.book_buyer_viewing_slot_atomic(
  target_slot_id uuid,
  target_buyer_interest_id uuid
)
returns uuid as $$
declare
  new_viewing_id uuid;
  requesting_user uuid := auth.uid();
  selected_mode public.viewing_mode;
  selected_start_time timestamptz;
  selected_end_time timestamptz;
  generated_room_id text;
begin
  if requesting_user is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.viewing_slot_offers vso
    join public.buyer_interests bi on bi.id = vso.buyer_interest_id
    where vso.slot_id = target_slot_id
      and vso.buyer_interest_id = target_buyer_interest_id
      and bi.buyer_id = requesting_user
  ) then
    raise exception 'Slot % was not offered to the current buyer for interest %', target_slot_id, target_buyer_interest_id;
  end if;

  update public.viewing_slots
  set is_booked = true
  where id = target_slot_id and is_booked = false
  returning id, mode, start_time, end_time
    into target_slot_id, selected_mode, selected_start_time, selected_end_time;

  if target_slot_id is null then
    raise exception 'Slot is already booked or does not exist';
  end if;

  new_viewing_id := gen_random_uuid();

  if selected_mode = 'video_call' then
    generated_room_id := 'roomza-' || replace(new_viewing_id::text, '-', '');
  end if;

  insert into public.viewings (
    id,
    buyer_interest_id,
    slot_id,
    status,
    meeting_provider,
    meeting_room_id,
    meeting_join_url,
    meeting_starts_at,
    meeting_ends_at
  )
  values (
    new_viewing_id,
    target_buyer_interest_id,
    target_slot_id,
    'booked',
    case when selected_mode = 'video_call' then 'jitsi' end,
    generated_room_id,
    case when selected_mode = 'video_call' then 'https://meet.jit.si/' || generated_room_id end,
    case when selected_mode = 'video_call' then selected_start_time end,
    case when selected_mode = 'video_call' then selected_end_time end
  );

  return new_viewing_id;
end;
$$ language plpgsql security invoker set search_path = public;

revoke all on function public.book_buyer_viewing_slot_atomic(uuid, uuid) from public, anon;
grant execute on function public.book_buyer_viewing_slot_atomic(uuid, uuid) to authenticated;

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
  text,
  public.listing_type
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
      listings.sale_price,
      case when listings.listing_type = 'sale' then listings.sale_price else listings.price end as display_price,
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
      and listings.listing_type = listing_type_filter
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
      and (min_price is null or (case when listings.listing_type = 'sale' then listings.sale_price else listings.price end) >= min_price)
      and (max_price is null or (case when listings.listing_type = 'sale' then listings.sale_price else listings.price end) <= max_price)
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
  text,
  public.listing_type
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
  text,
  public.listing_type
) to anon, authenticated;

grant select, insert, update on table public.buyer_interests to authenticated;
grant select, insert, update on table public.buyer_interest_private_notes to authenticated;
grant select, insert, update on table public.purchase_progress to authenticated;
