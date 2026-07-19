-- Contextual onboarding: let landlords reach first value with a lightweight
-- draft, while the application-level publish-readiness schema continues to
-- require every operational field before public visibility.

alter table public.listings
  alter column bedrooms drop not null,
  alter column bathrooms drop not null,
  alter column parking_type drop not null,
  alter column parking_count drop not null,
  alter column parking_count drop default,
  alter column electricity_type drop not null,
  alter column water_availability drop not null,
  alter column lease_duration drop not null,
  alter column availability_date drop not null;

create or replace function public.create_listing_draft_checked(
  listing_type public.listing_type,
  title text,
  property_type text,
  price integer,
  sale_price integer,
  address text,
  latitude numeric,
  longitude numeric
)
returns table(listing_id uuid, result text)
language plpgsql
security invoker
set search_path = public
set statement_timeout = '2500ms'
as $$
declare
  new_listing_id uuid := gen_random_uuid();
  stored_price integer;
begin
  if auth.uid() is null or not public.has_profile_role('landlord') then
    return query select null::uuid, 'access_denied'::text;
    return;
  end if;

  stored_price := case
    when create_listing_draft_checked.listing_type = 'sale' then create_listing_draft_checked.sale_price
    else create_listing_draft_checked.price
  end;

  if stored_price is null or stored_price <= 0 then
    return query select null::uuid, 'invalid_input'::text;
    return;
  end if;

  insert into public.listings (
    id,
    landlord_id,
    listing_type,
    title,
    property_type,
    price,
    sale_price,
    address,
    latitude,
    longitude,
    status
  )
  values (
    new_listing_id,
    auth.uid(),
    create_listing_draft_checked.listing_type,
    trim(create_listing_draft_checked.title),
    create_listing_draft_checked.property_type,
    stored_price,
    case when create_listing_draft_checked.listing_type = 'sale' then stored_price else null end,
    trim(create_listing_draft_checked.address),
    create_listing_draft_checked.latitude,
    create_listing_draft_checked.longitude,
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

revoke all on function public.create_listing_draft_checked(
  public.listing_type, text, text, integer, integer, text, numeric, numeric
) from public, anon;

grant execute on function public.create_listing_draft_checked(
  public.listing_type, text, text, integer, integer, text, numeric, numeric
) to authenticated;
