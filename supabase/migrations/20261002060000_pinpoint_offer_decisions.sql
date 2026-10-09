-- Atomic private decisions. Public projection and customer actions are separate.
create table public.shopping_offer_decisions (
  id uuid primary key,
  offer_id uuid not null,
  revision_id uuid not null,
  poster_id uuid not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('approve','invalidate','unpublish')),
  captured_version integer not null check (captured_version > 0),
  version integer not null check (version = captured_version + 1),
  permission_review_id uuid references public.shopping_offer_permission_reviews(id) on delete restrict,
  location_review_id uuid references public.shopping_offer_location_reviews(id) on delete restrict,
  intake_event_id uuid unique references public.shopping_offer_events(id) on delete restrict,
  reason text check (reason is null or char_length(btrim(reason)) between 1 and 2000),
  statement_version text,
  occurred_at timestamptz not null default clock_timestamp(),
  foreign key (offer_id,revision_id) references public.shopping_offer_revisions(offer_id,id) on delete restrict,
  foreign key (offer_id,poster_id) references public.shopping_offers(id,poster_id) on delete restrict,
  unique (offer_id,version),
  check ((action='approve' and permission_review_id is not null and location_review_id is not null and reason is null and statement_version is not distinct from 'admin-offer-approval-v1')
    or (action<>'approve' and permission_review_id is null and location_review_id is null and reason is not null and statement_version is null)),
  check ((action='invalidate') = (intake_event_id is not null))
);
create index shopping_offer_decisions_latest_idx on public.shopping_offer_decisions(offer_id,version desc);
create index shopping_offer_decisions_revision_idx on public.shopping_offer_decisions(revision_id);
create index shopping_offer_decisions_poster_idx on public.shopping_offer_decisions(poster_id);
create index shopping_offer_decisions_actor_idx on public.shopping_offer_decisions(actor_id);
create index shopping_offer_decisions_permission_idx on public.shopping_offer_decisions(permission_review_id);
create index shopping_offer_decisions_location_idx on public.shopping_offer_decisions(location_review_id);
create trigger shopping_offer_decisions_immutable before update or delete on public.shopping_offer_decisions
  for each row execute function private.pinpoint_intake_immutable();
alter table public.shopping_offer_decisions enable row level security;
revoke all on public.shopping_offer_decisions from public, anon, authenticated, service_role;

-- Shared approval/retry gate, callable only inside privileged decision code.
create function private.pinpoint_offer_approval_evidence(
  target uuid, revision uuid, captured_version integer, permission_id uuid, location_id uuid
)
returns void language plpgsql security definer set search_path = '' as $$
declare content jsonb; poster uuid; location public.shopping_offer_location_reviews%rowtype;
  place public.discovery_places%rowtype; latest_permission uuid; latest_location uuid;
begin
  select r.content,o.poster_id into content,poster from public.shopping_offer_revisions r
    join public.shopping_offers o on o.id=r.offer_id and o.poster_id=r.poster_id where r.offer_id=target and r.id=revision;
  if content is null or not private.pinpoint_offer_poster_eligible(poster) then
    raise exception 'Poster is inactive' using errcode='42501';
  end if;
  if not exists (select 1 from public.shopping_offer_permission_reviews r
    join public.shopping_offer_permissions p on p.offer_id=r.offer_id and p.revision_id=r.revision_id and p.poster_id=r.poster_id
    where r.id=permission_id and r.offer_id=target and r.revision_id=revision and r.poster_id=poster and r.offer_version=captured_version
      and r.statement_version='admin-permission-review-v1' and p.statement_version='shop-authorization-v1') then
    raise exception 'Current permission evidence required' using errcode='22023';
  end if;
  select * into location from public.shopping_offer_location_reviews r where r.id=location_id and r.offer_id=target
    and r.revision_id=revision and r.poster_id=poster and r.offer_version=captured_version and r.permission_review_id=permission_id
    and r.statement_version='admin-location-review-v1';
  if location.id is null then raise exception 'Current place/shop/date evidence required' using errcode='22023'; end if;
  select r.id into latest_permission from public.shopping_offer_permission_reviews r where r.offer_id=target
    and r.revision_id=revision and r.offer_version=captured_version order by r.checked_at desc,r.id desc limit 1;
  select r.id into latest_location from public.shopping_offer_location_reviews r where r.offer_id=target
    and r.revision_id=revision and r.offer_version=captured_version order by r.checked_at desc,r.id desc limit 1;
  if latest_permission is distinct from permission_id or latest_location is distinct from location_id then
    raise exception 'Review evidence changed' using errcode='PT409';
  end if;
  select * into place from public.discovery_places p where p.id=(content->>'areaId')::uuid for share;
  if place.id is null or place.id is distinct from location.place_id or to_jsonb(place) is distinct from location.place_snapshot then
    raise exception 'Catalogue place changed' using errcode='PT409';
  end if;
  perform private.pinpoint_intake_validate(content,true);
end;
$$;
revoke all on function private.pinpoint_offer_approval_evidence(uuid,uuid,integer,uuid,uuid) from public, anon, authenticated, service_role;

create function private.pinpoint_offer_approve(
  target uuid, revision uuid, expected_version integer, request_id uuid, permission_review_id uuid, location_review_id uuid,
  approval_confirmed boolean, statement_version text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_offer public.shopping_offers%rowtype; prior public.shopping_offer_decisions%rowtype;
  latest public.shopping_offer_decisions%rowtype; stored public.shopping_offer_decisions%rowtype;
begin
  if not private.pinpoint_intake_reviewer() then raise exception 'Admin membership and MFA required' using errcode='42501'; end if;
  if target is null or revision is null or expected_version is null or expected_version not between 1 and 2147483646
    or request_id is null or permission_review_id is null or location_review_id is null
    or approval_confirmed is distinct from true or statement_version is distinct from 'admin-offer-approval-v1' then
    raise exception 'Explicit current review confirmation required' using errcode='22023';
  end if;
  select * into current_offer from public.shopping_offers where id=target for update;
  if not private.pinpoint_intake_reviewer() then raise exception 'Admin membership and MFA required' using errcode='42501'; end if;
  select * into prior from public.shopping_offer_decisions d where d.id=request_id;
  select * into latest from public.shopping_offer_decisions d where d.offer_id=target order by d.version desc limit 1;
  if prior.id is not null then
    if prior.action<>'approve' or prior.offer_id is distinct from target or prior.revision_id is distinct from revision
      or prior.actor_id is distinct from auth.uid() or prior.captured_version is distinct from expected_version
      or prior.permission_review_id is distinct from permission_review_id or prior.location_review_id is distinct from location_review_id
      or prior.statement_version is distinct from statement_version then
      raise exception 'Decision request ID already used' using errcode='22023';
    end if;
    if current_offer.id is null or latest.id is distinct from prior.id or current_offer.version<>prior.version
      or current_offer.pending_revision_id is not null or current_offer.withdrawn_at is not null then
      raise exception 'Approval is no longer the captured current outcome' using errcode='PT409';
    end if;
    perform private.pinpoint_offer_approval_evidence(target,revision,expected_version,permission_review_id,location_review_id);
    return jsonb_build_object('offerId',target,'revisionId',revision,'version',prior.version,'pendingRevisionId',null,'decisionId',prior.id,'confirmedAt',prior.occurred_at);
  end if;
  if current_offer.id is null or current_offer.version<>expected_version then raise exception 'Offer version conflict' using errcode='PT409'; end if;
  if current_offer.pending_revision_id is distinct from revision or current_offer.withdrawn_at is not null then
    raise exception 'Revision is not awaiting review' using errcode='22023';
  end if;
  perform private.pinpoint_offer_approval_evidence(target,revision,expected_version,permission_review_id,location_review_id);
  update public.shopping_offers set pending_revision_id=null,version=version+1,updated_at=clock_timestamp()
    where id=target returning * into current_offer;
  insert into public.shopping_offer_decisions(id,offer_id,revision_id,poster_id,actor_id,action,captured_version,version,
    permission_review_id,location_review_id,statement_version)
    values(request_id,target,revision,current_offer.poster_id,auth.uid(),'approve',expected_version,current_offer.version,
      permission_review_id,location_review_id,'admin-offer-approval-v1') returning * into stored;
  return jsonb_build_object('offerId',target,'revisionId',revision,'version',stored.version,'pendingRevisionId',null,'decisionId',stored.id,'confirmedAt',stored.occurred_at);
end;
$$;

-- Runs in the original intake transaction; saves leave the confirmed snapshot.
create function private.pinpoint_offer_invalidate_decision()
returns trigger language plpgsql security definer set search_path = '' as $$
declare latest public.shopping_offer_decisions%rowtype;
begin
  if new.action not in ('submit','resubmit','reject','withdraw') or new.offer_id is null then return new; end if;
  select * into latest from public.shopping_offer_decisions d where d.offer_id=new.offer_id order by d.version desc limit 1;
  if latest.action='approve' then
    insert into public.shopping_offer_decisions(id,offer_id,revision_id,poster_id,actor_id,action,captured_version,version,intake_event_id,reason)
      values(gen_random_uuid(),new.offer_id,latest.revision_id,new.poster_id,new.actor_id,'invalidate',new.version-1,new.version,new.id,
        'Intake '||new.action||' removed the earlier approval');
  end if;
  return new;
end;
$$;
revoke all on function private.pinpoint_offer_invalidate_decision() from public, anon, authenticated, service_role;
create trigger shopping_offer_intake_invalidates_decision after insert on public.shopping_offer_events
  for each row execute function private.pinpoint_offer_invalidate_decision();

create function private.pinpoint_offer_unpublish(target uuid, revision uuid, expected_version integer, request_id uuid, reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_offer public.shopping_offers%rowtype; latest public.shopping_offer_decisions%rowtype;
  prior public.shopping_offer_decisions%rowtype; stored public.shopping_offer_decisions%rowtype;
begin
  if not private.pinpoint_intake_reviewer() then raise exception 'Admin membership and MFA required' using errcode='42501'; end if;
  if target is null or revision is null or request_id is null or expected_version is null or expected_version not between 1 and 2147483646
    or reason is null or char_length(btrim(reason)) not between 1 and 2000 then
    raise exception 'Current revision and unpublication reason required' using errcode='22023';
  end if;
  select * into current_offer from public.shopping_offers where id=target for update;
  if not private.pinpoint_intake_reviewer() then raise exception 'Admin membership and MFA required' using errcode='42501'; end if;
  select * into latest from public.shopping_offer_decisions d where d.offer_id=target order by d.version desc limit 1;
  select * into prior from public.shopping_offer_decisions d where d.id=request_id;
  if prior.id is not null then
    if prior.action<>'unpublish' or prior.offer_id is distinct from target or prior.revision_id is distinct from revision
      or prior.actor_id is distinct from auth.uid() or prior.captured_version is distinct from expected_version or prior.reason is distinct from btrim(reason) then
      raise exception 'Decision request ID already used' using errcode='22023';
    end if;
    if current_offer.id is null or latest.id is distinct from prior.id or current_offer.version<>prior.version
      or current_offer.pending_revision_id is not null or current_offer.withdrawn_at is not null then
      raise exception 'Unpublication is no longer the captured current outcome' using errcode='PT409';
    end if;
    return jsonb_build_object('offerId',target,'revisionId',revision,'version',prior.version,'decisionId',prior.id,'unpublishedAt',prior.occurred_at);
  end if;
  if current_offer.id is null or current_offer.version<>expected_version then raise exception 'Offer version conflict' using errcode='PT409'; end if;
  if latest.action is distinct from 'approve' or latest.revision_id is distinct from revision
    or current_offer.pending_revision_id is not null or current_offer.withdrawn_at is not null then
    raise exception 'No current approval to unpublish' using errcode='22023';
  end if;
  -- Removing approval remains possible even if the poster has become inactive.
  update public.shopping_offers set version=version+1,updated_at=clock_timestamp() where id=target returning * into current_offer;
  insert into public.shopping_offer_decisions(id,offer_id,revision_id,poster_id,actor_id,action,captured_version,version,reason)
    values(request_id,target,revision,current_offer.poster_id,auth.uid(),'unpublish',expected_version,current_offer.version,btrim(reason)) returning * into stored;
  return jsonb_build_object('offerId',target,'revisionId',revision,'version',stored.version,'decisionId',stored.id,'unpublishedAt',stored.occurred_at);
end;
$$;

create function private.pinpoint_offer_decision_read(target uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not private.pinpoint_intake_reviewer() then raise exception 'Admin membership and MFA required' using errcode='42501'; end if;
  select jsonb_build_object('offerId',o.id,'version',o.version,'pendingRevisionId',o.pending_revision_id,'withdrawnAt',o.withdrawn_at,
    'decision',jsonb_build_object('id',d.id,'revisionId',d.revision_id,'action',d.action,'actorId',d.actor_id,'capturedVersion',d.captured_version,
      'version',d.version,'reason',d.reason,'occurredAt',d.occurred_at),'content',r.content)
    into result from public.shopping_offers o join lateral (select * from public.shopping_offer_decisions x where x.offer_id=o.id order by x.version desc limit 1) d on true
      join public.shopping_offer_revisions r on r.id=d.revision_id and r.offer_id=o.id where o.id=target;
  return result;
end;
$$;
create function public.pinpoint_offer_approve(target uuid,revision uuid,expected_version integer,request_id uuid,permission_review_id uuid,location_review_id uuid,approval_confirmed boolean,statement_version text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin return private.pinpoint_offer_approve(target,revision,expected_version,request_id,permission_review_id,location_review_id,approval_confirmed,statement_version); end;
$$;
create function public.pinpoint_offer_unpublish(target uuid,revision uuid,expected_version integer,request_id uuid,reason text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin return private.pinpoint_offer_unpublish(target,revision,expected_version,request_id,reason); end;
$$;
create function public.pinpoint_offer_decision_read(target uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin return private.pinpoint_offer_decision_read(target); end;
$$;
revoke all on function private.pinpoint_offer_approve(uuid,uuid,integer,uuid,uuid,uuid,boolean,text),public.pinpoint_offer_approve(uuid,uuid,integer,uuid,uuid,uuid,boolean,text),
  private.pinpoint_offer_unpublish(uuid,uuid,integer,uuid,text),public.pinpoint_offer_unpublish(uuid,uuid,integer,uuid,text),
  private.pinpoint_offer_decision_read(uuid),public.pinpoint_offer_decision_read(uuid) from public, anon, authenticated, service_role;
grant execute on function private.pinpoint_offer_approve(uuid,uuid,integer,uuid,uuid,uuid,boolean,text),public.pinpoint_offer_approve(uuid,uuid,integer,uuid,uuid,uuid,boolean,text),
  private.pinpoint_offer_unpublish(uuid,uuid,integer,uuid,text),public.pinpoint_offer_unpublish(uuid,uuid,integer,uuid,text),
  private.pinpoint_offer_decision_read(uuid),public.pinpoint_offer_decision_read(uuid) to authenticated;
comment on table public.shopping_offer_decisions is 'Private immutable approval, atomic intake invalidation and unpublication history. Latest decision governs approval; no public reads in this slice.';
