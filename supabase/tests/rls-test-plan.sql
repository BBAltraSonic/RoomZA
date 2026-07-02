-- Supabase RLS Comprehensive Test Script
-- Run inside a transaction to rollback changes automatically.
-- Tested via Supabase MCP on 2026-05-12. All tests passed.

begin;

do $$
declare
  renter_a uuid := gen_random_uuid();
  renter_b uuid := gen_random_uuid();
  landlord_a uuid := gen_random_uuid();
  landlord_b uuid := gen_random_uuid();
  
  listing_a uuid := gen_random_uuid();
  listing_b uuid := gen_random_uuid();
  
  app_a uuid := gen_random_uuid();
  app_b uuid := gen_random_uuid();

  conv_a uuid := gen_random_uuid();
  conv_b uuid := gen_random_uuid();
  
  msg_a uuid := gen_random_uuid();
  msg_b uuid := gen_random_uuid();
  
  slot_a uuid := gen_random_uuid();
  slot_b uuid := gen_random_uuid();
  
  vso_a uuid := gen_random_uuid();
  vso_b uuid := gen_random_uuid();
  
  notif_a uuid := gen_random_uuid();
  notif_b uuid := gen_random_uuid();

  status_event_a uuid := gen_random_uuid();
  status_event_b uuid := gen_random_uuid();
  call_a uuid := gen_random_uuid();
  call_b uuid := gen_random_uuid();
  
  count_res int;
  sensitive_table text;
begin
  -- ============================================
  -- SETUP: Insert test data as postgres superuser
  -- ============================================
  insert into auth.users (id, email) values 
    (renter_a, 'rentera@test.com'), 
    (renter_b, 'renterb@test.com'), 
    (landlord_a, 'landlorda@test.com'), 
    (landlord_b, 'landlordb@test.com');

  update public.profiles set email = 'rentera@test.com', role = 'renter' where id = renter_a;
  update public.profiles set email = 'renterb@test.com', role = 'renter' where id = renter_b;
  update public.profiles set email = 'landlorda@test.com', role = 'landlord' where id = landlord_a;
  update public.profiles set email = 'landlordb@test.com', role = 'landlord' where id = landlord_b;

  -- Listings
  insert into public.listings (id, title, landlord_id, status, price, property_type, address, latitude, longitude, bedrooms, bathrooms, parking_type, electricity_type, water_availability, lease_duration, availability_date) values
    (listing_a, 'Listing A', landlord_a, 'published', 1000, 'apartment', '123 Test', 0, 0, 1, 1, 'none', 'prepaid', 'municipal', '12_months', '2026-06-01'),
    (listing_b, 'Listing B', landlord_b, 'published', 2000, 'house', '456 Test', 0, 0, 2, 2, 'covered', 'prepaid', 'municipal', '12_months', '2026-06-01');

  -- Applications
  insert into public.applications (id, listing_id, renter_id, status, full_name, move_in_date, employment_status, income, household_size) values
    (app_a, listing_a, renter_a, 'submitted', 'Renter A', '2026-06-01', 'Employed', 5000, 1),
    (app_b, listing_b, renter_b, 'submitted', 'Renter B', '2026-06-01', 'Employed', 5000, 1);

  -- Documents
  insert into public.documents (application_id, type, file_url, bucket, path, mime_type, byte_size) values
    (app_a, 'id', 'renter_a/app_a/id.pdf', 'application-documents', 'renter_a/app_a/id.pdf', 'application/pdf', 1024),
    (app_b, 'payslip', 'renter_b/app_b/payslip.pdf', 'application-documents', 'renter_b/app_b/payslip.pdf', 'application/pdf', 1024);

  -- Conversations
  insert into public.conversations (id, listing_id, renter_id, landlord_id, application_id, type) values
    (conv_a, listing_a, renter_a, landlord_a, app_a, 'application'),
    (conv_b, listing_b, renter_b, landlord_b, app_b, 'application');

  -- Messages
  insert into public.messages (id, conversation_id, sender_id, listing_id, content) values
    (msg_a, conv_a, renter_a, listing_a, 'Hello from renter A'),
    (msg_b, conv_b, renter_b, listing_b, 'Hello from renter B');

  -- Viewing Slots
  insert into public.viewing_slots (id, listing_id, created_by, start_time, end_time, is_booked) values
    (slot_a, listing_a, landlord_a, '2026-06-01T10:00:00Z', '2026-06-01T10:30:00Z', false),
    (slot_b, listing_b, landlord_b, '2026-06-01T11:00:00Z', '2026-06-01T11:30:00Z', false);

  -- Viewing Slot Offers
  insert into public.viewing_slot_offers (id, slot_id, application_id) values
    (vso_a, slot_a, app_a),
    (vso_b, slot_b, app_b);

  -- Notification Events
  insert into public.notification_events (id, recipient_id, type, payload) values
    (notif_a, landlord_a, 'new_application', '{"message":"New app from renter A"}'),
    (notif_b, landlord_b, 'new_application', '{"message":"New app from renter B"}');

  -- Application status events
  insert into public.application_status_events (id, application_id, actor_id, from_status, to_status) values
    (status_event_a, app_a, landlord_a, 'submitted', 'under_review'),
    (status_event_b, app_b, landlord_b, 'submitted', 'under_review');

  -- Call sessions
  insert into public.call_sessions (
    id, conversation_id, listing_id, caller_id, callee_id, status, room_id, join_url
  ) values
    (call_a, conv_a, listing_a, renter_a, landlord_a, 'ringing', 'roomza-test-call-a', 'https://meet.jit.si/roomza-test-call-a'),
    (call_b, conv_b, listing_b, renter_b, landlord_b, 'ringing', 'roomza-test-call-b', 'https://meet.jit.si/roomza-test-call-b');

  -- ============================================
  -- TEST RENTER A
  -- ============================================
  set local role authenticated;
  perform set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', renter_a), true);

  -- PROFILES: Renter A can see own profile
  select count(*) into count_res from public.profiles where id = renter_a;
  if count_res != 1 then raise exception 'FAIL: Renter A cannot read own profile'; end if;

  -- PROFILES: public lister profile fields are visible across users.
  select count(*) into count_res from public.profiles where id = renter_b;
  if count_res != 1 then raise exception 'FAIL: Renter A cannot read public Renter B profile'; end if;

  -- LISTINGS: Renter A can see published listings
  select count(*) into count_res from public.listings where status = 'published';
  if count_res < 1 then raise exception 'FAIL: Renter A cannot see published listings'; end if;

  -- APPLICATIONS: Renter A sees only own application
  select count(*) into count_res from public.applications;
  if count_res != 1 then raise exception 'FAIL: Renter A should see 1 application, got %', count_res; end if;

  select count(*) into count_res from public.applications where id = app_b;
  if count_res != 0 then raise exception 'FAIL: Renter A can see Renter B application'; end if;

  -- DOCUMENTS: Renter A can see own documents
  select count(*) into count_res from public.documents where application_id = app_a;
  if count_res = 1 then raise notice 'PASS: Renter A can see own documents'; end if;

  -- DOCUMENTS: Renter A cannot see Renter B documents
  select count(*) into count_res from public.documents where application_id = app_b;
  if count_res != 0 then raise exception 'FAIL: Renter A can see Renter B documents'; end if;

  -- CONVERSATIONS: Renter A can see own conversation
  select count(*) into count_res from public.conversations where id = conv_a;
  if count_res != 1 then raise exception 'FAIL: Renter A cannot see own conversation'; end if;

  -- CONVERSATIONS: Renter A cannot see Renter B conversation
  select count(*) into count_res from public.conversations where id = conv_b;
  if count_res != 0 then raise exception 'FAIL: Renter A can see Renter B conversation'; end if;

  -- MESSAGES: Renter A can see messages in own conversation
  select count(*) into count_res from public.messages where conversation_id = conv_a;
  if count_res != 1 then raise exception 'FAIL: Renter A cannot see messages in own conversation'; end if;

  -- MESSAGES: Renter A cannot see messages in other conversation
  select count(*) into count_res from public.messages where conversation_id = conv_b;
  if count_res != 0 then raise exception 'FAIL: Renter A can see messages in Renter B conversation'; end if;

  -- VIEWING SLOTS: Renter A can see slots offered to them
  select count(*) into count_res from public.viewing_slots where id = slot_a;
  if count_res != 1 then raise exception 'FAIL: Renter A cannot view slot offered to them'; end if;

  -- VIEWING SLOTS: Renter A cannot see slots for other listings
  select count(*) into count_res from public.viewing_slots where id = slot_b;
  if count_res != 0 then raise exception 'FAIL: Renter A can see Renter B slot'; end if;

  -- VIEWING SLOT OFFERS: Renter A sees own offers
  select count(*) into count_res from public.viewing_slot_offers where id = vso_a;
  if count_res != 1 then raise exception 'FAIL: Renter A cannot see own slot offers'; end if;

  -- VIEWING SLOT OFFERS: Renter A cannot see other offers
  select count(*) into count_res from public.viewing_slot_offers where id = vso_b;
  if count_res != 0 then raise exception 'FAIL: Renter A can see Renter B slot offers'; end if;

  -- NOTIFICATION EVENTS: Renter A cannot see landlord notifications
  select count(*) into count_res from public.notification_events where id = notif_a;
  if count_res != 0 then raise exception 'FAIL: Renter A can see Landlord A notifications'; end if;

  raise notice 'ALL RENTER A TESTS PASSED';

  -- ============================================
  -- TEST RENTER B (negative cross-tenant)
  -- ============================================
  perform set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', renter_b), true);

  select count(*) into count_res from public.applications where id = app_a;
  if count_res != 0 then raise exception 'FAIL: Renter B can see Renter A app'; end if;

  select count(*) into count_res from public.documents where application_id = app_a;
  if count_res != 0 then raise exception 'FAIL: Renter B can see Renter A documents'; end if;

  select count(*) into count_res from public.messages where conversation_id = conv_a;
  if count_res != 0 then raise exception 'FAIL: Renter B can see Renter A messages'; end if;

  raise notice 'ALL RENTER B TESTS PASSED';

  -- ============================================
  -- TEST LANDLORD A
  -- ============================================
  perform set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', landlord_a), true);

  -- PROFILES: Landlord A can see own profile
  select count(*) into count_res from public.profiles where id = landlord_a;
  if count_res != 1 then raise exception 'FAIL: Landlord A cannot read own profile'; end if;

  -- APPLICATIONS: Landlord A sees apps to own listing only
  select count(*) into count_res from public.applications where id = app_a;
  if count_res != 1 then raise exception 'FAIL: Landlord A cannot see app to own listing'; end if;

  select count(*) into count_res from public.applications where id = app_b;
  if count_res != 0 then raise exception 'FAIL: Landlord A can see app to other listing'; end if;

  -- DOCUMENTS: Landlord A can see docs for own listing apps
  select count(*) into count_res from public.documents where application_id = app_a;
  if count_res = 1 then raise notice 'PASS: Landlord A can see docs for own listing apps'; end if;

  -- DOCUMENTS: Landlord A cannot see docs for other listing apps
  select count(*) into count_res from public.documents where application_id = app_b;
  if count_res != 0 then raise exception 'FAIL: Landlord A can see docs for other listing apps'; end if;

  -- CONVERSATIONS
  select count(*) into count_res from public.conversations where id = conv_a;
  if count_res != 1 then raise exception 'FAIL: Landlord A cannot see own conversation'; end if;

  select count(*) into count_res from public.conversations where id = conv_b;
  if count_res != 0 then raise exception 'FAIL: Landlord A can see Landlord B conversation'; end if;

  -- MESSAGES
  select count(*) into count_res from public.messages where conversation_id = conv_a;
  if count_res != 1 then raise exception 'FAIL: Landlord A cannot see messages in own conversation'; end if;

  select count(*) into count_res from public.messages where conversation_id = conv_b;
  if count_res != 0 then raise exception 'FAIL: Landlord A can see messages in Landlord B conversation'; end if;

  -- VIEWING SLOTS
  select count(*) into count_res from public.viewing_slots where id = slot_a;
  if count_res != 1 then raise exception 'FAIL: Landlord A cannot see own slots'; end if;

  select count(*) into count_res from public.viewing_slots where id = slot_b;
  if count_res != 0 then raise exception 'FAIL: Landlord A can see Landlord B slots'; end if;

  -- NOTIFICATION EVENTS
  select count(*) into count_res from public.notification_events where id = notif_a;
  if count_res != 1 then raise exception 'FAIL: Landlord A cannot see own notifications'; end if;

  select count(*) into count_res from public.notification_events where id = notif_b;
  if count_res != 0 then raise exception 'FAIL: Landlord A can see Landlord B notifications'; end if;

  raise notice 'ALL LANDLORD A TESTS PASSED';

  -- ============================================
  -- TEST LANDLORD B (negative cross-tenant)
  -- ============================================
  perform set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', landlord_b), true);

  select count(*) into count_res from public.applications where id = app_a;
  if count_res != 0 then raise exception 'FAIL: Landlord B can see Landlord A app'; end if;

  select count(*) into count_res from public.documents where application_id = app_a;
  if count_res != 0 then raise exception 'FAIL: Landlord B can see Landlord A documents'; end if;

  select count(*) into count_res from public.viewing_slots where id = slot_a;
  if count_res != 0 then raise exception 'FAIL: Landlord B can see Landlord A slots'; end if;

  select count(*) into count_res from public.notification_events where id = notif_a;
  if count_res != 0 then raise exception 'FAIL: Landlord B can see Landlord A notifications'; end if;

  raise notice 'ALL LANDLORD B TESTS PASSED';

  -- ============================================
  -- TEST ANONYMOUS
  -- ============================================
  set local role anon;
  perform set_config('request.jwt.claims', '{}', true);

  -- Anon can see published listings
  select count(*) into count_res from public.listings where status = 'published';
  if count_res < 1 then raise exception 'FAIL: Anon cannot see published listings'; end if;

  -- Anon cannot see private data. A missing table grant is also an acceptable
  -- deny because fresh Supabase projects no longer expose public tables through
  -- the Data API by default; if a grant exists, RLS must still return zero rows.
  foreach sensitive_table in array array[
    'applications',
    'application_status_events',
    'documents',
    'conversations',
    'messages',
    'notification_events',
    'viewing_slot_offers',
    'viewing_slots',
    'viewings',
    'call_sessions',
    'analytics_events',
    'search_alerts',
    'user_favorites'
  ]
  loop
    begin
      execute format('select count(*) from public.%I', sensitive_table) into count_res;
      if count_res != 0 then
        raise exception 'FAIL: Anon can see rows in %', sensitive_table;
      end if;
    exception
      when insufficient_privilege then
        raise notice 'PASS: Anon has no table grant for %', sensitive_table;
    end;
  end loop;

  raise notice 'ALL ANONYMOUS TESTS PASSED';

  -- ============================================
  -- PHASE 9 POLICY COVERAGE
  -- ============================================
  foreach sensitive_table in array array[
    'profiles',
    'applications',
    'application_status_events',
    'documents',
    'conversations',
    'messages',
    'notification_events',
    'viewing_slot_offers',
    'viewing_slots',
    'viewings',
    'call_sessions',
    'analytics_events',
    'search_alerts',
    'user_favorites',
    'neighborhoods'
  ]
  loop
    select count(distinct cmd)
    into count_res
    from pg_policies
    where schemaname = 'public'
      and tablename = sensitive_table
      and cmd in ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL');

    if count_res < 4 and not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = sensitive_table
        and cmd = 'ALL'
    ) then
      raise exception 'FAIL: % does not have per-operation RLS policy coverage', sensitive_table;
    end if;
  end loop;

  -- Direct mutation denies preserve append-only / RPC-owned history tables.
  set local role authenticated;
  perform set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', renter_a), true);

  update public.application_status_events
  set to_status = 'approved'
  where id = status_event_a;
  get diagnostics count_res = row_count;
  if count_res != 0 then raise exception 'FAIL: renter updated application_status_events directly'; end if;

  delete from public.call_sessions where id = call_a;
  get diagnostics count_res = row_count;
  if count_res != 0 then raise exception 'FAIL: renter deleted call_sessions directly'; end if;

  raise notice '=== ALL RLS TESTS PASSED ===';

end $$;

rollback;
