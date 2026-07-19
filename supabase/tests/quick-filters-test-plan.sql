-- Quick Filters and NSFAS accreditation acceptance plan.
-- Runs entirely inside a transaction and leaves the local database unchanged.
begin;

do $$
declare
  test_admin_id constant uuid := '20000000-0000-4000-8000-000000000001';
  test_landlord_id constant uuid := '20000000-0000-4000-8000-000000000002';
  test_listing_id constant uuid := '20000000-0000-4000-8000-000000000003';
  projected record;
begin
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'listing_accreditations'
      and c.relrowsecurity
  ) then
    raise exception 'FAIL: listing_accreditations RLS is not enabled';
  end if;

  if not has_column_privilege('anon', 'public.listing_accreditations', 'listing_id', 'select')
    or not has_column_privilege('anon', 'public.listing_accreditations', 'nsfas_approved', 'select')
    or has_column_privilege('anon', 'public.listing_accreditations', 'verified_by', 'select')
    or has_column_privilege('anon', 'public.listing_accreditations', 'verified_at', 'select') then
    raise exception 'FAIL: public accreditation column privileges are incorrect';
  end if;

  if has_function_privilege(
    'anon',
    'public.admin_set_nsfas_accreditation(uuid,uuid,boolean,text,text)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.admin_set_nsfas_accreditation(uuid,uuid,boolean,text,text)',
    'execute'
  ) or not has_function_privilege(
    'service_role',
    'public.admin_set_nsfas_accreditation(uuid,uuid,boolean,text,text)',
    'execute'
  ) then
    raise exception 'FAIL: NSFAS admin RPC execution boundary is incorrect';
  end if;

  insert into auth.users(id, email, email_confirmed_at) values
    (test_admin_id, 'quick-filter-admin@example.com', now()),
    (test_landlord_id, 'quick-filter-landlord@example.com', now());

  update public.profiles
  set role = 'landlord', email_verified_at = now()
  where id = test_landlord_id;

  insert into public.admin_memberships(user_id, level)
  values (test_admin_id, 'admin');

  insert into public.listings(
    id,
    title,
    landlord_id,
    status,
    price,
    property_type,
    address,
    latitude,
    longitude,
    bedrooms,
    bathrooms,
    parking_type,
    electricity_type,
    water_availability,
    lease_duration,
    availability_date,
    metadata
  )
  values (
    test_listing_id,
    'Quick Filter furnished home',
    test_landlord_id,
    'published',
    9000,
    'apartment',
    '1 Quick Filter Street',
    -26.1,
    28.0,
    1,
    1,
    'none',
    'prepaid',
    'municipal',
    '12_months',
    current_date + 30,
    '{"amenities":{"essentials":["furnished"]}}'::jsonb
  );

  perform public.admin_set_nsfas_accreditation(
    test_admin_id,
    test_listing_id,
    true,
    'Quick Filter acceptance approval',
    'quick-filter-approve'
  );

  if not exists (
    select 1
    from public.listing_accreditations
    where listing_accreditations.listing_id = test_listing_id
      and nsfas_approved
      and verified_by = test_admin_id
      and verified_at is not null
  ) then
    raise exception 'FAIL: approval did not create the verified accreditation record';
  end if;

  if not exists (
    select 1
    from public.admin_audit_events
    where request_id = 'quick-filter-approve'
      and action_key = 'listing.nsfas_approved'
      and target_id = test_listing_id
  ) then
    raise exception 'FAIL: approval audit event was not recorded';
  end if;

  select *
  into projected
  from public.get_published_listings_in_bbox_with_query(
    27.99,
    -26.11,
    28.01,
    -26.09,
    null,
    null,
    null,
    null,
    null,
    null,
    'rent'
  )
  where id = test_listing_id;

  if projected.id is null
    or not projected.nsfas_approved
    or not projected.furnished
    or projected.created_at is null then
    raise exception 'FAIL: public discovery projection omitted Quick Filter facts';
  end if;

  perform public.admin_set_nsfas_accreditation(
    test_admin_id,
    test_listing_id,
    false,
    'Quick Filter acceptance revocation',
    'quick-filter-revoke'
  );

  if exists (
    select 1
    from public.listing_accreditations
    where listing_accreditations.listing_id = test_listing_id
  ) then
    raise exception 'FAIL: revocation did not remove accreditation';
  end if;

  if not exists (
    select 1
    from public.admin_audit_events
    where request_id = 'quick-filter-revoke'
      and action_key = 'listing.nsfas_revoked'
      and target_id = test_listing_id
  ) then
    raise exception 'FAIL: revocation audit event was not recorded';
  end if;
end;
$$;

set local role anon;
select listing_id, nsfas_approved
from public.listing_accreditations
limit 1;
reset role;

rollback;
