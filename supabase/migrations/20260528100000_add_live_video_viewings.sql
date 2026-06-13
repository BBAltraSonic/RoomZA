create type public.viewing_mode as enum ('in_person', 'video_call');

alter table public.viewing_slots
  add column mode public.viewing_mode not null default 'in_person';

alter table public.viewings
  add column meeting_provider text,
  add column meeting_room_id text,
  add column meeting_join_url text,
  add column meeting_starts_at timestamptz,
  add column meeting_ends_at timestamptz;

create unique index viewings_meeting_room_id_uidx
  on public.viewings(meeting_room_id)
  where meeting_room_id is not null;

create or replace function public.book_viewing_slot_atomic(target_slot_id uuid, target_application_id uuid)
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
    application_id,
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
    target_application_id,
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

revoke all on function public.book_viewing_slot_atomic(uuid, uuid) from public, anon;
grant execute on function public.book_viewing_slot_atomic(uuid, uuid) to authenticated;
