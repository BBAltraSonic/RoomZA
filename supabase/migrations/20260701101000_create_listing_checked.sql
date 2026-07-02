create or replace function public.create_listing_checked(
  title text,
  description text,
  property_type text,
  price integer,
  address text,
  latitude numeric,
  longitude numeric,
  bedrooms numeric,
  bathrooms numeric,
  parking_type text,
  parking_count integer,
  electricity_type text,
  water_availability text,
  electricity_included boolean,
  electricity_estimate integer,
  water_included boolean,
  water_estimate integer,
  wifi_available boolean,
  wifi_included boolean,
  wifi_estimate integer,
  parking_included boolean,
  parking_estimate integer,
  security_fee_estimate integer,
  lease_duration text,
  availability_date date,
  metadata jsonb
)
returns table(listing_id uuid, result text)
language plpgsql
security invoker
set search_path = public
set statement_timeout = '2500ms'
as $$
declare
  new_listing_id uuid := gen_random_uuid();
begin
  if auth.uid() is null or not public.has_profile_role('landlord') then
    return query select null::uuid, 'access_denied'::text;
    return;
  end if;

  insert into public.listings (
    id, landlord_id, title, description, property_type, price, address,
    latitude, longitude, bedrooms, bathrooms, parking_type, parking_count,
    electricity_type, water_availability, electricity_included,
    electricity_estimate, water_included, water_estimate, wifi_available,
    wifi_included, wifi_estimate, parking_included, parking_estimate,
    security_fee_estimate, lease_duration, availability_date, metadata,
    status
  )
  values (
    new_listing_id, auth.uid(), create_listing_checked.title,
    nullif(trim(create_listing_checked.description), ''),
    create_listing_checked.property_type, create_listing_checked.price,
    create_listing_checked.address, create_listing_checked.latitude,
    create_listing_checked.longitude, create_listing_checked.bedrooms,
    create_listing_checked.bathrooms, create_listing_checked.parking_type,
    create_listing_checked.parking_count, create_listing_checked.electricity_type,
    create_listing_checked.water_availability,
    create_listing_checked.electricity_included,
    create_listing_checked.electricity_estimate,
    create_listing_checked.water_included, create_listing_checked.water_estimate,
    create_listing_checked.wifi_available, create_listing_checked.wifi_included,
    create_listing_checked.wifi_estimate, create_listing_checked.parking_included,
    create_listing_checked.parking_estimate,
    create_listing_checked.security_fee_estimate,
    create_listing_checked.lease_duration,
    create_listing_checked.availability_date,
    coalesce(create_listing_checked.metadata, '{}'::jsonb),
    'draft'
  );

  return query select new_listing_id, 'created'::text;
exception
  when query_canceled then
    return query select null::uuid, 'timeout'::text;
  when check_violation or not_null_violation or invalid_text_representation then
    return query select null::uuid, 'invalid_input'::text;
end;
$$;

revoke all on function public.create_listing_checked(
  text, text, text, integer, text, numeric, numeric, numeric, numeric,
  text, integer, text, text, boolean, integer, boolean, integer, boolean,
  boolean, integer, boolean, integer, integer, text, date, jsonb
) from public, anon;
grant execute on function public.create_listing_checked(
  text, text, text, integer, text, numeric, numeric, numeric, numeric,
  text, integer, text, text, boolean, integer, boolean, integer, boolean,
  boolean, integer, boolean, integer, integer, text, date, jsonb
) to authenticated;
