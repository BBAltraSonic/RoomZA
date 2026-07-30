-- Pinpoint Profile Core privacy, persona, document, verification, and RLS plan.
-- Run against a disposable local database after all migrations.
begin;
select plan(12);

insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data) values
  (
    '76000000-0000-4000-8000-000000000001',
    'alex.profile.one@example.com',
    now(),
    '{"full_name":"Alex Profile"}'::jsonb
  ),
  (
    '76000000-0000-4000-8000-000000000002',
    'alex.profile.two@example.com',
    now(),
    '{"full_name":"Alex Profile"}'::jsonb
  ),
  (
    '76000000-0000-4000-8000-000000000003',
    'profile-landlord@example.com',
    now(),
    '{"full_name":"Profile Landlord"}'::jsonb
  );

insert into public.profile_personas(profile_id, persona, is_primary, is_active) values
  ('76000000-0000-4000-8000-000000000001', 'renter', true, true),
  ('76000000-0000-4000-8000-000000000002', 'buyer', true, true),
  ('76000000-0000-4000-8000-000000000003', 'landlord', true, true);

insert into public.renter_profile_details(
  profile_id,
  monthly_income,
  rent_budget_min,
  rent_budget_max
) values (
  '76000000-0000-4000-8000-000000000001',
  32000,
  7000,
  11000
);

update public.public_profiles
set profile_audience = 'members'
where profile_id = '76000000-0000-4000-8000-000000000002';

insert into public.profile_documents(
  id,
  owner_id,
  document_type,
  display_name
) values (
  '76000000-0000-4000-8000-000000000010',
  '76000000-0000-4000-8000-000000000001',
  'payslip',
  'June payslip'
);

insert into public.profile_document_versions(
  id,
  document_id,
  owner_id,
  version,
  bucket,
  path,
  mime_type,
  size_bytes,
  checksum_sha256
) values (
  '76000000-0000-4000-8000-000000000011',
  '76000000-0000-4000-8000-000000000010',
  '76000000-0000-4000-8000-000000000001',
  1,
  'profile-documents',
  '76000000-0000-4000-8000-000000000001/76000000-0000-4000-8000-000000000010/76000000-0000-4000-8000-000000000011',
  'application/pdf',
  1024,
  repeat('a', 64)
);

update public.profile_documents
set current_version_id = '76000000-0000-4000-8000-000000000011'
where id = '76000000-0000-4000-8000-000000000010';

insert into public.verification_checks(
  id,
  profile_id,
  check_key,
  status,
  submitted_at
) values (
  '76000000-0000-4000-8000-000000000020',
  '76000000-0000-4000-8000-000000000001',
  'income',
  'submitted',
  now()
);

do $$
begin
  if has_table_privilege('anon', 'public.profiles', 'select')
    or has_table_privilege('anon', 'public.renter_profile_details', 'select')
    or has_table_privilege('anon', 'public.profile_documents', 'select')
    or has_table_privilege('anon', 'public.profile_document_versions', 'select')
    or has_table_privilege('anon', 'public.verification_check_history', 'select')
    or has_table_privilege('anon', 'public.account_security_events', 'select') then
    raise exception 'anonymous role has a sensitive profile-table grant';
  end if;
end;
$$;
select pass('anonymous users have no sensitive profile-table grants');

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'public_profiles'
      and column_name in (
        'email',
        'phone',
        'monthly_income',
        'income',
        'security_events',
        'documents'
      )
  ),
  0,
  'public_profiles contains no private account, financial, document, or security columns'
);

select ok(
  (
    select count(distinct username) = 3
      and bool_and(username ~ '^[a-z0-9_]{3,30}$')
    from public.public_profiles
    where profile_id in (
      '76000000-0000-4000-8000-000000000001',
      '76000000-0000-4000-8000-000000000002',
      '76000000-0000-4000-8000-000000000003'
    )
  ),
  'username backfill and collision handling produce unique valid usernames'
);

select ok(
  exists (
    select 1
    from public.profile_personas
    where profile_id = '76000000-0000-4000-8000-000000000001'
      and persona = 'renter'
  )
  and not exists (
    select 1
    from public.profile_personas
    where profile_id = '76000000-0000-4000-8000-000000000001'
      and persona = 'landlord'
  ),
  'persona backfill does not infer unrelated marketplace capabilities'
);

select is(
  (
    select count(*)::integer
    from public.verification_check_history
    where verification_check_id = '76000000-0000-4000-8000-000000000020'
      and status = 'submitted'
  ),
  1,
  'verification changes append an immutable status-history row'
);

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is(
  (
    select count(*)::integer
    from public.public_profiles
    where profile_id in (
      '76000000-0000-4000-8000-000000000001',
      '76000000-0000-4000-8000-000000000002'
    )
  ),
  1,
  'anonymous users see everyone profiles but not members-only profiles'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"76000000-0000-4000-8000-000000000001"}',
  true
);
select is(
  (
    select count(*)::integer
    from public.profiles
    where id in (
      '76000000-0000-4000-8000-000000000001',
      '76000000-0000-4000-8000-000000000002'
    )
  ),
  1,
  'authenticated users can read only their own private account row'
);

select is(
  (
    select count(*)::integer
    from public.renter_profile_details
    where profile_id in (
      '76000000-0000-4000-8000-000000000001',
      '76000000-0000-4000-8000-000000000002'
    )
  ),
  1,
  'persona financial details remain owner-only'
);

select is(
  (
    select count(*)::integer
    from public.profile_document_versions
    where owner_id = '76000000-0000-4000-8000-000000000001'
  ),
  1,
  'document owners can read their vault versions'
);

insert into public.profile_blocks(blocker_id, blocked_id) values (
  '76000000-0000-4000-8000-000000000001',
  '76000000-0000-4000-8000-000000000002'
);
select is(
  (
    select count(*)::integer
    from public.public_profiles
    where profile_id = '76000000-0000-4000-8000-000000000002'
  ),
  0,
  'blocking removes the blocked profile from mutual discovery'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"76000000-0000-4000-8000-000000000002"}',
  true
);
select is(
  (
    select count(*)::integer
    from public.profile_document_versions
    where owner_id = '76000000-0000-4000-8000-000000000001'
  ),
  0,
  'cross-user document-version reads are denied'
);

do $$
begin
  begin
    update public.notification_subscriptions
    set enabled = false
    where user_id = '76000000-0000-4000-8000-000000000002'
      and category = 'security'
      and channel = 'in_app';
    raise exception 'mandatory security notification was disabled';
  exception
    when check_violation then null;
  end;
end;
$$;
select pass('mandatory security in-app notifications cannot be disabled');
reset role;

select * from finish();
rollback;
