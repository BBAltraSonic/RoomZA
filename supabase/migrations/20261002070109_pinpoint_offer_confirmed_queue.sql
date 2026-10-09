-- Current recorded approvals, independent of private draft saves. No new writes,
-- table grants, original intake changes or publication authority.
-- discovery_places.created_at is part of the immutable provenance snapshot.
-- Canonicalize its JSON serialization inside the new review/projection functions:
-- request timezone preferences must not manufacture catalogue drift. Function
-- settings restore the caller setting on return; original intake stays untouched.
alter function private.pinpoint_offer_location_review_read(uuid) set timezone = 'UTC';
alter function private.pinpoint_offer_location_review_write(uuid,uuid,integer,uuid,uuid,jsonb,text,text,text,boolean,boolean,boolean,boolean,text) set timezone = 'UTC';
alter function private.pinpoint_offer_approval_evidence(uuid,uuid,integer,uuid,uuid) set timezone = 'UTC';
alter function private.pinpoint_offer_public_snapshot(uuid,timestamptz) set timezone = 'UTC';

create index shopping_offer_decisions_confirmed_queue_idx
  on public.shopping_offer_decisions (occurred_at desc, offer_id desc) where action = 'approve';

create function private.pinpoint_offer_confirmed_queue(
  after_confirmed_at timestamptz default null, after_offer_id uuid default null
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare at_time timestamptz := statement_timestamp(); result jsonb;
begin
  if not private.pinpoint_intake_reviewer() then
    raise exception 'Admin membership and MFA required' using errcode='42501';
  end if;
  if (after_confirmed_at is null) <> (after_offer_id is null)
    or (after_confirmed_at is not null and not isfinite(after_confirmed_at)) then
    raise exception 'Complete finite confirmed offer cursor required' using errcode='22023';
  end if;
  with candidates as (
    select o.id, o.version, d.revision_id, d.occurred_at, r.content
    from public.shopping_offer_decisions d
      join public.shopping_offers o on o.id=d.offer_id
      join public.shopping_offer_revisions r on r.id=d.revision_id and r.offer_id=o.id
    where d.action='approve' and o.pending_revision_id is null and o.withdrawn_at is null
      and not exists (select 1 from public.shopping_offer_decisions newer where newer.offer_id=d.offer_id and newer.version>d.version)
      and (after_confirmed_at is null or (d.occurred_at,o.id)<(after_confirmed_at,after_offer_id))
    order by d.occurred_at desc,o.id desc limit 21
  ), visible as (select * from candidates order by occurred_at desc,id desc limit 20)
  select jsonb_build_object('checkedAt',at_time,
    'items',coalesce((select jsonb_agg(jsonb_build_object('offerId',id,'version',version,'revisionId',revision_id,
      'title',content->>'title','shopName',content->>'shopName','confirmedAt',occurred_at,
      'publicStatus',coalesce(private.pinpoint_offer_public_snapshot(id,at_time)->>'status','unavailable')) order by occurred_at desc,id desc)
      from visible),'[]'::jsonb),
    'nextCursor',case when (select count(*) from candidates)>20 then
      (select jsonb_build_object('confirmedAt',occurred_at,'offerId',id) from visible order by occurred_at,id limit 1) else null end)
    into result;
  return result;
end;
$$;
create function public.pinpoint_offer_confirmed_queue(after_confirmed_at timestamptz default null, after_offer_id uuid default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin return private.pinpoint_offer_confirmed_queue(after_confirmed_at,after_offer_id); end;
$$;
revoke all on function private.pinpoint_offer_confirmed_queue(timestamptz,uuid), public.pinpoint_offer_confirmed_queue(timestamptz,uuid)
  from public,anon,authenticated,service_role;
grant execute on function private.pinpoint_offer_confirmed_queue(timestamptz,uuid), public.pinpoint_offer_confirmed_queue(timestamptz,uuid)
  to authenticated;
comment on function public.pinpoint_offer_confirmed_queue(timestamptz,uuid) is
  'MFA/session/membership-gated current approvals, 20-row keyset page. Reviewed title/shop, no draft or private evidence; current public status uses the common predicate.';
