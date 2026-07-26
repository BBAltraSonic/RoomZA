-- Instant Connect Phase 3 scheduling, moderation support, consent, recording,
-- privilege, and projection plan. Run against a disposable local database.
begin;
select plan(11);

do $$
begin
  if not has_table_privilege(
      'authenticated',
      'public.live_tour_recording_consents',
      'select'
    )
    or has_table_privilege(
      'authenticated',
      'public.live_tour_recording_consents',
      'insert'
    )
    or has_table_privilege(
      'authenticated',
      'public.live_tour_recording_consents',
      'update'
    ) then
    raise exception 'FAIL: recording-consent browser privileges are incorrect';
  end if;

  if not has_table_privilege('service_role', 'public.listings', 'select')
    or not has_table_privilege(
      'service_role',
      'public.user_favorites',
      'select'
    )
    or not has_table_privilege(
      'service_role',
      'public.search_alerts',
      'select'
    )
    or not has_table_privilege(
      'service_role',
      'public.notification_preferences',
      'select'
    )
    or not has_table_privilege(
      'service_role',
      'public.notification_events',
      'insert'
    )
    or not has_table_privilege(
      'service_role',
      'public.live_tours',
      'update'
    ) then
    raise exception 'FAIL: Phase 3 worker privileges are incomplete';
  end if;

  if has_function_privilege(
      'anon',
      'public.schedule_live_tour(uuid,uuid,text,text,timestamptz,integer)',
      'execute'
    )
    or not has_function_privilege(
      'authenticated',
      'public.schedule_live_tour(uuid,uuid,text,text,timestamptz,integer)',
      'execute'
    )
    or has_function_privilege(
      'anon',
      'public.start_live_tour_recording(uuid,uuid[])',
      'execute'
    )
    or has_function_privilege(
      'anon',
      'public.get_public_live_tour_status(uuid)',
      'execute'
    )
    or not has_function_privilege(
      'authenticated',
      'public.get_public_live_tour_status(uuid)',
      'execute'
    ) then
    raise exception 'FAIL: Phase 3 RPC execution boundary is incorrect';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'live_tour_recording_consents'
  ) then
    raise exception 'FAIL: recording consents are missing from Realtime';
  end if;
end;
$$;
select pass('Phase 3 privileges and Realtime publication are correct');

insert into auth.users(id, email, email_confirmed_at) values
  (
    '74000000-0000-4000-8000-000000000001',
    'phase3-landlord@example.com',
    now()
  ),
  (
    '74000000-0000-4000-8000-000000000002',
    'phase3-renter@example.com',
    now()
  );

update public.profiles
set role = 'landlord'
where id = '74000000-0000-4000-8000-000000000001';

update public.profiles
set role = 'renter'
where id = '74000000-0000-4000-8000-000000000002';

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
  '74000000-0000-4000-8000-000000000010',
  'Scheduled tour test home',
  '74000000-0000-4000-8000-000000000001',
  'published',
  9800,
  'apartment',
  '30 Open House Street',
  -26.1,
  28.0
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"74000000-0000-4000-8000-000000000001"}',
  true
);

do $$
declare
  schedule_result text;
begin
  select result into schedule_result
  from public.schedule_live_tour(
    '74000000-0000-4000-8000-000000000010',
    '74000000-0000-4000-8000-000000000020',
    'roomza-tour-74000000000040008000000000000020',
    'https://meet.jit.si/roomza-tour-74000000000040008000000000000020',
    now() + interval '20 minutes',
    45
  );
  if schedule_result <> 'scheduled' then
    raise exception 'FAIL: listing owner could not schedule a live tour';
  end if;
end;
$$;
select pass('listing owner can schedule an open house');

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count
  from public.live_tours
  where id = '74000000-0000-4000-8000-000000000020';

  if visible_count <> 1 then
    raise exception 'FAIL: host could not read the scheduled live tour';
  end if;
end;
$$;
select pass('host can read a scheduled tour without moderation-table privileges');

do $$
declare
  projected_status public.live_tour_status;
begin
  select status into projected_status
  from public.get_public_live_tour_status(
    '74000000-0000-4000-8000-000000000020'
  );

  if projected_status <> 'scheduled' then
    raise exception 'FAIL: safe lifecycle status projection is unavailable';
  end if;
end;
$$;
select pass('authenticated waiting rooms can poll the safe tour status');

reset role;
set local role anon;

do $$
declare
  public_count integer;
begin
  select count(*) into public_count
  from public.get_upcoming_public_live_tour(
    '74000000-0000-4000-8000-000000000010'
  );
  if public_count <> 1 then
    raise exception 'FAIL: public upcoming-tour projection is missing';
  end if;
end;
$$;
select pass('upcoming open house is exposed through a bounded public projection');

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"74000000-0000-4000-8000-000000000002"}',
  true
);

do $$
declare
  start_result text;
  cancel_result text;
begin
  select result into start_result
  from public.start_scheduled_live_tour(
    '74000000-0000-4000-8000-000000000020'
  );
  select result into cancel_result
  from public.cancel_scheduled_live_tour(
    '74000000-0000-4000-8000-000000000020'
  );
  if start_result <> 'access_denied' or cancel_result <> 'access_denied' then
    raise exception 'FAIL: renter crossed host-only schedule boundary';
  end if;
end;
$$;
select pass('non-host cannot start or cancel a scheduled open house');

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"74000000-0000-4000-8000-000000000001"}',
  true
);

do $$
declare
  start_result text;
begin
  select result into start_result
  from public.start_scheduled_live_tour(
    '74000000-0000-4000-8000-000000000020'
  );
  if start_result <> 'started' then
    raise exception 'FAIL: host could not start scheduled open house';
  end if;
end;
$$;
select pass('host can transition a scheduled open house to live');

do $$
declare
  consent_result text;
  recording_result text;
begin
  select result into consent_result
  from public.set_live_tour_recording_consent(
    '74000000-0000-4000-8000-000000000020',
    true,
    'phase3-v1'
  );
  select result into recording_result
  from public.start_live_tour_recording(
    '74000000-0000-4000-8000-000000000020',
    array['74000000-0000-4000-8000-000000000002']::uuid[]
  );
  if consent_result <> 'updated'
    or recording_result <> 'feature_disabled' then
    raise exception 'FAIL: legal-review recording flag did not hold closed';
  end if;
end;
$$;
select pass('recording remains disabled before legal-review flag enablement');

reset role;
update public.app_feature_flags
set enabled = true
where key = 'instant_connect_recording';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"74000000-0000-4000-8000-000000000001"}',
  true
);

do $$
declare
  recording_result text;
  missing_count integer;
begin
  select result, missing_consents
  into recording_result, missing_count
  from public.start_live_tour_recording(
    '74000000-0000-4000-8000-000000000020',
    array['74000000-0000-4000-8000-000000000002']::uuid[]
  );
  if recording_result <> 'consent_required' or missing_count <> 1 then
    raise exception 'FAIL: viewer consent was not required';
  end if;
end;
$$;
select pass('recording requires consent from every active participant');

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"74000000-0000-4000-8000-000000000002"}',
  true
);

select result
from public.set_live_tour_recording_consent(
  '74000000-0000-4000-8000-000000000020',
  true,
  'phase3-v1'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"74000000-0000-4000-8000-000000000001"}',
  true
);

do $$
declare
  recording_result text;
  finish_result text;
begin
  select result into recording_result
  from public.start_live_tour_recording(
    '74000000-0000-4000-8000-000000000020',
    array['74000000-0000-4000-8000-000000000002']::uuid[]
  );
  select result into finish_result
  from public.finish_live_tour_recording(
    '74000000-0000-4000-8000-000000000020',
    'stopped',
    null
  );
  if recording_result <> 'recording' or finish_result <> 'stopped' then
    raise exception 'FAIL: fully consented recording lifecycle failed';
  end if;
end;
$$;
select pass('two-sided consent unlocks and completes recording');

reset role;

do $$
begin
  if (
    select count(*)
    from public.consent_events
    where consent_key = 'live_tour_recording'
      and granted
  ) <> 2 then
    raise exception 'FAIL: POPIA consent history was not captured';
  end if;
end;
$$;
select pass('recording consent is appended to POPIA consent history');

select * from finish();
rollback;
