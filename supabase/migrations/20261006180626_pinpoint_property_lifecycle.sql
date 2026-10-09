-- Only the trusted server can supply an actor/session. Ordinary table ACLs stay intact.
create function public.pinpoint_property_lifecycle(
  actor_id uuid, actor_session_id uuid, target uuid,
  expected_updated_at timestamptz, command text
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  source_listing public.listings%rowtype;
  edited public.listings%rowtype;
  active_org uuid;
  membership_id uuid;
  new_listing_id uuid := gen_random_uuid();
begin
  if command is null or command not in ('publish','unpublish','archive','restore','delete','duplicate') then
    raise exception 'Invalid command' using errcode = '22023';
  end if;
  if not public.pinpoint_active_session(actor_id, actor_session_id) then
    raise exception 'Listing not found or access denied' using errcode = '42501';
  end if;
  select p.active_organization_id into active_org from public.profiles p
    where p.id = actor_id and p.email_verified_at is not null
      and exists (select 1 from public.profile_personas pp where pp.profile_id = p.id
        and pp.persona::text in ('landlord','seller')) for share;
  if not found or exists (select 1 from public.account_suspensions s
    where s.user_id = actor_id and s.restored_at is null
      and (s.suspended_until is null or s.suspended_until > statement_timestamp())) then
    raise exception 'Listing not found or access denied' using errcode = '42501';
  end if;
  select * into source_listing from public.listings where id = target for update;
  if not found then
    raise exception 'Listing not found or access denied' using errcode = '42501';
  end if;
  -- Organization listings require current owner/admin membership even for their creator.
  if source_listing.organization_id is not null then
    select m.id into membership_id from public.organization_memberships m
      join public.organizations o on o.id = m.organization_id
      where m.user_id = actor_id and m.organization_id = source_listing.organization_id
        and m.organization_id = active_org and m.role in ('owner','admin')
        and m.revoked_at is null and o.deleted_at is null for share of m, o;
    if membership_id is null then
      raise exception 'Listing not found or access denied' using errcode = '42501';
    end if;
  elsif source_listing.landlord_id is distinct from actor_id then
    raise exception 'Listing not found or access denied' using errcode = '42501';
  end if;
  if expected_updated_at is null or source_listing.updated_at is distinct from expected_updated_at then
    raise exception 'Listing changed; reload before changing it' using errcode = 'PT409';
  end if;
  if (command = 'publish' and source_listing.status <> 'draft')
    or (command = 'unpublish' and source_listing.status <> 'published')
    or (command = 'archive' and source_listing.status = 'archived')
    or (command = 'restore' and source_listing.status <> 'archived') then
    raise exception 'Invalid listing transition' using errcode = 'PT422';
  end if;
  if command = 'publish' then
    perform 1 from public.listing_images where listing_id=target for share;
  end if;
  if command = 'publish' and (select count(*) from public.listing_images where listing_id = target) < 3 then
    raise exception 'Add required photos before publishing' using errcode = 'PT422';
  end if;
  if command = 'delete' then
    -- Serialize application inserts that take the listing FK key-share lock.
    if exists (select 1 from public.applications where listing_id = target
      and status in ('submitted','under_review','shortlisted','approved')) then
      raise exception 'Active applications; archive instead' using errcode = 'PT422';
    end if;
    delete from public.listings where id = target;
    -- Storage objects intentionally retained: another draft may reference the same path.
    return jsonb_build_object('listingId', target, 'updatedAt', source_listing.updated_at);
  elsif command = 'duplicate' then
    insert into public.listings (
      id, landlord_id, organization_id, listing_type, title, description, price, sale_price,
      address, address_fingerprint, latitude, longitude, property_type, bedrooms,
      bathrooms, availability_date, lease_duration, status, water_included, water_estimate,
      water_availability, electricity_included, electricity_estimate, electricity_type,
      parking_included, parking_estimate, parking_type, parking_count, wifi_included,
      wifi_estimate, wifi_available, security_fee_estimate, metadata, is_featured
    ) values (
      new_listing_id, source_listing.landlord_id, source_listing.organization_id,
      source_listing.listing_type, coalesce(nullif(trim(source_listing.title), ''), 'Untitled listing') || ' (Copy)',
      source_listing.description, source_listing.price, source_listing.sale_price,
      source_listing.address, source_listing.address_fingerprint, source_listing.latitude,
      source_listing.longitude, source_listing.property_type, source_listing.bedrooms,
      source_listing.bathrooms, source_listing.availability_date, source_listing.lease_duration,
      'draft', source_listing.water_included, source_listing.water_estimate,
      source_listing.water_availability, source_listing.electricity_included,
      source_listing.electricity_estimate, source_listing.electricity_type,
      source_listing.parking_included, source_listing.parking_estimate,
      source_listing.parking_type, source_listing.parking_count, source_listing.wifi_included,
      source_listing.wifi_estimate, source_listing.wifi_available,
      source_listing.security_fee_estimate, source_listing.metadata, false
    ) returning * into edited;
    insert into public.listing_images(listing_id,bucket,path,public_url,sort_order)
      select new_listing_id,bucket,path,public_url,sort_order from public.listing_images where listing_id = target;
    select * into edited from public.listings where id=new_listing_id;
  else
    update public.listings set status = case command
      when 'publish' then 'published'::public.listing_status
      when 'archive' then 'archived'::public.listing_status
      else 'draft'::public.listing_status end,
      updated_at = greatest(clock_timestamp(), source_listing.updated_at + interval '1 microsecond')
      where id = target returning * into edited;
  end if;
  return jsonb_build_object('listingId', edited.id, 'updatedAt', edited.updated_at);
end;
$$;
revoke all on function public.pinpoint_property_lifecycle(uuid,uuid,uuid,timestamptz,text) from public, anon, authenticated;
grant execute on function public.pinpoint_property_lifecycle(uuid,uuid,uuid,timestamptz,text) to service_role;

