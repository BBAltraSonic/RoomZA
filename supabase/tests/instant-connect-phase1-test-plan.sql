-- Instant Connect Phase 1 state-machine, privilege, RLS, and scheduling plan.
-- Run against a disposable local database after all migrations.
begin;

do $$
begin
  if not has_table_privilege('authenticated', 'public.showing_requests', 'select')
    or has_table_privilege('authenticated', 'public.showing_requests', 'insert')
    or has_table_privilege('authenticated', 'public.showing_requests', 'update')
    or has_table_privilege('authenticated', 'public.showing_requests', 'delete') then
    raise exception 'FAIL: showing_requests browser privileges are incorrect';
  end if;

  if has_function_privilege('anon', 'public.request_showing(uuid,public.showing_window,integer)', 'execute')
    or not has_function_privilege('authenticated', 'public.request_showing(uuid,public.showing_window,integer)', 'execute')
    or has_function_privilege('anon', 'public.respond_showing(uuid,text)', 'execute')
    or not has_function_privilege('authenticated', 'public.respond_showing(uuid,text)', 'execute') then
    raise exception 'FAIL: showing RPC execution boundary is incorrect';
  end if;

  if has_column_privilege('authenticated', 'public.profiles', 'last_seen_at', 'select')
    or has_column_privilege('authenticated', 'public.profiles', 'last_seen_at', 'update')
    or has_column_privilege('authenticated', 'public.profiles', 'presence_status', 'update')
    or has_function_privilege('anon', 'public.set_availability_mode(text)', 'execute')
    or not has_function_privilege('authenticated', 'public.set_availability_mode(text)', 'execute') then
    raise exception 'FAIL: presence privacy boundary is incorrect';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'showing_requests'
  ) then
    raise exception 'FAIL: showing_requests is not in the Realtime publication';
  end if;

  if not exists (select 1 from cron.job where jobname = 'sweep-instant-connect-presence') then
    raise exception 'FAIL: Instant Connect presence sweep cron is missing';
  end if;
end;
$$;

insert into auth.users(id, email, email_confirmed_at) values
  ('72000000-0000-4000-8000-000000000001', 'instant-landlord@example.com', now()),
  ('72000000-0000-4000-8000-000000000002', 'instant-renter@example.com', now()),
  ('72000000-0000-4000-8000-000000000003', 'instant-third@example.com', now());

update public.profiles set role = 'landlord' where id = '72000000-0000-4000-8000-000000000001';
update public.profiles set role = 'renter' where id in (
  '72000000-0000-4000-8000-000000000002',
  '72000000-0000-4000-8000-000000000003'
);

insert into public.listings(
  id, title, landlord_id, status, price, property_type, address, latitude, longitude
) values (
  '72000000-0000-4000-8000-000000000010',
  'Instant Connect test home',
  '72000000-0000-4000-8000-000000000001',
  'published',
  8500,
  'apartment',
  '10 Connect Street',
  -26.1,
  28.0
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"72000000-0000-4000-8000-000000000002"}',
  true
);

select * from public.touch_presence('available');
select * from public.touch_presence('offline');
select * from public.set_availability_mode('busy');
select * from public.request_showing(
  '72000000-0000-4000-8000-000000000010',
  'now',
  8
);

do $$
declare
  duplicate_result text;
begin
  select result into duplicate_result
  from public.request_showing(
    '72000000-0000-4000-8000-000000000010',
    'now',
    8
  );
  if duplicate_result <> 'request_in_progress' then
    raise exception 'FAIL: duplicate live showing request was not rejected';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"72000000-0000-4000-8000-000000000003"}',
  true
);

do $$
declare
  visible_rows integer;
begin
  select count(*) into visible_rows from public.showing_requests;
  if visible_rows <> 0 then
    raise exception 'FAIL: a third party can read another showing request';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"72000000-0000-4000-8000-000000000001"}',
  true
);

select *
from public.respond_showing(
  (select id from public.showing_requests limit 1),
  'accept'
);

do $$
begin
  if not exists (
    select 1
    from public.showing_requests
    where status = 'accepted'
      and conversation_id is not null
  ) then
    raise exception 'FAIL: accepting a showing did not create its conversation';
  end if;
end;
$$;

select *
from public.start_call_session(
  (select conversation_id from public.showing_requests limit 1),
  'voice'
);

do $$
begin
  if not exists (
    select 1
    from public.call_sessions
    where media_mode = 'voice'
      and status = 'ringing'
  ) then
    raise exception 'FAIL: voice call did not use the shared call-session path';
  end if;
end;
$$;

select *
from public.end_call_session(
  (select id from public.call_sessions where status = 'ringing' limit 1),
  'end'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"72000000-0000-4000-8000-000000000002"}',
  true
);

select *
from public.respond_showing(
  (select id from public.showing_requests limit 1),
  'check_in'
);
select *
from public.respond_showing(
  (select id from public.showing_requests limit 1),
  'complete'
);

do $$
begin
  if not exists (
    select 1
    from public.showing_requests
    where status = 'completed'
      and checked_in_at is not null
      and completed_at is not null
  ) then
    raise exception 'FAIL: check-in/completion lifecycle did not persist';
  end if;
end;
$$;

rollback;

select 'PASS: Instant Connect Phase 1 database checks' as result;
