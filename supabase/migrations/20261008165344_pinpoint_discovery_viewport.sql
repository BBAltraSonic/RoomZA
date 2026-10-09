-- Additive public viewport reads. Existing publication and area-feed APIs are unchanged.
-- Shopping's reviewed snapshot deliberately owns the definer boundary, as in its
-- existing public feed. Entry and Service reads continue to run under caller RLS.
create function public.pinpoint_shopping_viewport(
  west double precision, south double precision, east double precision, north double precision,
  search_query text default '', sort_order text default 'Ending soon'
) returns jsonb language plpgsql security definer set search_path='' as $$
declare at_time timestamptz := statement_timestamp(); result jsonb;
begin
  if (west between -180 and 180 and east between -180 and 180 and south between -85 and 85
      and north between -85 and 85 and west<east and south<north
      and search_query is not null and length(search_query)<=120
      and sort_order in ('Ending soon','Latest','Nearest')) is not true then
    raise exception 'Valid viewport required' using errcode='22023';
  end if;
  with candidates as materialized (
    select o.id,private.pinpoint_offer_public_snapshot(o.id,at_time) as item
    from public.shopping_offers o
    join lateral (select * from public.shopping_offer_decisions d where d.offer_id=o.id order by d.version desc limit 1) d on true
    join public.shopping_offer_revisions r on r.id=d.revision_id and r.offer_id=o.id
    where d.action='approve' and o.pending_revision_id is null and o.withdrawn_at is null
      and (r.content->>'longitude')::double precision between west and east
      and (r.content->>'latitude')::double precision between south and north
  ), eligible as materialized (
    select * from candidates where item->>'status'='live'
      and strpos(lower(concat_ws(' ',item->'content'->>'title',item->'content'->>'benefit',item->'content'->>'shopName',item->'content'->>'address')),lower(trim(search_query)))>0
  ), ordered as (
    select *,row_number() over (order by
      case when sort_order='Ending soon' then (item->>'endsAt')::timestamptz end asc,
      case when sort_order='Latest' then (item->>'confirmedAt')::timestamptz end desc,
      case when sort_order='Nearest' then
        power(sin(radians(((item->'content'->>'latitude')::double precision-(south+north)/2)/2)),2)
        +cos(radians((south+north)/2))*cos(radians((item->'content'->>'latitude')::double precision))
        *power(sin(radians(((item->'content'->>'longitude')::double precision-(west+east)/2)/2)),2) end asc,
      id asc) as position from eligible
  ) select jsonb_build_object('category','shopping','bounds',jsonb_build_object('west',west,'south',south,'east',east,'north',north),
      'serverNow',at_time,'totalCount',(select count(*) from eligible),
      'items',coalesce((select jsonb_agg(item order by position) from ordered where position<=250),'[]'::jsonb)) into result;
  return result;
end;
$$;
revoke all on function public.pinpoint_shopping_viewport(double precision,double precision,double precision,double precision,text,text) from public,anon,authenticated,service_role;
grant execute on function public.pinpoint_shopping_viewport(double precision,double precision,double precision,double precision,text,text) to anon,authenticated;

create function public.pinpoint_discovery_viewport(
  category text, west double precision, south double precision, east double precision, north double precision,
  search_query text default '', sort_order text default 'Ending soon', service_type text default 'All services'
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; at_time timestamptz := statement_timestamp();
begin
  if (category in ('shopping','tourism','event','service')
      and west between -180 and 180 and east between -180 and 180 and south between -85 and 85
      and north between -85 and 85 and west<east and south<north
      and search_query is not null and length(search_query)<=120
      and sort_order in ('Ending soon','Latest','Nearest')
      and service_type in ('All services','Plumbing','Electrical','Cleaning','Gardening','Handyman','Other')
      and (category='service' or service_type='All services')
      and (category<>'service' or sort_order<>'Ending soon')) is not true then
    raise exception 'Valid category and viewport required' using errcode='22023';
  end if;
  if category='shopping' then return public.pinpoint_shopping_viewport(west,south,east,north,search_query,sort_order); end if;
  with candidates as materialized (
    select a.id,a.approved_at,(a.content->>'endsAt')::timestamptz as ends_at,a.content,
      jsonb_build_object('entryId',a.id,'category',a.category,'content',a.content,'approvedAt',a.approved_at,
        'state',case when (a.content->>'startsAt')::timestamptz>at_time then 'upcoming' else 'live' end) as item,
      concat_ws(' ',a.content->>'title',a.content->>'venueName',a.content->>'description',a.content->>'address') as searchable
    from public.approved_entry_specials a where $1 in ('tourism','event') and a.category=$1
      and (a.content->>'longitude')::double precision between west and east
      and (a.content->>'latitude')::double precision between south and north
    union all
    select a.id,a.approved_at,null::timestamptz,a.content,
      jsonb_build_object('id',a.id,'area_id',a.area_id,'content',a.content,'approved_at',a.approved_at),
      concat_ws(' ',a.content->>'title',a.content->>'providerName',a.content->>'serviceType',a.content->>'description',a.content->>'address')
    from public.approved_services a where $1='service'
      and (service_type='All services' or a.content->>'serviceType'=service_type)
      and (a.content->>'longitude')::double precision between west and east
      and (a.content->>'latitude')::double precision between south and north
  ), eligible as materialized (
    select * from candidates where strpos(lower(searchable),lower(trim(search_query)))>0
  ), ordered as (
    select *,row_number() over (order by
      case when sort_order='Ending soon' then ends_at end asc,
      case when sort_order='Latest' then approved_at end desc,
      case when sort_order='Nearest' then
        power(sin(radians(((content->>'latitude')::double precision-(south+north)/2)/2)),2)
        +cos(radians((south+north)/2))*cos(radians((content->>'latitude')::double precision))
        *power(sin(radians(((content->>'longitude')::double precision-(west+east)/2)/2)),2) end asc,
      id asc) as position from eligible
  ) select jsonb_build_object('category',category,'bounds',jsonb_build_object('west',west,'south',south,'east',east,'north',north),
      'serverNow',at_time,'totalCount',(select count(*) from eligible),
      'items',coalesce((select jsonb_agg(item order by position) from ordered where position<=250),'[]'::jsonb)) into result;
  return result;
end;
$$;
revoke all on function public.pinpoint_discovery_viewport(text,double precision,double precision,double precision,double precision,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.pinpoint_discovery_viewport(text,double precision,double precision,double precision,double precision,text,text,text) to anon,authenticated;
