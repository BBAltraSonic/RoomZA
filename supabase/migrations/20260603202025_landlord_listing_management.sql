alter type public.notification_type add value if not exists 'application_status_changed';

create table if not exists public.application_status_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  from_status public.application_status,
  to_status public.application_status not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists application_status_events_application_id_created_at_idx
  on public.application_status_events(application_id, created_at desc);

alter table public.application_status_events enable row level security;
alter table public.application_status_events force row level security;

drop policy if exists "Landlords can read application status events" on public.application_status_events;
create policy "Landlords can read application status events"
  on public.application_status_events for select
  to authenticated
  using (
    exists (
      select 1
      from public.applications a
      join public.listings l on l.id = a.listing_id
      where a.id = application_status_events.application_id
        and l.landlord_id = (select auth.uid())
    )
  );

drop policy if exists "Renters can read application status events" on public.application_status_events;
create policy "Renters can read application status events"
  on public.application_status_events for select
  to authenticated
  using (
    exists (
      select 1
      from public.applications a
      where a.id = application_status_events.application_id
        and a.renter_id = (select auth.uid())
    )
  );

create or replace function public.update_application_status_checked(
  target_application_id uuid,
  target_status public.application_status
)
returns table(application_id uuid, result text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_status public.application_status;
begin
  select status
  into current_status
  from public.applications
  where id = target_application_id
  for update;

  if current_status is null then
    return query select null::uuid, 'not_found'::text;
    return;
  end if;

  if current_status in ('withdrawn', 'rejected', 'approved') then
    return query select target_application_id, 'terminal_status'::text;
    return;
  end if;

  if current_status = target_status then
    return query select target_application_id, 'invalid_transition'::text;
    return;
  end if;

  if current_status = 'submitted' and target_status not in ('under_review', 'shortlisted', 'rejected') then
    return query select target_application_id, 'invalid_transition'::text;
    return;
  end if;

  if current_status = 'under_review' and target_status not in ('shortlisted', 'rejected') then
    return query select target_application_id, 'invalid_transition'::text;
    return;
  end if;

  if current_status = 'shortlisted' and target_status not in ('approved', 'rejected') then
    return query select target_application_id, 'invalid_transition'::text;
    return;
  end if;

  update public.applications
  set status = target_status,
      updated_at = now()
  where id = target_application_id;

  insert into public.application_status_events(application_id, actor_id, from_status, to_status)
  values (target_application_id, auth.uid(), current_status, target_status);

  return query select target_application_id, 'updated'::text;
end;
$$;

revoke all on function public.update_application_status_checked(uuid, public.application_status) from public, anon;
grant execute on function public.update_application_status_checked(uuid, public.application_status) to authenticated;

create or replace function public.delete_listing_checked(target_listing_id uuid)
returns table(listing_id uuid, result text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  owner_id uuid;
begin
  select landlord_id
  into owner_id
  from public.listings
  where id = target_listing_id
  for update;

  if owner_id is null or owner_id <> auth.uid() then
    return query select null::uuid, 'not_found'::text;
    return;
  end if;

  if exists (
    select 1
    from public.applications
    where applications.listing_id = target_listing_id
      and applications.status in ('submitted', 'under_review', 'shortlisted', 'approved')
  ) then
    return query select target_listing_id, 'active_applications'::text;
    return;
  end if;

  delete from public.listings
  where id = target_listing_id
    and landlord_id = auth.uid();

  return query select target_listing_id, 'deleted'::text;
end;
$$;

revoke all on function public.delete_listing_checked(uuid) from public, anon;
grant execute on function public.delete_listing_checked(uuid) to authenticated;

create or replace function public.duplicate_listing(target_listing_id uuid)
returns table(listing_id uuid, result text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  source_listing public.listings%rowtype;
  new_listing_id uuid := gen_random_uuid();
begin
  select *
  into source_listing
  from public.listings
  where id = target_listing_id;

  if source_listing.id is null or source_listing.landlord_id <> auth.uid() then
    return query select null::uuid, 'not_found'::text;
    return;
  end if;

  insert into public.listings (
    id, landlord_id, title, description, price, address, latitude, longitude, location,
    property_type, bedrooms, bathrooms, availability_date, lease_duration, status,
    water_included, water_estimate, water_availability, electricity_included,
    electricity_estimate, electricity_type, parking_included, parking_estimate,
    parking_type, parking_count, wifi_included, wifi_estimate, wifi_available,
    security_fee_estimate, metadata
  )
  values (
    new_listing_id, source_listing.landlord_id, coalesce(nullif(trim(source_listing.title), ''), 'Untitled listing') || ' (Copy)',
    source_listing.description, source_listing.price, source_listing.address, source_listing.latitude,
    source_listing.longitude, source_listing.location, source_listing.property_type, source_listing.bedrooms,
    source_listing.bathrooms, source_listing.availability_date, source_listing.lease_duration, 'draft',
    source_listing.water_included, source_listing.water_estimate, source_listing.water_availability,
    source_listing.electricity_included, source_listing.electricity_estimate, source_listing.electricity_type,
    source_listing.parking_included, source_listing.parking_estimate, source_listing.parking_type,
    source_listing.parking_count, source_listing.wifi_included, source_listing.wifi_estimate,
    source_listing.wifi_available, source_listing.security_fee_estimate, source_listing.metadata
  );

  insert into public.listing_images(listing_id, bucket, path, public_url, sort_order)
  select new_listing_id, bucket, path, public_url, sort_order
  from public.listing_images
  where listing_id = target_listing_id;

  return query select new_listing_id, 'duplicated'::text;
end;
$$;

revoke all on function public.duplicate_listing(uuid) from public, anon;
grant execute on function public.duplicate_listing(uuid) to authenticated;
