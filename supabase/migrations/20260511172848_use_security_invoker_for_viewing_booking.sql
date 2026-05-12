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
$$ language plpgsql security invoker set search_path = public;

revoke all on function public.book_viewing_slot_atomic(uuid, uuid) from public, anon;
grant execute on function public.book_viewing_slot_atomic(uuid, uuid) to authenticated;

drop policy if exists "Renters can book offered slots" on public.viewing_slots;
create policy "Renters can book offered slots"
  on public.viewing_slots for update
  to authenticated
  using (
    exists (
      select 1
      from public.viewing_slot_offers vso
      join public.applications a on a.id = vso.application_id
      where vso.slot_id = viewing_slots.id
        and a.renter_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.viewing_slot_offers vso
      join public.applications a on a.id = vso.application_id
      where vso.slot_id = viewing_slots.id
        and a.renter_id = (select auth.uid())
    )
  );

drop policy if exists "Renters can create their own viewings" on public.viewings;
create policy "Renters can create their own viewings"
  on public.viewings for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.applications a
      join public.viewing_slot_offers vso
        on vso.application_id = a.id
       and vso.slot_id = viewings.slot_id
      where a.id = viewings.application_id
        and a.renter_id = (select auth.uid())
    )
  );
