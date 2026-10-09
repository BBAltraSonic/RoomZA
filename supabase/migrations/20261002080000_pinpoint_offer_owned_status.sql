-- Minimal owned publication summaries. No admin table grants or evidence DTOs.
create function private.pinpoint_offer_owned_status(targets uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare at_time timestamptz := clock_timestamp(); result jsonb;
begin
  if not private.pinpoint_intake_poster() then raise exception 'Current poster session required' using errcode='42501'; end if;
  if targets is null or cardinality(targets) not between 1 and 20
    or array_position(targets,null) is not null or array_ndims(targets)<>1
    or (select count(distinct id) from unnest(targets) id)<>cardinality(targets) then
    raise exception 'One to twenty distinct offer IDs required' using errcode='22023';
  end if;
  if (select count(*) from public.shopping_offers o where o.id=any(targets) and o.poster_id=auth.uid())<>cardinality(targets) then
    raise exception 'Owned offer access required' using errcode='42501';
  end if;
  select jsonb_agg(jsonb_build_object('offerId',o.id,'version',o.version,'checkedAt',at_time,
    'status',case when o.withdrawn_at is not null then 'withdrawn'
      when o.pending_revision_id is not null then 'pending'
      when intake.action='reject' and intake.version>coalesce(d.version,0) then 'needs_confirmation'
      when d.action='unpublish' then 'unpublished'
      when d.action='invalidate' then 'needs_confirmation'
      when d.action='approve' then coalesce(snapshot.value->>'status','unavailable')
      else 'draft' end,
    'revisionId',case when d.action='approve' and o.pending_revision_id is null and o.withdrawn_at is null then d.revision_id else null end,
    'confirmedAt',case when d.action='approve' and o.pending_revision_id is null and o.withdrawn_at is null then d.occurred_at else null end,
    'startsAt',snapshot.value->'startsAt','endsAt',snapshot.value->'endsAt') order by o.id)
    into result from public.shopping_offers o
    left join lateral (select x.action,x.revision_id,x.occurred_at,x.version from public.shopping_offer_decisions x
      where x.offer_id=o.id order by x.version desc limit 1) d on true
    left join lateral (select e.action,e.version from public.shopping_offer_events e
      where e.offer_id=o.id and e.action in ('submit','resubmit','reject','withdraw') order by e.version desc limit 1) intake on true
    left join lateral (select private.pinpoint_offer_public_snapshot(o.id,at_time) as value) snapshot on true
    where o.id=any(targets) and o.poster_id=auth.uid();
  return result;
end;
$$;
create function public.pinpoint_offer_owned_status(targets uuid[])
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin return private.pinpoint_offer_owned_status(targets); end;
$$;
revoke all on function private.pinpoint_offer_owned_status(uuid[]),public.pinpoint_offer_owned_status(uuid[]) from public,anon,authenticated,service_role;
grant execute on function private.pinpoint_offer_owned_status(uuid[]),public.pinpoint_offer_owned_status(uuid[]) to authenticated;
