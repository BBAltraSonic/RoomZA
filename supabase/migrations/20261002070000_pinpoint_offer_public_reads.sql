-- Read-only public DTOs. Private tables, helper execution and schema grants stay closed.
-- Created with migration new, then ordered after the decision dependency.
create function private.pinpoint_offer_public_snapshot(target uuid, at_time timestamptz)
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
    if (select count(*) from jsonb_object_keys(content))<>10 then return null; end if;
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
revoke all on function private.pinpoint_offer_public_snapshot(uuid,timestamptz) from public,anon,authenticated,service_role;

-- The only privileged anonymous entry points are bounded, read-only DTO
-- wrappers. No anon USAGE/EXECUTE grant is added to private; no base-table grant
-- changes. These deliberately serve identical public data to signed-in viewers.
create function public.pinpoint_offer_public_detail(target uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare at_time timestamptz := clock_timestamp(); snapshot jsonb;
begin
  snapshot := private.pinpoint_offer_public_snapshot(target,at_time);
  return coalesce(snapshot,jsonb_build_object('status','unavailable')) || jsonb_build_object('serverNow',at_time);
end;
$$;

create function public.pinpoint_offer_public_action(target uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare at_time timestamptz := clock_timestamp(); snapshot jsonb;
begin
  snapshot := private.pinpoint_offer_public_snapshot(target,at_time);
  if snapshot->>'status' is distinct from 'live' then return null; end if;
  return jsonb_build_object('offerId',snapshot->'offerId','revisionId',snapshot->'revisionId','serverNow',at_time,
    'endsAt',snapshot->'endsAt','shopName',snapshot->'content'->'shopName','address',snapshot->'content'->'address',
    'latitude',snapshot->'content'->'latitude','longitude',snapshot->'content'->'longitude');
end;
$$;

create function public.pinpoint_offer_public_feed(
  area uuid, after_confirmed_at timestamptz default null, after_offer_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare at_time timestamptz := clock_timestamp(); result jsonb;
begin
  if area is null or ((after_confirmed_at is null)<>(after_offer_id is null))
    or (after_confirmed_at is not null and not isfinite(after_confirmed_at)) then
    raise exception 'Stored area and complete finite cursor required' using errcode='22023';
  end if;
  with candidates as materialized (
    select o.id,d.occurred_at,private.pinpoint_offer_public_snapshot(o.id,at_time) as snapshot
      from public.shopping_offers o
      join lateral (select * from public.shopping_offer_decisions x where x.offer_id=o.id order by x.version desc limit 1) d on true
      join public.shopping_offer_revisions r on r.id=d.revision_id and r.offer_id=o.id
      where d.action='approve' and o.pending_revision_id is null and o.withdrawn_at is null and r.content->>'areaId'=area::text
  ), eligible as materialized (
    select * from candidates where snapshot->>'status'='live'
  ), page as materialized (
    select * from eligible where after_confirmed_at is null or (occurred_at,id)<(after_confirmed_at,after_offer_id)
      order by occurred_at desc,id desc limit 21
  ), visible as (
    select * from page order by occurred_at desc,id desc limit 20
  )
  select jsonb_build_object('serverNow',at_time,'areaId',area,'totalCount',(select count(*) from eligible),
    'items',coalesce((select jsonb_agg(snapshot order by occurred_at desc,id desc) from visible),'[]'::jsonb),
    'nextCursor',case when (select count(*) from page)>20 then
      (select jsonb_build_object('confirmedAt',occurred_at,'offerId',id) from visible order by occurred_at,id limit 1) else null end)
    into result;
  return result;
end;
$$;

create function public.pinpoint_offer_public_count(area uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  result := public.pinpoint_offer_public_feed(area);
  return jsonb_build_object('areaId',result->'areaId','serverNow',result->'serverNow','totalCount',result->'totalCount');
end;
$$;
revoke all on function public.pinpoint_offer_public_detail(uuid),public.pinpoint_offer_public_action(uuid),
  public.pinpoint_offer_public_feed(uuid,timestamptz,uuid),public.pinpoint_offer_public_count(uuid) from public,anon,authenticated,service_role;
grant execute on function public.pinpoint_offer_public_detail(uuid),public.pinpoint_offer_public_action(uuid),
  public.pinpoint_offer_public_feed(uuid,timestamptz,uuid),public.pinpoint_offer_public_count(uuid) to anon,authenticated;
comment on function public.pinpoint_offer_public_feed(uuid,timestamptz,uuid) is
  'Public reviewed offers, read-time eligibility and exact count. Feed and paginated map use the same DTO and predicate. No draft or private evidence access.';
