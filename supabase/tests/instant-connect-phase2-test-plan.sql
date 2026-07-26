-- Instant Connect Phase 2 live-tour, privilege, RLS, and projection plan.
-- Run against a disposable local database after all migrations.
begin;
select plan(8);

do $$
begin
  if not has_table_privilege('authenticated', 'public.live_tours', 'select')
    or has_table_privilege('authenticated', 'public.live_tours', 'insert')
    or has_table_privilege('authenticated', 'public.live_tours', 'update')
    or has_table_privilege('authenticated', 'public.live_tours', 'delete') then
    raise exception 'FAIL: live_tours browser privileges are incorrect';
  end if;

  if has_function_privilege(
      'anon',
      'public.start_live_tour(uuid,uuid,text,text)',
      'execute'
    )
    or not has_function_privilege(
      'authenticated',
      'public.start_live_tour(uuid,uuid,text,text)',
      'execute'
    )
    or has_function_privilege(
      'anon',
      'public.end_live_tour(uuid,integer)',
      'execute'
    ) then
    raise exception 'FAIL: live-tour RPC execution boundary is incorrect';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'live_tours'
  ) then
    raise exception 'FAIL: live_tours is not in the Realtime publication';
  end if;

  if (
    select count(*)
    from pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
      and policyname like 'Authenticated users % active live tour presence'
  ) <> 2 then
    raise exception 'FAIL: private tour Presence policies are missing';
  end if;

  if has_function_privilege(
      'anon',
      'private.can_access_live_tour_presence(text)',
      'execute'
    )
    or not has_function_privilege(
      'authenticated',
      'private.can_access_live_tour_presence(text)',
      'execute'
    ) then
    raise exception 'FAIL: private Presence authorization boundary is incorrect';
  end if;
end;
$$;
select pass('live-tour privileges, publication, and Presence policies are correct');

insert into auth.users(id, email, email_confirmed_at) values
  ('73000000-0000-4000-8000-000000000001', 'tour-landlord@example.com', now()),
  ('73000000-0000-4000-8000-000000000002', 'tour-renter@example.com', now());

update public.profiles
set role = 'landlord', presence_status = 'available'
where id = '73000000-0000-4000-8000-000000000001';

update public.profiles
set role = 'renter'
where id = '73000000-0000-4000-8000-000000000002';

insert into public.listings(
  id,
  title,
  landlord_id,
  status,
  price,
  property_type,
  address,
  latitude,
  longitude
) values (
  '73000000-0000-4000-8000-000000000010',
  'Live tour test home',
  '73000000-0000-4000-8000-000000000001',
  'published',
  9200,
  'apartment',
  '20 Broadcast Street',
  -26.1,
  28.0
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"73000000-0000-4000-8000-000000000001"}',
  true
);

do $$
declare
  start_result text;
begin
  select result into start_result
  from public.start_live_tour(
    '73000000-0000-4000-8000-000000000010',
    '73000000-0000-4000-8000-000000000020',
    'roomza-tour-73000000000040008000000000000020',
    'https://meet.jit.si/roomza-tour-73000000000040008000000000000020'
  );
  if start_result <> 'started' then
    raise exception 'FAIL: listing owner could not start a live tour';
  end if;
end;
$$;
select pass('listing owner can start a live tour');

do $$
declare
  duplicate_result text;
begin
  select result into duplicate_result
  from public.start_live_tour(
    '73000000-0000-4000-8000-000000000010',
    '73000000-0000-4000-8000-000000000021',
    'roomza-tour-73000000000040008000000000000021',
    'https://meet.jit.si/roomza-tour-73000000000040008000000000000021'
  );
  if duplicate_result <> 'already_live' then
    raise exception 'FAIL: one-live-tour-per-listing invariant failed';
  end if;
end;
$$;
select pass('one-live-tour-per-listing invariant is enforced');

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"73000000-0000-4000-8000-000000000002"}',
  true
);

do $$
declare
  visible_rows integer;
  end_result text;
begin
  select count(*) into visible_rows
  from public.live_tours
  where id = '73000000-0000-4000-8000-000000000020'
    and status = 'live';
  if visible_rows <> 1 then
    raise exception 'FAIL: authenticated renter cannot read active tour';
  end if;

  select result into end_result
  from public.end_live_tour(
    '73000000-0000-4000-8000-000000000020',
    3
  );
  if end_result <> 'access_denied' then
    raise exception 'FAIL: non-host could end a live tour';
  end if;
end;
$$;
select pass('renter can read but cannot end an active tour');

do $$
begin
  if not private.can_access_live_tour_presence(
      'presence:tour:73000000-0000-4000-8000-000000000020'
    )
    or private.can_access_live_tour_presence('presence:tour:malformed') then
    raise exception 'FAIL: private Presence topic authorization is incorrect';
  end if;
end;
$$;
select pass('private Presence authorization accepts only active tour topics');

reset role;
insert into realtime.messages(topic, extension, private) values
  (
    'presence:tour:73000000-0000-4000-8000-000000000020',
    'presence',
    true
  ),
  (
    'presence:tour:73000000-0000-4000-8000-000000000020',
    'broadcast',
    true
  );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"73000000-0000-4000-8000-000000000002"}',
  true
);
select set_config(
  'realtime.topic',
  'presence:tour:73000000-0000-4000-8000-000000000020',
  true
);

do $$
declare
  readable_extensions integer;
begin
  select count(distinct extension) into readable_extensions
  from realtime.messages
  where topic =
    'presence:tour:73000000-0000-4000-8000-000000000020'
    and extension in ('presence', 'broadcast');

  if readable_extensions <> 2 then
    raise exception
      'FAIL: Realtime cannot complete both private Presence read probes';
  end if;

  begin
    insert into realtime.messages(topic, extension, private)
    values (
      'presence:tour:73000000-0000-4000-8000-000000000020',
      'broadcast',
      true
    );
    raise exception 'FAIL: authenticated clients can publish tour Broadcasts';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;
select pass(
  'private Presence read probes pass while Broadcast publishing stays denied'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"73000000-0000-4000-8000-000000000001"}',
  true
);

do $$
declare
  end_result text;
begin
  select result into end_result
  from public.end_live_tour(
    '73000000-0000-4000-8000-000000000020',
    3
  );
  if end_result <> 'ended' then
    raise exception 'FAIL: host could not end the live tour';
  end if;
end;
$$;
select pass('host can end a live tour');

do $$
begin
  if not exists (
    select 1
    from public.live_tours
    where id = '73000000-0000-4000-8000-000000000020'
      and status = 'ended'
      and ended_at is not null
      and peak_viewers = 3
  ) then
    raise exception 'FAIL: host end transition did not persist analytics';
  end if;
end;
$$;
select pass('end transition persists peak-viewer analytics');

select * from finish();
rollback;
