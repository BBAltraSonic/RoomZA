-- Landlord viewing hours and scheduled showing slots.
-- Run against a disposable local database after all migrations.
begin;

do $$
begin
  if has_table_privilege('authenticated', 'public.landlord_viewing_hours', 'insert')
    or has_table_privilege('authenticated', 'public.landlord_viewing_hours', 'update')
    or has_table_privilege('authenticated', 'public.landlord_viewing_hours', 'delete')
    or has_table_privilege('anon', 'public.landlord_viewing_hours', 'select') then
    raise exception 'FAIL: landlord_viewing_hours browser privileges are incorrect';
  end if;
  if has_function_privilege('anon', 'public.set_viewing_hours(jsonb)', 'execute')
    or has_function_privilege('anon', 'public.listing_viewing_availability(uuid)', 'execute')
    or has_function_privilege('anon', 'public.request_scheduled_showing(uuid,timestamptz)', 'execute')
    or not has_function_privilege('authenticated', 'public.set_viewing_hours(jsonb)', 'execute')
    or not has_function_privilege('authenticated', 'public.listing_viewing_availability(uuid)', 'execute')
    or not has_function_privilege('authenticated', 'public.request_scheduled_showing(uuid,timestamptz)', 'execute')
    or has_function_privilege('authenticated', 'private.landlord_open_viewing_slots(uuid,timestamptz,integer)', 'execute') then
    raise exception 'FAIL: viewing hours RPC execution boundary is incorrect';
  end if;
end;
$$;

insert into auth.users(id, email, email_confirmed_at) values
  ('73000000-0000-4000-8000-000000000001', 'hours-landlord@example.com', now()),
  ('73000000-0000-4000-8000-000000000002', 'hours-renter@example.com', now()),
  ('73000000-0000-4000-8000-000000000003', 'hours-second-renter@example.com', now());
insert into auth.sessions(id, user_id) values
  ('73000000-0000-4000-8000-0000000000a1', '73000000-0000-4000-8000-000000000001'),
  ('73000000-0000-4000-8000-0000000000a2', '73000000-0000-4000-8000-000000000002'),
  ('73000000-0000-4000-8000-0000000000a3', '73000000-0000-4000-8000-000000000003');
update public.profiles set role = 'landlord' where id = '73000000-0000-4000-8000-000000000001';
insert into public.listings(id, title, landlord_id, status, price, property_type, address, latitude, longitude, metadata) values
  ('73000000-0000-4000-8000-000000000010', 'Hours test home A', '73000000-0000-4000-8000-000000000001', 'published', 8500, 'apartment', '1 Hours Street', -26.1, 28.0, '{"publicContact":{"phone":"+27215550100"},"contactConsent":true}'),
  ('73000000-0000-4000-8000-000000000011', 'Hours test home B', '73000000-0000-4000-8000-000000000001', 'published', 9500, 'apartment', '2 Hours Street', -26.1, 28.0, '{"publicContact":{"phone":"+27215550100"},"contactConsent":true}');

create temp table plan_state(slot timestamptz, request_id uuid);
grant all on plan_state to authenticated;

-- Landlord: set hours, reject malformed hours.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"73000000-0000-4000-8000-000000000001","session_id":"73000000-0000-4000-8000-0000000000a1"}', true);

do $$
begin
  begin
    perform public.set_viewing_hours('[{"weekday":1,"startMinute":600,"endMinute":620}]');
    raise exception 'FAIL: a window shorter than one slot was saved';
  exception when check_violation then null;
  end;
  begin
    perform public.set_viewing_hours('[{"weekday":1,"startMinute":600,"endMinute":690},{"weekday":1,"startMinute":780,"endMinute":900}]');
    raise exception 'FAIL: two windows on one weekday were saved';
  exception when unique_violation then null;
  end;
  -- Every day, all day, so the plan does not depend on the clock.
  if public.set_viewing_hours((select jsonb_agg(jsonb_build_object('weekday', d, 'startMinute', 0, 'endMinute', 1440)) from generate_series(0, 6) d)) <> 7 then
    raise exception 'FAIL: weekly hours were not saved';
  end if;
  if (select count(*) from public.landlord_viewing_hours) <> 7 then
    raise exception 'FAIL: landlord cannot read their own hours';
  end if;
end;
$$;

-- Renter: sees derived slots only, books one.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"73000000-0000-4000-8000-000000000002","session_id":"73000000-0000-4000-8000-0000000000a2"}', true);

do $$
declare
  availability jsonb := public.listing_viewing_availability('73000000-0000-4000-8000-000000000010');
  first_slot timestamptz;
  outcome record;
  created public.showing_requests%rowtype;
begin
  if (select count(*) from public.landlord_viewing_hours) <> 0 then
    raise exception 'FAIL: a renter can read the landlord''s raw hours';
  end if;
  if availability is null or not (availability->>'hasHours')::boolean or not (availability->>'inHoursNow')::boolean then
    raise exception 'FAIL: availability summary is wrong: %', availability;
  end if;
  if jsonb_array_length(availability->'slots') < 13 * 48 then
    raise exception 'FAIL: expected at least 13 full days of half-hour slots, got %', jsonb_array_length(availability->'slots');
  end if;
  first_slot := (availability->'slots'->0->>'start')::timestamptz;
  if first_slot < now() + interval '1 hour' or extract(minute from first_slot)::integer % 30 <> 0
    or (availability->'slots'->0->>'end')::timestamptz <> first_slot + interval '30 minutes' then
    raise exception 'FAIL: first slot % breaks the lead time or grid', first_slot;
  end if;

  select * into outcome from public.request_scheduled_showing('73000000-0000-4000-8000-000000000010', first_slot);
  if outcome.result <> 'requested' then raise exception 'FAIL: booking an open slot returned %', outcome.result; end if;
  select * into created from public.showing_requests where id = outcome.request_id;
  if created.window_choice <> 'scheduled' or created.scheduled_for <> first_slot or created.expires_at <> first_slot then
    raise exception 'FAIL: scheduled request row is wrong';
  end if;
  insert into plan_state values (first_slot, outcome.request_id);

  select * into outcome from public.request_scheduled_showing('73000000-0000-4000-8000-000000000010', first_slot + interval '30 minutes');
  if outcome.result <> 'request_in_progress' or outcome.request_id <> created.id then
    raise exception 'FAIL: a second live request for the same home was not recovered';
  end if;
end;
$$;

-- Second renter: the booked slot is gone across the landlord's listings.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"73000000-0000-4000-8000-000000000003","session_id":"73000000-0000-4000-8000-0000000000a3"}', true);

do $$
declare
  taken timestamptz := (select slot from plan_state);
  availability jsonb := public.listing_viewing_availability('73000000-0000-4000-8000-000000000011');
begin
  if exists(select 1 from jsonb_array_elements(availability->'slots') s where (s->>'start')::timestamptz = taken) then
    raise exception 'FAIL: a booked slot is still offered on the landlord''s other listing';
  end if;
  if (select result from public.request_scheduled_showing('73000000-0000-4000-8000-000000000011', taken)) <> 'slot_unavailable' then
    raise exception 'FAIL: a booked slot could be double-booked';
  end if;
  if (select result from public.request_scheduled_showing('73000000-0000-4000-8000-000000000011', taken + interval '40 minutes')) <> 'slot_unavailable' then
    raise exception 'FAIL: an off-grid time was accepted';
  end if;
  if (select result from public.request_scheduled_showing('73000000-0000-4000-8000-000000000011', date_trunc('hour', now()) + interval '30 minutes')) <> 'slot_unavailable' then
    raise exception 'FAIL: a slot inside the one-hour lead time was accepted';
  end if;
  if (select result from public.request_showing('73000000-0000-4000-8000-000000000011', 'scheduled')) <> 'invalid_input' then
    raise exception 'FAIL: a scheduled window was accepted without a slot';
  end if;
end;
$$;

-- Landlord accepts the future showing and stays available for "Right now".
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"73000000-0000-4000-8000-000000000001","session_id":"73000000-0000-4000-8000-0000000000a1"}', true);
select * from public.respond_showing((select request_id from plan_state), 'accept');
select * from public.touch_presence('available');
do $$
begin
  if (select result from public.request_scheduled_showing('73000000-0000-4000-8000-000000000010', (select slot from plan_state) + interval '1 day')) <> 'own_listing' then
    raise exception 'FAIL: a landlord could book their own listing';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"73000000-0000-4000-8000-000000000003","session_id":"73000000-0000-4000-8000-0000000000a3"}', true);
do $$
begin
  if (select result from public.request_showing('73000000-0000-4000-8000-000000000011', 'now')) <> 'requested' then
    raise exception 'FAIL: an accepted showing later on blocks a "Right now" request today';
  end if;
end;
$$;

-- Clearing hours empties the calendar.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"73000000-0000-4000-8000-000000000001","session_id":"73000000-0000-4000-8000-0000000000a1"}', true);
select public.set_viewing_hours('[]');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"73000000-0000-4000-8000-000000000002","session_id":"73000000-0000-4000-8000-0000000000a2"}', true);
do $$
declare
  availability jsonb := public.listing_viewing_availability('73000000-0000-4000-8000-000000000010');
begin
  if (availability->>'hasHours')::boolean or jsonb_array_length(availability->'slots') <> 0 then
    raise exception 'FAIL: cleared hours still produce slots: %', availability;
  end if;
end;
$$;

reset role;
select 'PASS: landlord viewing hours plan' as result;
rollback;
