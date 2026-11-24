-- Pinpoint Assistant customer mode: account memory and the services "Open now" check.
-- Run against a disposable local database after all migrations. Everything is rolled back.
begin;

do $$
begin
  if has_table_privilege('anon', 'public.assistant_memory', 'select')
    or has_table_privilege('anon', 'public.assistant_memory', 'insert')
    or not has_function_privilege('anon', 'public.services_open_now(uuid[])', 'execute')
    or not has_function_privilege('authenticated', 'public.services_open_now(uuid[])', 'execute')
    or has_table_privilege('anon', 'public.service_hours', 'select') then
    raise exception 'FAIL: assistant customer privileges are incorrect';
  end if;
end;
$$;

insert into auth.users(id, email, email_confirmed_at) values
  ('76000000-0000-4000-8000-000000000001', 'assistant-customer-one@example.com', now()),
  ('76000000-0000-4000-8000-000000000002', 'assistant-customer-two@example.com', now()),
  ('76000000-0000-4000-8000-000000000003', 'assistant-provider@example.com', now()),
  ('76000000-0000-4000-8000-000000000004', 'assistant-banned-provider@example.com', now());
update auth.users set banned_until = now() + interval '1 day' where id = '76000000-0000-4000-8000-000000000004';

-- Services: A is open all week, B has no hours, C's provider is banned.
insert into public.service_submissions(id, poster_id, status) values
  ('76000000-0000-4000-8000-00000000000a', '76000000-0000-4000-8000-000000000003', 'approved'),
  ('76000000-0000-4000-8000-00000000000b', '76000000-0000-4000-8000-000000000003', 'approved'),
  ('76000000-0000-4000-8000-00000000000c', '76000000-0000-4000-8000-000000000004', 'approved');
insert into public.discovery_places(id, provider_id, level, name, region, full_address, center_lat, center_lng, west, south, east, north) values
  ('76000000-0000-4000-8000-000000000020', 'assistant-plan-place', 'locality', 'Assistant Plan', 'Gauteng', 'Assistant Plan, Gauteng', -26.1, 28.0, 27.9, -26.2, 28.1, -26.0);
insert into public.approved_services(id, area_id, content)
select service.id, '76000000-0000-4000-8000-000000000020'::uuid, '{"phone":"+27215550100","contactConsent":true}'::jsonb
from (values ('76000000-0000-4000-8000-00000000000a'::uuid), ('76000000-0000-4000-8000-00000000000b'::uuid), ('76000000-0000-4000-8000-00000000000c'::uuid)) service(id);
insert into public.service_hours(service_id, weekday, start_minute, end_minute)
select service.id, weekday, 0, 1440
from (values ('76000000-0000-4000-8000-00000000000a'::uuid), ('76000000-0000-4000-8000-00000000000c'::uuid)) service(id)
cross join generate_series(0, 6) weekday;

-- Open now: a signed-out visitor learns which services are open, nothing about hours.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
declare
  open_ids uuid[] := public.services_open_now(array[
    '76000000-0000-4000-8000-00000000000a',
    '76000000-0000-4000-8000-00000000000b',
    '76000000-0000-4000-8000-00000000000c'
  ]::uuid[]);
begin
  if open_ids is distinct from array['76000000-0000-4000-8000-00000000000a']::uuid[] then
    raise exception 'FAIL: open now returned %', open_ids;
  end if;
  if public.services_open_now(null) <> '{}'::uuid[] or public.services_open_now('{}') <> '{}'::uuid[] then
    raise exception 'FAIL: an empty request did not return an empty list';
  end if;
  if public.services_open_now((select array_agg(gen_random_uuid()) from generate_series(1, 251)) || '76000000-0000-4000-8000-00000000000a'::uuid) <> '{}'::uuid[] then
    raise exception 'FAIL: more than 250 services were checked in one call';
  end if;
  begin
    perform 1 from public.service_hours;
    raise exception 'FAIL: a signed-out visitor read service hours';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- Memory: each account reads and changes only its own row.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"76000000-0000-4000-8000-000000000001"}', true);
do $$
begin
  insert into public.assistant_memory(user_id, memory)
  values ('76000000-0000-4000-8000-000000000001', '{"version":1,"recent":[],"preferences":[],"saved":[]}');
  -- now() is fixed inside this transaction, so prove the trigger overrides a stale time instead.
  update public.assistant_memory set memory = '{"version":1,"recent":["beds=2"],"preferences":[],"saved":[]}', updated_at = '2000-01-01';
  if (select updated_at from public.assistant_memory) <> now() then
    raise exception 'FAIL: changing memory did not touch updated_at';
  end if;
  begin
    insert into public.assistant_memory(user_id, memory)
    values ('76000000-0000-4000-8000-000000000002', '{"version":1,"recent":[],"preferences":[]}');
    raise exception 'FAIL: an account wrote memory for someone else';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
do $$
begin
  begin
    insert into public.assistant_memory(user_id, memory) values ('76000000-0000-4000-8000-000000000002', '{"version":2,"recent":[],"preferences":[]}');
    raise exception 'FAIL: memory with the wrong version was saved';
  exception when check_violation then null;
  end;
  begin
    insert into public.assistant_memory(user_id, memory)
    values ('76000000-0000-4000-8000-000000000002', jsonb_build_object('version', 1, 'recent', jsonb_build_array(repeat('x', 17000)), 'preferences', '[]'::jsonb));
    raise exception 'FAIL: oversized memory was saved';
  exception when check_violation then null;
  end;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"76000000-0000-4000-8000-000000000002"}', true);
do $$
declare
  touched integer;
begin
  if exists (select 1 from public.assistant_memory) then
    raise exception 'FAIL: an account can read someone else''s memory';
  end if;
  update public.assistant_memory set memory = '{"version":1,"recent":[],"preferences":[]}';
  get diagnostics touched = row_count;
  if touched <> 0 then
    raise exception 'FAIL: an account changed someone else''s memory';
  end if;
  delete from public.assistant_memory;
  get diagnostics touched = row_count;
  if touched <> 0 then
    raise exception 'FAIL: an account deleted someone else''s memory';
  end if;
end;
$$;

-- "Forget everything" removes the owner's row.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"76000000-0000-4000-8000-000000000001"}', true);
do $$
declare
  touched integer;
begin
  delete from public.assistant_memory;
  get diagnostics touched = row_count;
  if touched <> 1 then
    raise exception 'FAIL: an account could not forget its own memory';
  end if;
end;
$$;

reset role;
select 'PASS: assistant customer plan' as result;
rollback;
