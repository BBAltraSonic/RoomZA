-- Service booking hours and one-hour booking slots.
-- Run against a disposable local database after all migrations.
begin;

do $$
begin
  if has_table_privilege('authenticated', 'public.service_hours', 'insert')
    or has_table_privilege('authenticated', 'public.service_hours', 'update')
    or has_table_privilege('authenticated', 'public.service_hours', 'delete')
    or has_table_privilege('anon', 'public.service_hours', 'select')
    or has_table_privilege('authenticated', 'public.service_bookings', 'insert')
    or has_table_privilege('authenticated', 'public.service_bookings', 'update')
    or has_table_privilege('authenticated', 'public.service_bookings', 'delete')
    or has_table_privilege('anon', 'public.service_bookings', 'select') then
    raise exception 'FAIL: service booking browser privileges are incorrect';
  end if;
  if has_function_privilege('anon', 'public.set_service_hours(uuid,jsonb)', 'execute')
    or not has_function_privilege('anon', 'public.service_booking_availability(uuid)', 'execute')
    or has_function_privilege('anon', 'public.request_service_booking(uuid,timestamptz,text,text)', 'execute')
    or has_function_privilege('anon', 'public.respond_service_booking(uuid,text)', 'execute')
    or not has_function_privilege('authenticated', 'public.set_service_hours(uuid,jsonb)', 'execute')
    or not has_function_privilege('authenticated', 'public.service_booking_availability(uuid)', 'execute')
    or not has_function_privilege('authenticated', 'public.request_service_booking(uuid,timestamptz,text,text)', 'execute')
    or not has_function_privilege('authenticated', 'public.respond_service_booking(uuid,text)', 'execute')
    or has_function_privilege('authenticated', 'private.service_open_slots(uuid,timestamptz,integer)', 'execute')
    or has_function_privilege('authenticated', 'private.sweep_service_bookings(uuid)', 'execute') then
    raise exception 'FAIL: service booking RPC execution boundary is incorrect';
  end if;
end;
$$;

insert into auth.users(id, email, email_confirmed_at) values
  ('74000000-0000-4000-8000-000000000001', 'booking-provider@example.com', now()),
  ('74000000-0000-4000-8000-000000000002', 'booking-customer@example.com', now()),
  ('74000000-0000-4000-8000-000000000003', 'booking-second-customer@example.com', now());
insert into auth.sessions(id, user_id) values
  ('74000000-0000-4000-8000-0000000000a1', '74000000-0000-4000-8000-000000000001'),
  ('74000000-0000-4000-8000-0000000000a2', '74000000-0000-4000-8000-000000000002'),
  ('74000000-0000-4000-8000-0000000000a3', '74000000-0000-4000-8000-000000000003');
update public.profiles set full_name = 'Booking Customer' where id = '74000000-0000-4000-8000-000000000002';

-- Two published services and one private draft by the same provider.
insert into public.service_submissions(id, poster_id, status) values
  ('74000000-0000-4000-8000-000000000010', '74000000-0000-4000-8000-000000000001', 'approved'),
  ('74000000-0000-4000-8000-000000000011', '74000000-0000-4000-8000-000000000001', 'approved'),
  ('74000000-0000-4000-8000-000000000012', '74000000-0000-4000-8000-000000000001', 'draft');
insert into public.discovery_places(id, provider_id, level, name, region, full_address, center_lat, center_lng, west, south, east, north) values
  ('74000000-0000-4000-8000-000000000020', 'booking-plan-place', 'locality', 'Booking Plan', 'Gauteng', 'Booking Plan, Gauteng', -26.1, 28.0, 27.9, -26.2, 28.1, -26.0);
insert into public.approved_services(id, area_id, content)
select service.id, '74000000-0000-4000-8000-000000000020'::uuid,'{"phone":"+27215550100","contactConsent":true}'::jsonb
from (values ('74000000-0000-4000-8000-000000000010'::uuid), ('74000000-0000-4000-8000-000000000011'::uuid)) service(id);

create temp table plan_state(slot timestamptz, booking_id uuid);
grant all on plan_state to authenticated;

-- Provider: set hours on both public services and the draft.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"74000000-0000-4000-8000-000000000001","session_id":"74000000-0000-4000-8000-0000000000a1"}', true);

do $$
declare
  all_week jsonb := (select jsonb_agg(jsonb_build_object('weekday', d, 'startMinute', 0, 'endMinute', 1440)) from generate_series(0, 6) d);
begin
  begin
    perform public.set_service_hours('74000000-0000-4000-8000-000000000010', '[{"weekday":1,"startMinute":600,"endMinute":630}]');
    raise exception 'FAIL: a window shorter than one hour was saved';
  exception when check_violation then null;
  end;
  begin
    perform public.set_service_hours('74000000-0000-4000-8000-000000000010', '[{"weekday":1,"startMinute":600,"endMinute":720},{"weekday":1,"startMinute":780,"endMinute":900}]');
    raise exception 'FAIL: two windows on one weekday were saved';
  exception when unique_violation then null;
  end;
  -- Every day, all day, so the plan does not depend on the clock.
  if public.set_service_hours('74000000-0000-4000-8000-000000000010', all_week) <> 7
    or public.set_service_hours('74000000-0000-4000-8000-000000000011', all_week) <> 7
    or public.set_service_hours('74000000-0000-4000-8000-000000000012', all_week) <> 7 then
    raise exception 'FAIL: weekly service hours were not saved';
  end if;
  if (select count(*) from public.service_hours) <> 21 then
    raise exception 'FAIL: provider cannot read their own service hours';
  end if;
  if (public.service_booking_availability('74000000-0000-4000-8000-000000000010')->>'own')::boolean is not true then
    raise exception 'FAIL: provider is not told the service is their own';
  end if;
  if public.service_booking_availability('74000000-0000-4000-8000-000000000012') is not null then
    raise exception 'FAIL: an unpublished draft is bookable';
  end if;
end;
$$;

-- Signed-out visitor: learns only that the service takes bookings.
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
declare
  availability jsonb := public.service_booking_availability('74000000-0000-4000-8000-000000000010');
begin
  if availability is null or not (availability->>'hasHours')::boolean or jsonb_array_length(availability->'slots') <> 0 then
    raise exception 'FAIL: signed-out availability is wrong: %', availability;
  end if;
  if public.service_booking_availability('74000000-0000-4000-8000-000000000012') is not null then
    raise exception 'FAIL: a signed-out visitor learned about an unpublished draft';
  end if;
end;
$$;

-- Customer: cannot touch hours, sees derived one-hour slots only, books one.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"74000000-0000-4000-8000-000000000002","session_id":"74000000-0000-4000-8000-0000000000a2"}', true);

do $$
declare
  availability jsonb := public.service_booking_availability('74000000-0000-4000-8000-000000000010');
  first_slot timestamptz;
  outcome record;
  created public.service_bookings%rowtype;
begin
  begin
    perform public.set_service_hours('74000000-0000-4000-8000-000000000010', '[]');
    raise exception 'FAIL: a customer changed a provider''s hours';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from public.service_hours) <> 0 then
    raise exception 'FAIL: a customer can read the provider''s raw hours';
  end if;
  if availability is null or not (availability->>'hasHours')::boolean or (availability->>'own')::boolean then
    raise exception 'FAIL: availability summary is wrong: %', availability;
  end if;
  if jsonb_array_length(availability->'slots') < 13 * 24 then
    raise exception 'FAIL: expected at least 13 full days of hourly slots, got %', jsonb_array_length(availability->'slots');
  end if;
  first_slot := (availability->'slots'->0->>'start')::timestamptz;
  if first_slot < now() + interval '1 hour' or extract(minute from first_slot)::integer <> 0
    or (availability->'slots'->0->>'end')::timestamptz <> first_slot + interval '1 hour' then
    raise exception 'FAIL: first slot % breaks the lead time or grid', first_slot;
  end if;

  if (select result from public.request_service_booking('74000000-0000-4000-8000-000000000010', first_slot, 'x', '+27215550100')) <> 'invalid_input'
    or (select result from public.request_service_booking('74000000-0000-4000-8000-000000000010', first_slot, 'Leaking tap', 'call me')) <> 'invalid_input' then
    raise exception 'FAIL: a booking without a usable note or phone was accepted';
  end if;

  select * into outcome from public.request_service_booking('74000000-0000-4000-8000-000000000010', first_slot, '  Leaking kitchen tap, 4 Oak Road  ', '+27 82 555 0101');
  if outcome.result <> 'requested' then raise exception 'FAIL: booking an open slot returned %', outcome.result; end if;
  select * into created from public.service_bookings where id = outcome.booking_id;
  if created.status <> 'requested' or created.slot_start <> first_slot or created.note <> 'Leaking kitchen tap, 4 Oak Road'
    or created.provider_id <> '74000000-0000-4000-8000-000000000001' or created.customer_name <> 'Booking Customer' then
    raise exception 'FAIL: booking row is wrong';
  end if;
  insert into plan_state values (first_slot, outcome.booking_id);

  select * into outcome from public.request_service_booking('74000000-0000-4000-8000-000000000010', first_slot + interval '2 hours', 'Another job', '+27215550101');
  if outcome.result <> 'request_in_progress' or outcome.booking_id <> created.id then
    raise exception 'FAIL: a second live booking for the same service was not recovered';
  end if;
  if (select count(*) from public.service_bookings) <> 1 then
    raise exception 'FAIL: the customer cannot read exactly their own booking';
  end if;
  if (select result from public.respond_service_booking(created.id, 'accept')) <> 'access_denied' then
    raise exception 'FAIL: a customer accepted their own booking';
  end if;
end;
$$;

-- Second customer: the provider is busy for that hour on every service.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"74000000-0000-4000-8000-000000000003","session_id":"74000000-0000-4000-8000-0000000000a3"}', true);

do $$
declare
  taken timestamptz := (select slot from plan_state);
  availability jsonb := public.service_booking_availability('74000000-0000-4000-8000-000000000011');
begin
  if (select count(*) from public.service_bookings) <> 0 then
    raise exception 'FAIL: another customer can read the booking';
  end if;
  if exists(select 1 from jsonb_array_elements(availability->'slots') s where (s->>'start')::timestamptz = taken) then
    raise exception 'FAIL: a booked hour is still offered on the provider''s other service';
  end if;
  if (select result from public.request_service_booking('74000000-0000-4000-8000-000000000011', taken, 'Fix a socket', '+27215550102')) <> 'slot_unavailable' then
    raise exception 'FAIL: a booked hour could be double-booked across services';
  end if;
  if (select result from public.request_service_booking('74000000-0000-4000-8000-000000000011', taken + interval '30 minutes', 'Fix a socket', '+27215550102')) <> 'slot_unavailable' then
    raise exception 'FAIL: an off-grid time was accepted';
  end if;
  if (select result from public.request_service_booking('74000000-0000-4000-8000-000000000011', date_trunc('hour', now()) + interval '30 minutes', 'Fix a socket', '+27215550102')) <> 'slot_unavailable' then
    raise exception 'FAIL: a slot inside the one-hour lead time was accepted';
  end if;
  if (select result from public.request_service_booking('74000000-0000-4000-8000-000000000011', taken + interval '1 hour', 'Fix a socket', '+27215550102')) <> 'requested' then
    raise exception 'FAIL: the next free hour could not be booked';
  end if;
end;
$$;

-- Provider: accepts one, declines the other; cannot book their own service.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"74000000-0000-4000-8000-000000000001","session_id":"74000000-0000-4000-8000-0000000000a1"}', true);

do $$
declare
  first_booking uuid := (select booking_id from plan_state);
  second_booking uuid := (select id from public.service_bookings where service_id = '74000000-0000-4000-8000-000000000011');
  taken timestamptz := (select slot from plan_state);
begin
  if (select count(*) from public.service_bookings) <> 2 then
    raise exception 'FAIL: provider cannot read bookings on their services';
  end if;
  if (select result from public.respond_service_booking(first_booking, 'accept')) <> 'updated'
    or (select result from public.respond_service_booking(first_booking, 'accept')) <> 'noop'
    or (select result from public.respond_service_booking(first_booking, 'decline')) <> 'invalid_transition' then
    raise exception 'FAIL: accept transitions are wrong';
  end if;
  if (select result from public.respond_service_booking(second_booking, 'decline')) <> 'updated' then
    raise exception 'FAIL: provider could not decline';
  end if;
  if (select result from public.request_service_booking('74000000-0000-4000-8000-000000000010', taken + interval '1 day', 'My own job', '+27215550100')) <> 'own_service' then
    raise exception 'FAIL: a provider could book their own service';
  end if;
end;
$$;

-- Customer cancels; the hour opens again for everyone.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"74000000-0000-4000-8000-000000000002","session_id":"74000000-0000-4000-8000-0000000000a2"}', true);

do $$
declare
  taken timestamptz := (select slot from plan_state);
begin
  if (select status from public.service_bookings where id = (select booking_id from plan_state)) <> 'accepted' then
    raise exception 'FAIL: the customer does not see the acceptance';
  end if;
  if (select result from public.respond_service_booking((select booking_id from plan_state), 'cancel')) <> 'updated' then
    raise exception 'FAIL: the customer could not cancel';
  end if;
  if not exists(select 1 from jsonb_array_elements(public.service_booking_availability('74000000-0000-4000-8000-000000000011')->'slots') s
    where (s->>'start')::timestamptz = taken) then
    raise exception 'FAIL: a cancelled hour was not offered again';
  end if;
end;
$$;

-- Clearing hours empties the calendar.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"74000000-0000-4000-8000-000000000001","session_id":"74000000-0000-4000-8000-0000000000a1"}', true);
select public.set_service_hours('74000000-0000-4000-8000-000000000010', '[]');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"74000000-0000-4000-8000-000000000002","session_id":"74000000-0000-4000-8000-0000000000a2"}', true);
do $$
declare
  availability jsonb := public.service_booking_availability('74000000-0000-4000-8000-000000000010');
begin
  if (availability->>'hasHours')::boolean or jsonb_array_length(availability->'slots') <> 0 then
    raise exception 'FAIL: cleared hours still produce slots: %', availability;
  end if;
end;
$$;

reset role;
select 'PASS: service bookings plan' as result;
rollback;
