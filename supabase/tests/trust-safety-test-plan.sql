-- Trust, privacy, policy governance, and moderation-target acceptance plan.
-- Run against a disposable local database after all migrations.
begin;

do $$
declare
  owner_id constant uuid := '50000000-0000-4000-8000-000000000001';
  admin_id constant uuid := '50000000-0000-4000-8000-000000000002';
  user_one constant uuid := '50000000-0000-4000-8000-000000000003';
  user_two constant uuid := '50000000-0000-4000-8000-000000000004';
  listing_id constant uuid := '50000000-0000-4000-8000-000000000005';
  target_document_id uuid;
  draft_id uuid;
begin
  if has_table_privilege('anon', 'public.verification_checks', 'select')
    or has_table_privilege('authenticated', 'public.verification_checks', 'select')
    or has_table_privilege('authenticated', 'public.privacy_requests', 'insert') then
    raise exception 'FAIL: service-only trust evidence or privacy operations are browser-accessible';
  end if;
  if not has_function_privilege('anon', 'public.get_public_listing_trust_signals(uuid[])', 'execute') then
    raise exception 'FAIL: safe public listing trust-signal RPC is unavailable';
  end if;
  if has_function_privilege('authenticated', 'public.admin_publish_trust_version(uuid,uuid,text)', 'execute')
    or has_function_privilege('authenticated', 'public.admin_rollback_trust_version(uuid,uuid,text,boolean)', 'execute')
    or has_function_privilege('authenticated', 'public.admin_revoke_user_sessions(uuid,uuid,text)', 'execute') then
    raise exception 'FAIL: privileged policy publication RPC is browser-accessible';
  end if;

  insert into auth.users(id, email, email_confirmed_at) values
    (owner_id, 'trust-owner@example.com', now()),
    (admin_id, 'trust-admin@example.com', now()),
    (user_one, 'trust-user-one@example.com', now()),
    (user_two, 'trust-user-two@example.com', now());
  update public.profiles set role = 'renter', email_verified_at = now() where id in (user_one, user_two);
  update public.profiles set role = 'landlord', email_verified_at = now() where id = owner_id;
  insert into public.admin_memberships(user_id, level) values (owner_id, 'owner'), (admin_id, 'admin');

  select id into target_document_id from public.trust_documents where slug = 'cookies';
  select id into draft_id from public.trust_document_versions where document_id = target_document_id and status = 'draft' limit 1;
  begin
    perform public.admin_publish_trust_version(admin_id, draft_id, 'trust-test-admin-publish');
    raise exception 'FAIL: non-owner published a policy';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.trust_document_versions set body_markdown = 'Changed after publication'
    where id = (select id from public.trust_document_versions where status = 'published' limit 1);
    raise exception 'FAIL: immutable published policy was edited';
  exception when raise_exception then
    if sqlerrm <> 'published trust document versions are immutable' then raise; end if;
  end;

  insert into public.listings(id, title, landlord_id, status, price, property_type, address, latitude, longitude, bedrooms, bathrooms, parking_type, electricity_type, water_availability, lease_duration, availability_date)
  values (listing_id, 'Trust test listing', owner_id, 'published', 8000, 'apartment', '2 Trust Street', -26.1, 28.0, 1, 1, 'none', 'prepaid', 'municipal', '12_months', current_date + 30);
  begin
    insert into public.moderation_cases(reporter_id, listing_id, reported_user_id, category, details)
    values (user_one, listing_id, user_two, 'safety', 'Invalid report with more than one target.');
    raise exception 'FAIL: moderation case accepted multiple targets';
  exception when check_violation then null;
  end;

  insert into public.privacy_requests(user_id, request_type, details) values
    (user_one, 'correction', 'Correct the profile information for test user one.'),
    (user_two, 'correction', 'Correct the profile information for test user two.');
end;
$$;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ declare visible_drafts integer; visible_published integer; begin
  select count(*) into visible_drafts from public.trust_document_versions where status = 'draft';
  select count(*) into visible_published from public.trust_document_versions where status = 'published';
  if visible_drafts <> 0 or visible_published < 2 then raise exception 'FAIL: anonymous policy visibility is incorrect'; end if;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$ declare own_requests integer; begin
  select count(*) into own_requests from public.privacy_requests;
  if own_requests <> 1 then raise exception 'FAIL: privacy request cross-user isolation failed'; end if;
end $$;
reset role;

rollback;

select 'PASS: trust, privacy, and moderation security checks' as result;
