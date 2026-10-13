-- Guest contact details are listing content, never private profile contact data.
-- Capture legacy publication IDs once; new drafts cannot acquire an exemption.
begin;
-- This unapplied migration can follow the already deployed media/link releases.
-- Retain their installed validators and extend them with contact validation below.
create temporary table guest_contact_installed_functions on commit drop as
select p.proname, pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='private' and p.proname in
  ('pinpoint_intake_validate','pinpoint_entry_content','pinpoint_service_content','pinpoint_offer_public_snapshot');
create table private.guest_contact_legacy_publications (
  category text not null check (category in ('shopping','entry','service')),
  listing_id uuid not null, public_phone text, primary key(category,listing_id)
);
revoke all on private.guest_contact_legacy_publications from public, anon, authenticated;
insert into private.guest_contact_legacy_publications
  select 'shopping', offer_id, null::text from public.shopping_offer_decisions where action='approve' group by offer_id
  union all select 'entry',id,null::text from public.approved_entry_specials
  union all select 'service',id,content->>'phone' from public.approved_services;

alter table public.shopping_offers add column guest_contact_exempt boolean not null default false;
alter table public.pinpoint_entries add column guest_contact_exempt boolean not null default false;
alter table public.service_submissions add column guest_contact_exempt boolean not null default false;
update public.shopping_offers set guest_contact_exempt=true where id in (select listing_id from private.guest_contact_legacy_publications where category='shopping');
update public.pinpoint_entries set guest_contact_exempt=true where id in (select listing_id from private.guest_contact_legacy_publications where category='entry');
update public.service_submissions set guest_contact_exempt=true where id in (select listing_id from private.guest_contact_legacy_publications where category='service');
create function private.pinpoint_guest_exemption_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='INSERT' then new.guest_contact_exempt := false;
  elsif new.guest_contact_exempt is distinct from old.guest_contact_exempt then
    raise exception 'Publication exemption is immutable' using errcode='42501';
  end if;
  return new;
end;
$$;
revoke all on function private.pinpoint_guest_exemption_guard() from public,anon,authenticated,service_role;
create trigger guest_contact_exemption_offer before insert or update on public.shopping_offers for each row execute function private.pinpoint_guest_exemption_guard();
create trigger guest_contact_exemption_entry before insert or update on public.pinpoint_entries for each row execute function private.pinpoint_guest_exemption_guard();
create trigger guest_contact_exemption_service before insert or update on public.service_submissions for each row execute function private.pinpoint_guest_exemption_guard();

alter table public.listings add column guest_contact_exempt boolean not null default false;
update public.listings set guest_contact_exempt=true where status='published';
comment on column public.listings.guest_contact_exempt is 'Migration-only grandfathering. New drafts require guest contact for publication.';

create function private.pinpoint_contact_validate(content jsonb, required boolean default false)
returns void language plpgsql security invoker set search_path='' as $$
declare contact jsonb := content->'publicContact'; field text; value text;
begin
  if content ? 'contactConsent' and jsonb_typeof(content->'contactConsent') is distinct from 'boolean' then
    raise exception 'Invalid contact consent' using errcode='22023';
  end if;
  if contact is not null then
    if jsonb_typeof(contact) is distinct from 'object' or octet_length(contact::text)>1500
      or exists(select 1 from jsonb_object_keys(contact) k where k not in ('phone','whatsapp','email')) then
      raise exception 'Invalid public contact fields' using errcode='22023';
    end if;
    for field,value in select key,btrim(contact->>key) from jsonb_object_keys(contact) key loop
      if jsonb_typeof(contact->field) is distinct from 'string' then
        raise exception 'Invalid public contact' using errcode='22023';
      end if;
      if field in ('phone','whatsapp') and value !~ '^\+[1-9][0-9]{6,14}$' then
        raise exception 'Use an international public phone number' using errcode='22023';
      end if;
      if field='email' and (char_length(value)>254 or value !~ '^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$') then
        raise exception 'Invalid public email' using errcode='22023';
      end if;
    end loop;
  end if;
  if required and (contact is null or contact='{}'::jsonb or content->'contactConsent' is distinct from 'true'::jsonb) then
    raise exception 'Add a public contact and confirm permission for guest enquiries' using errcode='22023';
  end if;
end;
$$;
revoke all on function private.pinpoint_contact_validate(jsonb,boolean) from public,anon,authenticated;
-- Existing content validators run inside the authenticated, authorized write paths.
grant execute on function private.pinpoint_contact_validate(jsonb,boolean) to service_role;

create or replace function private.pinpoint_intake_validate(content jsonb, complete boolean)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  field text;
  maximum integer;
  start_time timestamptz;
  end_time timestamptz;
begin
  perform private.pinpoint_contact_validate(content,false);
  if content is null or jsonb_typeof(content) <> 'object' or octet_length(content::text) > 30000 then
    raise exception 'Invalid offer content' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_object_keys(content) k where k not in
    ('title','benefit','terms','shopName','areaId','address','latitude','longitude','startsAt','endsAt','publicContact','contactConsent')) then
    raise exception 'Unknown offer fields' using errcode = '22023';
  end if;
  foreach field in array array['title','benefit','terms','shopName','address'] loop
    maximum := case field when 'title' then 160 when 'shopName' then 160 when 'terms' then 4000 else 500 end;
    if (complete or content ? field) and (jsonb_typeof(content->field) is distinct from 'string'
      or char_length(btrim(content->>field)) not between 1 and maximum) then
      raise exception 'Invalid offer text: %', field using errcode = '22023';
    end if;
  end loop;
  if complete or content ? 'areaId' then
    if jsonb_typeof(content->'areaId') is distinct from 'string'
      or (content->>'areaId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Invalid offer place ID' using errcode = '22023';
    end if;
  end if;
  foreach field in array array['latitude','longitude'] loop
    maximum := case field when 'latitude' then 90 else 180 end;
    if complete or content ? field then
      if jsonb_typeof(content->field) is distinct from 'number' then
        raise exception 'Invalid offer coordinate' using errcode = '22023';
      end if;
      if (content->>field)::numeric not between -maximum and maximum then
        raise exception 'Invalid offer coordinate' using errcode = '22023';
      end if;
    end if;
  end loop;
  foreach field in array array['startsAt','endsAt'] loop
    if complete or content ? field then
      if jsonb_typeof(content->field) is distinct from 'string' or (content->>field) !~
        '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$' then
        raise exception 'Invalid offer timestamp' using errcode = '22023';
      end if;
      -- Reject impossible dates as well as missing offsets/infinity.
      perform (content->>field)::timestamptz;
    end if;
  end loop;
  if complete then
    start_time := (content->>'startsAt')::timestamptz;
    end_time := (content->>'endsAt')::timestamptz;
    if start_time >= end_time or end_time <= clock_timestamp() then
      raise exception 'Offer must have an ordered future end' using errcode = '22023';
    end if;
    if not exists (select 1 from public.discovery_places p
      where p.id = (content->>'areaId')::uuid
        and p.level in ('neighbourhood','locality','place','municipality')
        and (content->>'latitude')::double precision between p.south and p.north
        and (content->>'longitude')::double precision between p.west and p.east) then
      raise exception 'Stored place and shop point must agree' using errcode = '22023';
    end if;
  end if;
end;
$$;

create or replace function private.pinpoint_entry_content(content jsonb, complete boolean) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare field text; maximum integer; normalized jsonb := content; start_time timestamptz; end_time timestamptz;
begin
  perform private.pinpoint_contact_validate(content,false);
  if content is null or jsonb_typeof(content) <> 'object' or octet_length(content::text) > 30000 then
    raise exception 'Invalid entry content' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_object_keys(content) k where k not in
    ('title','description','venueName','areaId','address','latitude','longitude','startsAt','endsAt','publicContact','contactConsent')) then
    raise exception 'Unknown entry fields' using errcode = '22023';
  end if;
  foreach field in array array['title','description','venueName','address'] loop
    maximum := case field when 'description' then 4000 when 'address' then 500 else 160 end;
    if complete or content ? field then
      if jsonb_typeof(content->field) is distinct from 'string'
        or char_length(btrim(content->>field)) not between 1 and maximum then
        raise exception 'Invalid entry text: %', field using errcode = '22023';
      end if;
      normalized := jsonb_set(normalized,array[field],to_jsonb(btrim(content->>field)));
    end if;
  end loop;
  if complete or content ? 'areaId' then
    if jsonb_typeof(content->'areaId') is distinct from 'string'
      or (content->>'areaId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Invalid entry place ID' using errcode = '22023';
    end if;
    normalized := jsonb_set(normalized,'{areaId}',to_jsonb(((content->>'areaId')::uuid)::text));
  end if;
  foreach field in array array['latitude','longitude'] loop
    maximum := case field when 'latitude' then 90 else 180 end;
    if complete or content ? field then
      if jsonb_typeof(content->field) is distinct from 'number' then
        raise exception 'Invalid entry coordinate' using errcode = '22023';
      end if;
      if (content->>field)::numeric not between -maximum and maximum then
        raise exception 'Invalid entry coordinate' using errcode = '22023';
      end if;
    end if;
  end loop;
  foreach field in array array['startsAt','endsAt'] loop
    if complete or content ? field then
      if jsonb_typeof(content->field) is distinct from 'string' or (content->>field) !~
        '^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$' then
        raise exception 'Invalid entry timestamp' using errcode = '22023';
      end if;
      begin
        normalized := jsonb_set(normalized,array[field],to_jsonb(to_char(
          (content->>field)::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
      exception when datetime_field_overflow or invalid_datetime_format then
        raise exception 'Invalid entry timestamp' using errcode = '22023';
      end;
    end if;
  end loop;
  if complete then
    start_time := (normalized->>'startsAt')::timestamptz; end_time := (normalized->>'endsAt')::timestamptz;
    if start_time >= end_time or end_time <= clock_timestamp() then
      raise exception 'Entry must have an ordered future end' using errcode = '22023';
    end if;
    -- Catalogue geometry consistency is not proof of venue/provenance/authority.
    if not exists (select 1 from public.discovery_places p
      where p.id = (normalized->>'areaId')::uuid and p.level in ('neighbourhood','locality','place','municipality')
        and (normalized->>'latitude')::double precision between p.south and p.north
        and (normalized->>'longitude')::double precision between p.west and p.east) then
      raise exception 'Stored place and venue point must agree' using errcode = '22023';
    end if;
  end if;
  return normalized;
end;
$$;

create or replace function private.pinpoint_service_content(payload jsonb, complete boolean) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare field text; maximum integer; normalized jsonb := payload;
begin
  perform private.pinpoint_contact_validate(payload,false);
  if payload is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>18000
    or exists(select 1 from jsonb_object_keys(payload) k where k not in
      ('title','providerName','serviceType','description','areaId','address','latitude','longitude','phone','publicContact','contactConsent')) then
    raise exception 'Invalid service fields' using errcode='22023';
  end if;
  foreach field in array array['title','providerName','serviceType','description','address','phone'] loop
    maximum := case field when 'description' then 4000 when 'address' then 500 when 'phone' then 24 else 160 end;
    if complete or payload ? field then
      if jsonb_typeof(payload->field) is distinct from 'string' or char_length(btrim(payload->>field)) not between 1 and maximum then
        raise exception 'Invalid service text' using errcode='22023';
      end if;
      normalized := jsonb_set(normalized,array[field],to_jsonb(btrim(payload->>field)));
    end if;
  end loop;
  if payload ? 'serviceType' and payload->>'serviceType' not in ('Plumbing','Electrical','Cleaning','Gardening','Handyman','Other') then
    raise exception 'Invalid service type' using errcode='22023';
  end if;
  if payload ? 'phone' and payload->>'phone' !~ '^\+?[0-9 ()-]{7,24}$' then
    raise exception 'Invalid phone number' using errcode='22023';
  end if;
  if complete or payload ? 'areaId' then
    if jsonb_typeof(payload->'areaId') is distinct from 'string' or (payload->>'areaId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or not exists(select 1 from public.discovery_places where id=(payload->>'areaId')::uuid) then
      raise exception 'Choose a stored discovery place' using errcode='22023';
    end if;
  end if;
  foreach field in array array['latitude','longitude'] loop
    maximum := case field when 'latitude' then 90 else 180 end;
    if complete or payload ? field then
      if jsonb_typeof(payload->field) is distinct from 'number' or (payload->>field)::numeric not between -maximum and maximum then
        raise exception 'Invalid service coordinates' using errcode='22023';
      end if;
    end if;
  end loop;
  return normalized;
end;
$$;

create or replace function private.pinpoint_offer_public_snapshot(target uuid, at_time timestamptz)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare o public.shopping_offers%rowtype; d public.shopping_offer_decisions%rowtype;
  content jsonb; permission public.shopping_offer_permission_reviews%rowtype;
  location public.shopping_offer_location_reviews%rowtype; place public.discovery_places%rowtype;
  start_time timestamptz; end_time timestamptz; state text; attribution jsonb;
begin
  if target is null or at_time is null or not isfinite(at_time) then return null; end if;
  select * into o from public.shopping_offers where id=target;
  if o.id is null or o.pending_revision_id is not null or o.withdrawn_at is not null
    or not private.pinpoint_offer_poster_eligible(o.poster_id) then return null; end if;
  select * into d from public.shopping_offer_decisions x where x.offer_id=target order by x.version desc limit 1;
  if d.action is distinct from 'approve' or d.poster_id is distinct from o.poster_id or d.version>o.version
    or d.statement_version is distinct from 'admin-offer-approval-v1' then return null; end if;
  select r.content into content from public.shopping_offer_revisions r
    where r.id=d.revision_id and r.offer_id=target and r.poster_id=o.poster_id;
  if content is null then return null; end if;
  -- Validate structure without requiring a future end; expired records must fail
  -- eligibility, not raise errors. Only immutable reviewed content is inspected.
  begin
    perform private.pinpoint_intake_validate(content,false);
    if (select count(*) from jsonb_object_keys(content - 'publicContact' - 'contactConsent'))<>10 then return null; end if;
    start_time := (content->>'startsAt')::timestamptz;
    end_time := (content->>'endsAt')::timestamptz;
    if start_time>=end_time or not isfinite(start_time) or not isfinite(end_time) then return null; end if;
    select * into place from public.discovery_places p where p.id=(content->>'areaId')::uuid;
    if place.id is null or btrim(place.provider_id)='' or place.level not in ('neighbourhood','locality','place','municipality')
      or (content->>'latitude')::double precision not between place.south and place.north
      or (content->>'longitude')::double precision not between place.west and place.east then return null; end if;
  exception when invalid_parameter_value or invalid_text_representation or datetime_field_overflow or numeric_value_out_of_range then
    return null;
  end;
  select * into permission from public.shopping_offer_permission_reviews p where p.id=d.permission_review_id
    and p.offer_id=target and p.revision_id=d.revision_id and p.poster_id=o.poster_id and p.offer_version=d.captured_version
    and p.statement_version='admin-permission-review-v1';
  if permission.id is null or not exists (select 1 from public.shopping_offer_permissions p
    where p.offer_id=target and p.revision_id=d.revision_id and p.poster_id=o.poster_id and p.statement_version='shop-authorization-v1') then return null; end if;
  select * into location from public.shopping_offer_location_reviews l where l.id=d.location_review_id
    and l.offer_id=target and l.revision_id=d.revision_id and l.poster_id=o.poster_id and l.offer_version=d.captured_version
    and l.permission_review_id=permission.id and l.statement_version='admin-location-review-v1';
  if location.id is null or location.place_id is distinct from place.id or location.place_snapshot is distinct from to_jsonb(place) then return null; end if;
  -- Visibility preferences apply at read time. Never expose profiles.full_name,
  -- contact data, private user/reviewer IDs, evidence references or notes.
  select jsonb_build_object('username',p.username,'displayName',p.display_name) into attribution
    from public.public_profiles p where p.profile_id=o.poster_id and p.profile_audience='everyone';
  state := case when at_time<start_time then 'scheduled' when at_time>=end_time then 'expired' else 'live' end;
  return jsonb_build_object('status',state,'offerId',o.id,'revisionId',d.revision_id,'confirmedAt',d.occurred_at,
    'startsAt',start_time,'endsAt',end_time,'areaId',place.id,
    'content',case when state='live' then content else null end,
    'place',case when state='live' then jsonb_build_object('id',place.id,'name',place.name,'region',place.region,'fullAddress',place.full_address) else null end,
    'poster',case when state='live' then attribution else null end);
end;
$$;

-- Triggers are internal invariant checks. Their definer privilege only reads the
-- private, immutable grandfathering set and the reviewed revision on approval.
-- Existing RPC authorization remains responsible for every mutation.
create function private.pinpoint_guest_publication_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare content jsonb; publication_category text; target uuid; exempt boolean; service_phone text; legacy_phone text;
begin
  if tg_table_name='listings' then
    if tg_op='INSERT' then new.guest_contact_exempt := false;
    elsif new.guest_contact_exempt is distinct from old.guest_contact_exempt then
      raise exception 'Publication exemption is immutable' using errcode='42501';
    end if;
    content := coalesce(new.metadata,'{}'::jsonb);
    perform private.pinpoint_contact_validate(content, false);
    if new.status='published' then
      perform private.pinpoint_contact_validate(content, not new.guest_contact_exempt or coalesce(content->'publicContact','{}'::jsonb)<>'{}'::jsonb);
    end if;
    return new;
  elsif tg_table_name='shopping_offer_decisions' then
    if new.action<>'approve' then return new; end if;
    publication_category := 'shopping'; target := new.offer_id;
    select r.content into content from public.shopping_offer_revisions r where r.id=new.revision_id and r.offer_id=target;
  elsif tg_table_name='approved_entry_specials' then
    publication_category := 'entry'; target := new.id; content := new.content;
  elsif tg_table_name='approved_services' then
    publication_category := 'service'; target := new.id; content := new.content;
    service_phone := regexp_replace(content->>'phone','[ ()-]','','g');
    if service_phone ~ '^0[1-9][0-9]{8}$' then service_phone := '+27'||substr(service_phone,2); end if;
    content := content || jsonb_build_object('publicContact',coalesce(content->'publicContact','{}'::jsonb) || jsonb_build_object('phone',service_phone));
  else raise exception 'Unsupported publication table';
  end if;
  select exists(select 1 from private.guest_contact_legacy_publications e where e.category=publication_category and e.listing_id=target) into exempt;
  if publication_category='service' and exempt then
    select regexp_replace(e.public_phone,'[ ()-]','','g') into legacy_phone from private.guest_contact_legacy_publications e where e.category='service' and e.listing_id=target;
    if legacy_phone ~ '^0[1-9][0-9]{8}$' then legacy_phone := '+27'||substr(legacy_phone,2); end if;
    if service_phone is distinct from legacy_phone or coalesce(new.content->'publicContact','{}'::jsonb)<>'{}'::jsonb then
      perform private.pinpoint_contact_validate(content, true);
    else perform private.pinpoint_contact_validate(new.content, false); end if;
  else
    perform private.pinpoint_contact_validate(content, not exempt or coalesce(content->'publicContact','{}'::jsonb)<>'{}'::jsonb);
  end if;
  return new;
end;
$$;
revoke all on function private.pinpoint_guest_publication_guard() from public,anon,authenticated,service_role;
create trigger guest_contact_property_guard before insert or update on public.listings for each row execute function private.pinpoint_guest_publication_guard();
create trigger guest_contact_offer_guard before insert on public.shopping_offer_decisions for each row execute function private.pinpoint_guest_publication_guard();
create trigger guest_contact_entry_guard before insert or update on public.approved_entry_specials for each row execute function private.pinpoint_guest_publication_guard();
create trigger guest_contact_service_guard before insert or update on public.approved_services for each row execute function private.pinpoint_guest_publication_guard();

-- Bounded supplement to the existing spatial RPC. Invoker semantics retain RLS.
create function public.pinpoint_property_contacts(listing_ids uuid[]) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
  if listing_ids is null or cardinality(listing_ids)>500 then
    raise exception 'At most 500 listing IDs are allowed' using errcode='22023';
  end if;
  return coalesce((select jsonb_object_agg(id,metadata->'publicContact') from public.listings
    where id=any(listing_ids) and status='published' and metadata->'contactConsent'='true'::jsonb
      and coalesce(metadata->'publicContact','{}'::jsonb)<>'{}'::jsonb),'{}'::jsonb);
end;
$$;
revoke all on function public.pinpoint_property_contacts(uuid[]) from public,anon,authenticated;
grant execute on function public.pinpoint_property_contacts(uuid[]) to anon,authenticated,service_role;
-- Reconcile with installed definitions instead of removing later extensions.
do $$
declare installed record; source text; anchor text; argument text; position integer;
begin
  for installed in select * from pg_temp.guest_contact_installed_functions loop
    source := installed.definition;
    if installed.proname='pinpoint_offer_public_snapshot' then
      if strpos(source,'jsonb_object_keys(content)')>0 then
        source := replace(source,'jsonb_object_keys(content)',
          'jsonb_object_keys(content - ''publicContact'' - ''contactConsent'')');
      elsif strpos(source,'jsonb_object_keys(content - ''publicContact'' - ''contactConsent''')=0 then
        raise exception 'Expected public snapshot field check missing';
      end if;
    else
      argument := case when installed.proname='pinpoint_service_content' then 'payload' else 'content' end;
      if strpos(source,'''publicContact'',''contactConsent''')=0 then
        anchor := case when strpos(source,'''mediaIds'',''mediaRightsConfirmed''')>0 then '''mediaIds'',''mediaRightsConfirmed'''
          when installed.proname='pinpoint_service_content' then '''phone''))' else '''endsAt''))' end;
        if strpos(source,anchor)=0 then raise exception 'Expected content whitelist missing: %',installed.proname; end if;
        if anchor like '%))' then
          source := replace(source,anchor,left(anchor,length(anchor)-2)||',''publicContact'',''contactConsent''))');
        else
          source := replace(source,anchor,anchor||',''publicContact'',''contactConsent''');
        end if;
      end if;
      if strpos(source,'perform private.pinpoint_contact_validate(')=0 then
        position := strpos(source,E'\nbegin\n');
        if position=0 then raise exception 'Expected content validator body missing: %',installed.proname; end if;
        source := overlay(source placing ' perform private.pinpoint_contact_validate('||argument||',false);'||E'\n' from position+7 for 0);
      end if;
    end if;
    execute source;
  end loop;
end; $$;
commit;
