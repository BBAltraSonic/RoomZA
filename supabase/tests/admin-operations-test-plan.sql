-- Admin operations security acceptance plan. Run after the additive migration.
begin;

do $$
declare
  owner_id constant uuid := '10000000-0000-4000-8000-000000000001';
  admin_id constant uuid := '10000000-0000-4000-8000-000000000002';
  renter_id constant uuid := '10000000-0000-4000-8000-000000000003';
  landlord_id constant uuid := '10000000-0000-4000-8000-000000000004';
  listing_id constant uuid := '10000000-0000-4000-8000-000000000005';
begin
  if has_table_privilege('anon', 'public.admin_memberships', 'select')
    or has_table_privilege('authenticated', 'public.admin_memberships', 'select')
    or has_table_privilege('authenticated', 'public.admin_audit_events', 'insert') then
    raise exception 'FAIL: browser roles have direct admin-table privileges';
  end if;

  if has_function_privilege('authenticated', 'public.admin_set_membership(uuid,uuid,public.admin_level,boolean,text,text)', 'execute')
    or not has_function_privilege('service_role', 'public.admin_set_membership(uuid,uuid,public.admin_level,boolean,text,text)', 'execute') then
    raise exception 'FAIL: privileged RPC execution boundary is wrong';
  end if;

  insert into auth.users(id, email, email_confirmed_at) values
    (owner_id, 'admin-plan-owner@example.com', now()),
    (admin_id, 'admin-plan-admin@example.com', now()),
    (renter_id, 'admin-plan-renter@example.com', now()),
    (landlord_id, 'admin-plan-landlord@example.com', now());
  update public.profiles set role = 'renter', email_verified_at = now() where id = renter_id;
  update public.profiles set role = 'landlord', email_verified_at = now() where id = landlord_id;

  insert into public.admin_memberships(user_id, level) values (owner_id, 'owner'), (admin_id, 'admin');
  insert into public.listings(id, title, landlord_id, status, price, property_type, address, latitude, longitude, bedrooms, bathrooms, parking_type, electricity_type, water_availability, lease_duration, availability_date)
  values (listing_id, 'Restricted admin plan listing', landlord_id, 'published', 9000, 'apartment', '1 Test Street', -26.1, 28.0, 1, 1, 'none', 'prepaid', 'municipal', '12_months', current_date + 30);

  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', landlord_id), true);
  if not exists (select 1 from public.duplicate_listing(listing_id) where result = 'duplicated' and duplicate_listing.listing_id is not null) then
    raise exception 'FAIL: duplicate_listing cannot copy a generated-location listing';
  end if;
  if not exists (select 1 from public.record_auth_login_failure(repeat('a', 64), 5, 900) where attempt_count = 1) then
    raise exception 'FAIL: login failure recording did not return its row';
  end if;

  begin
    perform public.assert_admin_actor(admin_id, true);
    raise exception 'FAIL: admin passed owner-only boundary';
  exception when insufficient_privilege then null;
  end;

  insert into public.admin_audit_events(actor_id, action_key, target_type) values (owner_id, 'test.created', 'test');
  begin
    update public.admin_audit_events set target_type = 'mutated' where action_key = 'test.created';
    raise exception 'FAIL: audit update was allowed';
  exception when raise_exception then
    if sqlerrm <> 'admin_audit_events is append-only' then raise; end if;
  end;

  begin
    update public.admin_memberships set revoked_at = now() where user_id = owner_id;
    raise exception 'FAIL: last owner revocation was allowed';
  exception when raise_exception then
    if sqlerrm <> 'cannot remove the last active owner' then raise; end if;
  end;

  insert into public.account_suspensions(user_id, suspended_by, reason)
  values (renter_id, owner_id, 'Acceptance test account suspension');
  insert into public.listing_restrictions(listing_id, restricted_by, reason)
  values (listing_id, owner_id, 'Acceptance test listing restriction');
end;
$$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$ declare visible_count integer; begin
  select count(*) into visible_count from public.profiles where id = '10000000-0000-4000-8000-000000000003';
  if visible_count <> 0 then raise exception 'FAIL: suspended account retained private database access'; end if;
end $$;
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ declare visible_count integer; begin
  select count(*) into visible_count from public.listings where id = '10000000-0000-4000-8000-000000000005';
  if visible_count <> 0 then raise exception 'FAIL: restricted listing leaked through table select'; end if;
  select count(*) into visible_count from public.get_published_listings_in_bbox(27.0, -27.0, 29.0, -25.0)
    where id = '10000000-0000-4000-8000-000000000005';
  if visible_count <> 0 then raise exception 'FAIL: restricted listing leaked through viewport RPC'; end if;
end $$;
reset role;

rollback;
