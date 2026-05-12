create index if not exists viewing_slots_created_by_idx
  on public.viewing_slots(created_by);

create or replace function public.book_viewing_slot_atomic(target_slot_id uuid, target_application_id uuid)
returns uuid as $$
declare
  new_viewing_id uuid;
  requesting_user uuid := auth.uid();
begin
  if requesting_user is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.viewing_slot_offers vso
    join public.applications a on a.id = vso.application_id
    where vso.slot_id = target_slot_id
      and vso.application_id = target_application_id
      and a.renter_id = requesting_user
  ) then
    raise exception 'Slot % was not offered to the current renter for application %', target_slot_id, target_application_id;
  end if;

  update public.viewing_slots
  set is_booked = true
  where id = target_slot_id and is_booked = false
  returning id into target_slot_id;

  if target_slot_id is null then
    raise exception 'Slot is already booked or does not exist';
  end if;

  insert into public.viewings (application_id, slot_id, status)
  values (target_application_id, target_slot_id, 'booked')
  returning id into new_viewing_id;

  return new_viewing_id;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.book_viewing_slot_atomic(uuid, uuid) from public, anon;
grant execute on function public.book_viewing_slot_atomic(uuid, uuid) to authenticated;

drop policy if exists "Landlords can manage viewings for their listings" on public.viewing_slots;
create policy "Landlords can manage viewings for their listings"
  on public.viewing_slots for all
  to authenticated
  using (created_by = (select auth.uid()));

drop policy if exists "Renters can view slots offered to them" on public.viewing_slots;
create policy "Renters can view slots offered to them"
  on public.viewing_slots for select
  to authenticated
  using (
    exists (
      select 1
      from public.viewing_slot_offers vso
      join public.applications a on a.id = vso.application_id
      where vso.slot_id = viewing_slots.id
        and a.renter_id = (select auth.uid())
    )
  );

drop policy if exists "Landlords can view/create offers for their slots" on public.viewing_slot_offers;
create policy "Landlords can view/create offers for their slots"
  on public.viewing_slot_offers for all
  to authenticated
  using (
    exists (
      select 1
      from public.viewing_slots
      where public.viewing_slots.id = slot_id
        and public.viewing_slots.created_by = (select auth.uid())
    )
  );

drop policy if exists "Renters can view their slot offers" on public.viewing_slot_offers;
create policy "Renters can view their slot offers"
  on public.viewing_slot_offers for select
  to authenticated
  using (
    exists (
      select 1
      from public.applications
      where public.applications.id = application_id
        and public.applications.renter_id = (select auth.uid())
    )
  );

drop policy if exists "Landlords can view/manage viewings on their listings" on public.viewings;
create policy "Landlords can view/manage viewings on their listings"
  on public.viewings for all
  to authenticated
  using (
    exists (
      select 1
      from public.applications a
      join public.listings l on l.id = a.listing_id
      where a.id = application_id
        and l.landlord_id = (select auth.uid())
    )
  );

drop policy if exists "Renters can view their own viewings" on public.viewings;
create policy "Renters can view their own viewings"
  on public.viewings for select
  to authenticated
  using (
    exists (
      select 1
      from public.applications
      where public.applications.id = application_id
        and public.applications.renter_id = (select auth.uid())
    )
  );

drop policy if exists "Users can insert their own analytics" on public.analytics_events;
create policy "Users can insert their own analytics"
  on public.analytics_events for insert
  to authenticated
  with check (user_id = (select auth.uid()) or user_id is null);
