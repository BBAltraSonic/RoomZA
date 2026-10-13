CREATE OR REPLACE FUNCTION private.pinpoint_entry_public_eligible(target uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists(select 1 from public.approved_entry_specials a
    join public.pinpoint_entries e on e.id=a.id and e.approved_revision_id=a.revision_id
    join public.entry_posters p on p.user_id=e.poster_id and p.category=e.category and p.revoked_at is null
    join auth.users u on u.id=p.user_id join public.profiles profile on profile.id=u.id
    join public.pinpoint_entry_publication_reviews v on v.entry_id=e.id and v.revision_id=a.revision_id
    join public.pinpoint_entry_permissions permission on permission.id=v.permission_id and permission.revision_id=a.revision_id
    join public.discovery_places place on place.id=a.area_id
    where a.id=$1 and e.withdrawn_at is null and e.pending_revision_id is null
      and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
      and (u.banned_until is null or u.banned_until<=statement_timestamp())
      and not exists(select 1 from public.account_suspensions s where s.user_id=e.poster_id and s.restored_at is null
        and (s.suspended_until is null or s.suspended_until>statement_timestamp()))
      and not exists(select 1 from public.trust_document_versions version join public.trust_documents document on document.current_version_id=version.id
        where version.status='published' and version.requires_reacceptance and version.effective_at<=statement_timestamp()
          and not exists(select 1 from public.policy_acceptances acceptance where acceptance.user_id=e.poster_id and acceptance.version_id=version.id))
      and place.id=v.area_id and v.place_snapshot=to_jsonb(place)
      and a.content->>'endsAt' is not null and (a.content->>'endsAt')::timestamptz>statement_timestamp()
      and (a.category='event' or (a.content->>'startsAt')::timestamptz<=statement_timestamp()));
$function$;

CREATE OR REPLACE FUNCTION private.pinpoint_entry_subject_eligible(poster uuid, category text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select auth.uid() is not null and private.pinpoint_intake_reviewer()
    and exists (select 1 from public.entry_posters p join auth.users u on u.id = p.user_id
      join public.profiles profile on profile.id = u.id
      where p.user_id = $1 and p.category = $2 and p.revoked_at is null and u.email_confirmed_at is not null
        and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until <= statement_timestamp()))
    and not exists (select 1 from public.account_suspensions s where s.user_id = $1 and s.restored_at is null
      and (s.suspended_until is null or s.suspended_until > statement_timestamp()))
    and not exists (select 1 from public.trust_document_versions v join public.trust_documents d on d.current_version_id = v.id
      where v.status = 'published' and v.requires_reacceptance and v.effective_at <= statement_timestamp()
        and not exists (select 1 from public.policy_acceptances a where a.user_id = $1 and a.version_id = v.id));
$function$;

CREATE OR REPLACE FUNCTION private.pinpoint_intake_eligible()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select auth.uid() is not null
    and exists (select 1 from auth.users u join public.profiles p on p.id = u.id
      where u.id = auth.uid() and u.email_confirmed_at is not null
        and not coalesce(u.is_anonymous, false)
        and (u.banned_until is null or u.banned_until <= statement_timestamp()))
    and exists (select 1 from auth.sessions s where s.user_id = auth.uid()
      and s.id::text = auth.jwt()->>'session_id'
      and (s.not_after is null or s.not_after > statement_timestamp()))
    and not exists (select 1 from public.account_suspensions s
      where s.user_id = auth.uid() and s.restored_at is null
        and (s.suspended_until is null or s.suspended_until > statement_timestamp()))
    and not exists (select 1 from public.trust_document_versions v
      join public.trust_documents d on d.current_version_id = v.id
      where v.status = 'published' and v.requires_reacceptance
        and v.effective_at <= statement_timestamp()
        and not exists (select 1 from public.policy_acceptances a
          where a.user_id = auth.uid() and a.version_id = v.id));
$function$;

CREATE OR REPLACE FUNCTION private.pinpoint_offer_poster_eligible(poster uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.offer_posters p join auth.users u on u.id=p.user_id
    join public.profiles profile on profile.id=u.id
    where p.user_id=poster and p.revoked_at is null and u.email_confirmed_at is not null
      and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until <= statement_timestamp()))
    and not exists (select 1 from public.account_suspensions s where s.user_id=poster and s.restored_at is null
      and (s.suspended_until is null or s.suspended_until > statement_timestamp()))
    and not exists (select 1 from public.trust_document_versions v join public.trust_documents d on d.current_version_id=v.id
      where v.status='published' and v.requires_reacceptance and v.effective_at <= statement_timestamp()
        and not exists (select 1 from public.policy_acceptances a where a.user_id=poster and a.version_id=v.id));
$function$;

CREATE OR REPLACE FUNCTION private.pinpoint_service_eligible()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select auth.uid() is not null and exists (
    select 1 from auth.users u join public.profiles p on p.id = u.id
    where u.id = auth.uid() and u.email_confirmed_at is not null
      and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until <= statement_timestamp()))
    and exists (select 1 from auth.sessions s where s.user_id = auth.uid()
      and s.id::text = auth.jwt()->>'session_id' and (s.not_after is null or s.not_after > statement_timestamp()))
    and not exists (select 1 from public.account_suspensions s where s.user_id=auth.uid() and s.restored_at is null
      and (s.suspended_until is null or s.suspended_until > statement_timestamp()))
    and not exists (select 1 from public.trust_document_versions v join public.trust_documents d on d.current_version_id=v.id
      where v.status='published' and v.requires_reacceptance and v.effective_at<=statement_timestamp()
      and not exists(select 1 from public.policy_acceptances a where a.user_id=auth.uid() and a.version_id=v.id));
$function$;

CREATE OR REPLACE FUNCTION public.pinpoint_active_session(actor_id uuid, actor_session_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  -- Narrow privileged bridge: service_role has no direct auth.sessions locking grant.
  perform 1 from auth.sessions s join auth.users u on u.id=s.user_id
    where s.id=actor_session_id and s.user_id=actor_id for share of s,u;
  if not found then return false; end if;
  return exists (
    select 1 from auth.sessions s join auth.users u on u.id=s.user_id
      join public.profiles p on p.id=u.id
    where s.id=actor_session_id and s.user_id=actor_id
      and (s.not_after is null or s.not_after > statement_timestamp())
      and u.email_confirmed_at is not null and p.email_verified_at is not null
      and not coalesce(u.is_anonymous,false)
      and (u.banned_until is null or u.banned_until <= statement_timestamp())
      and not exists (select 1 from public.account_suspensions a where a.user_id=u.id
        and a.restored_at is null and (a.suspended_until is null or a.suspended_until > statement_timestamp()))
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.pinpoint_property_lifecycle(actor_id uuid, actor_session_id uuid, target uuid, expected_updated_at timestamp with time zone, command text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.pinpoint_property_save(actor_id uuid, target uuid, expected_updated_at timestamp with time zone, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$;
