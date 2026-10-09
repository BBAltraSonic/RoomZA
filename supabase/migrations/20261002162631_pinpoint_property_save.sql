-- Trusted server primitive. Ordinary JWTs retain their existing table revokes.
-- The actor comes from the authenticated application, never form data.
create function public.pinpoint_property_save(
  actor_id uuid, target uuid, expected_updated_at timestamptz, payload jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  current_listing public.listings%rowtype;
  edited public.listings%rowtype;
  membership_id uuid;
  active_org uuid;
begin
  if actor_id is null or not exists (
    select 1 from public.profiles p
    where p.id = actor_id and p.email_verified_at is not null
      and exists (select 1 from public.profile_personas pp
        where pp.profile_id = p.id and pp.persona::text in ('landlord', 'seller'))
  ) or exists (
    select 1 from public.account_suspensions s where s.user_id = actor_id
      and s.restored_at is null
      and (s.suspended_until is null or s.suspended_until > statement_timestamp())
  ) then
    raise exception 'Listing not found or access denied' using errcode = '42501';
  end if;
  select * into current_listing from public.listings where id = target for update;
  if not found then
    raise exception 'Listing not found or access denied' using errcode = '42501';
  end if;
  if current_listing.landlord_id is distinct from actor_id then
    select active_organization_id into active_org from public.profiles where id = actor_id for share;
    select m.id into membership_id from public.organization_memberships m
      join public.organizations o on o.id = m.organization_id
      where m.user_id = actor_id and m.organization_id = current_listing.organization_id
        and m.organization_id = active_org and m.role in ('owner', 'admin')
        and m.revoked_at is null and o.deleted_at is null
      for share of m, o;
    if membership_id is null then
      raise exception 'Listing not found or access denied' using errcode = '42501';
    end if;
  end if;
  if expected_updated_at is null or current_listing.updated_at is distinct from expected_updated_at then
    raise exception 'Listing changed; reload before saving' using errcode = 'PT409';
  end if;
  if payload is null or jsonb_typeof(payload) <> 'object' or payload = '{}'::jsonb
    or octet_length(payload::text) > 100000 or exists (
      select 1 from jsonb_object_keys(payload) k where k not in (
        'title','description','property_type','price','listing_type','sale_price','address',
        'latitude','longitude','bedrooms','bathrooms','parking_type','parking_count',
        'electricity_type','water_availability','electricity_included','electricity_estimate',
        'water_included','water_estimate','wifi_available','wifi_included','wifi_estimate',
        'parking_included','parking_estimate','security_fee_estimate','lease_duration',
        'availability_date','metadata'
      )
    ) then
    raise exception 'Invalid listing content' using errcode = '22023';
  end if;
  edited := jsonb_populate_record(current_listing, payload);
  update public.listings set
    title = edited.title, description = edited.description, property_type = edited.property_type,
    price = edited.price, listing_type = edited.listing_type, sale_price = edited.sale_price,
    address = edited.address, latitude = edited.latitude, longitude = edited.longitude,
    bedrooms = edited.bedrooms, bathrooms = edited.bathrooms,
    parking_type = edited.parking_type, parking_count = edited.parking_count,
    electricity_type = edited.electricity_type, water_availability = edited.water_availability,
    electricity_included = edited.electricity_included, electricity_estimate = edited.electricity_estimate,
    water_included = edited.water_included, water_estimate = edited.water_estimate,
    wifi_available = edited.wifi_available, wifi_included = edited.wifi_included,
    wifi_estimate = edited.wifi_estimate, parking_included = edited.parking_included,
    parking_estimate = edited.parking_estimate, security_fee_estimate = edited.security_fee_estimate,
    lease_duration = edited.lease_duration, availability_date = edited.availability_date,
    metadata = edited.metadata,
    updated_at = greatest(clock_timestamp(), current_listing.updated_at + interval '1 microsecond')
    where id = target returning * into edited;
  return jsonb_build_object('listingId', edited.id, 'updatedAt', edited.updated_at);
end;
$$;
revoke all on function public.pinpoint_property_save(uuid, uuid, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.pinpoint_property_save(uuid, uuid, timestamptz, jsonb) to service_role;
