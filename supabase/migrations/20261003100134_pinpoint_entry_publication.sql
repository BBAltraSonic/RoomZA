-- Additive Tourism/Event publication. Private revision permission and reviewer
-- evidence are never part of the public DTO. Events appear from approval until
-- their end; Tourism appears during its exact availability window.
alter table public.pinpoint_entries add column approved_revision_id uuid;
alter table public.pinpoint_entries add constraint pinpoint_entries_approved_revision_fkey
  foreign key (id,approved_revision_id) references public.pinpoint_entry_revisions(entry_id,id) on delete restrict;
create index pinpoint_entries_approved_revision on public.pinpoint_entries(id,approved_revision_id);

create table public.pinpoint_entry_permissions (
  id uuid primary key default gen_random_uuid(), entry_id uuid not null, revision_id uuid not null,
  poster_id uuid not null, category text not null, statement_version text not null default 'venue-publishing-v1'
    check (statement_version='venue-publishing-v1'), confirmed_at timestamptz not null default clock_timestamp(),
  foreign key(entry_id,poster_id,category) references public.pinpoint_entries(id,poster_id,category) on delete restrict,
  foreign key(entry_id,revision_id) references public.pinpoint_entry_revisions(entry_id,id) on delete restrict,
  unique(revision_id)
);
create index pinpoint_entry_permissions_owner on public.pinpoint_entry_permissions(poster_id,category);
create index pinpoint_entry_permissions_entry on public.pinpoint_entry_permissions(entry_id,poster_id,category);
create index pinpoint_entry_permissions_revision on public.pinpoint_entry_permissions(entry_id,revision_id);
create table public.pinpoint_entry_publication_reviews (
  id uuid primary key default gen_random_uuid(), authority_review_id uuid not null unique default gen_random_uuid(),
  entry_id uuid not null, revision_id uuid not null, poster_id uuid not null, category text not null,
  permission_id uuid not null references public.pinpoint_entry_permissions(id) on delete restrict,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  captured_version integer not null check(captured_version between 1 and 2147483646),
  area_id uuid not null references public.discovery_places(id) on delete restrict, place_snapshot jsonb not null,
  authority_notes text not null check(char_length(btrim(authority_notes)) between 1 and 2000),
  location_notes text not null check(char_length(btrim(location_notes)) between 1 and 2000),
  media_state text not null check(media_state='none'), reviewed_at timestamptz not null default clock_timestamp(),
  foreign key(entry_id,poster_id,category) references public.pinpoint_entries(id,poster_id,category) on delete restrict,
  foreign key(entry_id,revision_id) references public.pinpoint_entry_revisions(entry_id,id) on delete restrict,
  unique(revision_id)
);
create index pinpoint_entry_publication_reviews_owner on public.pinpoint_entry_publication_reviews(poster_id,category);
create index pinpoint_entry_publication_reviews_entry on public.pinpoint_entry_publication_reviews(entry_id,poster_id,category);
create index pinpoint_entry_publication_reviews_revision on public.pinpoint_entry_publication_reviews(entry_id,revision_id);
create index pinpoint_entry_publication_reviews_permission on public.pinpoint_entry_publication_reviews(permission_id);
create index pinpoint_entry_publication_reviews_reviewer on public.pinpoint_entry_publication_reviews(reviewer_id);
create index pinpoint_entry_publication_reviews_area on public.pinpoint_entry_publication_reviews(area_id);
create table public.approved_entry_specials (
  id uuid primary key references public.pinpoint_entries(id) on delete restrict,
  revision_id uuid not null, category text not null check(category in ('tourism','event')),
  area_id uuid not null references public.discovery_places(id) on delete restrict,
  content jsonb not null, approved_at timestamptz not null default clock_timestamp(),
  foreign key(id,revision_id) references public.pinpoint_entry_revisions(entry_id,id) on delete restrict
);
create index approved_entry_specials_revision on public.approved_entry_specials(id,revision_id);
create index approved_entry_specials_area on public.approved_entry_specials(area_id,category,approved_at desc,id);

create function private.pinpoint_entry_public_eligible(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
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
$$;

create function private.pinpoint_entry_confirm_permission(category text,target uuid,revision uuid,expected_version integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item public.pinpoint_entries%rowtype;
begin
  perform private.pinpoint_entry_category(category);
  if not private.pinpoint_entry_active(category) then raise exception 'Category poster required' using errcode='42501'; end if;
  perform 1 from public.entry_posters p where p.user_id=auth.uid() and p.category=$1 for update;
  select * into item from public.pinpoint_entries e where e.id=target for update;
  if not private.pinpoint_entry_active(category) or item.poster_id is distinct from auth.uid() or item.category is distinct from category then
    raise exception 'Entry owner required' using errcode='42501'; end if;
  if expected_version is null or item.version<>expected_version then raise exception 'Entry changed' using errcode='PT409'; end if;
  if revision is null or item.pending_revision_id is distinct from revision or item.withdrawn_at is not null then
    raise exception 'Pending submitted revision required' using errcode='22023'; end if;
  perform private.pinpoint_entry_content(r.content,true) from public.pinpoint_entry_revisions r where r.entry_id=target and r.id=revision;
  insert into public.pinpoint_entry_permissions(entry_id,revision_id,poster_id,category) values(target,revision,auth.uid(),category)
    on conflict(revision_id) do nothing;
  return jsonb_build_object('entryId',target,'category',category,'revisionId',revision,'confirmed',true,'version',item.version);
end;
$$;

create function private.pinpoint_entry_review_queue() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not private.pinpoint_intake_reviewer() then raise exception 'Admin membership and MFA required' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(item)),'[]') from (
    select e.id as "entryId",e.category,e.version,e.poster_id as "posterId",r.id as "revisionId",r.content,r.submitted_at as "submittedAt",
      e.pending_revision_id is not null as pending,e.approved_revision_id is not null as published,
      exists(select 1 from public.pinpoint_entry_permissions permission where permission.revision_id=r.id) as "permissionConfirmed"
    from public.pinpoint_entries e join public.pinpoint_entry_revisions r on r.id=coalesce(e.pending_revision_id,e.approved_revision_id)
    where e.withdrawn_at is null order by (e.pending_revision_id is not null) desc,e.updated_at,e.id limit 100
  ) item);
end;
$$;

create function private.pinpoint_entry_approve(category text,target uuid,revision uuid,expected_version integer,authority_notes text,location_notes text,media_state text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item public.pinpoint_entries%rowtype; subject uuid; content jsonb; permission uuid; place public.discovery_places%rowtype;
begin
  if not private.pinpoint_intake_reviewer() then raise exception 'Admin membership and MFA required' using errcode='42501'; end if;
  perform private.pinpoint_entry_category(category);
  if authority_notes is null or char_length(btrim(authority_notes)) not between 1 and 2000
    or location_notes is null or char_length(btrim(location_notes)) not between 1 and 2000 or media_state is distinct from 'none' then
    raise exception 'Authority, venue/location and no-media review required' using errcode='22023'; end if;
  select e.poster_id into subject from public.pinpoint_entries e where e.id=target and e.category=$1;
  perform 1 from public.entry_posters p where p.user_id=subject and p.category=$1 for update;
  select * into item from public.pinpoint_entries e where e.id=target for update;
  if item.id is null or expected_version is null or expected_version not between 1 and 2147483646 or item.version<>expected_version then
    raise exception 'Entry changed' using errcode='PT409'; end if;
  if not private.pinpoint_intake_reviewer() or not private.pinpoint_entry_subject_eligible(subject,category) then
    raise exception 'Current reviewer and active poster required' using errcode='42501'; end if;
  if item.withdrawn_at is not null or revision is null or item.pending_revision_id is distinct from revision then
    raise exception 'Pending revision required' using errcode='PT409'; end if;
  select private.pinpoint_entry_content(r.content,true) into content from public.pinpoint_entry_revisions r where r.entry_id=target and r.id=revision;
  select p.id into permission from public.pinpoint_entry_permissions p where p.entry_id=target and p.revision_id=revision and p.poster_id=subject;
  if permission is null or content is null then raise exception 'Revision publishing permission required' using errcode='22023'; end if;
  select * into place from public.discovery_places p where p.id=(content->>'areaId')::uuid for share;
  insert into public.pinpoint_entry_publication_reviews(entry_id,revision_id,poster_id,category,permission_id,reviewer_id,captured_version,area_id,place_snapshot,authority_notes,location_notes,media_state)
    values(target,revision,subject,category,permission,auth.uid(),item.version,place.id,to_jsonb(place),btrim(authority_notes),btrim(location_notes),'none');
  update public.pinpoint_entries set pending_revision_id=null,approved_revision_id=revision,version=version+1,updated_at=clock_timestamp()
    where id=target returning * into item;
  insert into public.approved_entry_specials(id,revision_id,category,area_id,content) values(target,revision,category,place.id,content)
    on conflict(id) do update set revision_id=excluded.revision_id,category=excluded.category,area_id=excluded.area_id,content=excluded.content,approved_at=clock_timestamp();
  insert into public.pinpoint_entry_events(poster_id,category,entry_id,revision_id,actor_id,action,version)
    values(subject,category,target,revision,auth.uid(),'approve',item.version);
  return jsonb_build_object('entryId',target,'category',category,'version',item.version,'pendingRevisionId',null);
end;
$$;

create function private.pinpoint_entry_unpublish(category text,target uuid,expected_version integer,reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item public.pinpoint_entries%rowtype; subject uuid; revision uuid;
begin
  if not private.pinpoint_intake_reviewer() then raise exception 'Admin membership and MFA required' using errcode='42501'; end if;
  perform private.pinpoint_entry_category(category);
  if reason is null or char_length(btrim(reason)) not between 1 and 2000 then raise exception 'Removal reason required' using errcode='22023'; end if;
  select e.poster_id into subject from public.pinpoint_entries e where e.id=target and e.category=$1;
  perform 1 from public.entry_posters p where p.user_id=subject and p.category=$1 for update;
  select * into item from public.pinpoint_entries e where e.id=target for update;
  if item.category is distinct from category then raise exception 'Matching entry category required' using errcode='42501'; end if;
  if item.id is null or expected_version is null or expected_version not between 1 and 2147483646 or item.version<>expected_version then
    raise exception 'Entry changed' using errcode='PT409'; end if;
  if not private.pinpoint_intake_reviewer() then raise exception 'Admin membership and MFA required' using errcode='42501'; end if;
  revision:=item.approved_revision_id;
  if revision is null then raise exception 'No approved revision' using errcode='PT409'; end if;
  update public.pinpoint_entries set approved_revision_id=null,version=version+1,updated_at=clock_timestamp() where id=target returning * into item;
  insert into public.pinpoint_entry_events(poster_id,category,entry_id,revision_id,actor_id,action,version)
    values(subject,category,target,revision,auth.uid(),'unpublish',item.version);
  -- The append-only audit retains the reviewer reason without making it public.
  insert into public.pinpoint_entry_removals(entry_id,revision_id,reviewer_id,reason) values(target,revision,auth.uid(),btrim(reason));
  return jsonb_build_object('entryId',target,'category',category,'version',item.version,'pendingRevisionId',item.pending_revision_id);
end;
$$;
create table public.pinpoint_entry_removals (
  id uuid primary key default gen_random_uuid(),entry_id uuid not null,revision_id uuid not null,
  reviewer_id uuid not null references auth.users(id) on delete restrict,reason text not null check(char_length(btrim(reason)) between 1 and 2000),
  occurred_at timestamptz not null default clock_timestamp(),
  foreign key(entry_id,revision_id) references public.pinpoint_entry_revisions(entry_id,id) on delete restrict
);
create index pinpoint_entry_removals_revision on public.pinpoint_entry_removals(entry_id,revision_id);
create index pinpoint_entry_removals_reviewer on public.pinpoint_entry_removals(reviewer_id);

create function private.pinpoint_entry_invalidate_publication() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_when='BEFORE' then
    if new.withdrawn_at is not null or (new.pending_revision_id is not null and new.pending_revision_id is distinct from old.pending_revision_id) then
      new.approved_revision_id:=null;
    end if;
    return new;
  end if;
  if new.approved_revision_id is null or new.pending_revision_id is not null or new.withdrawn_at is not null then
    delete from public.approved_entry_specials where id=new.id;
  end if;
  return new;
end;
$$;
create trigger pinpoint_entry_invalidate_before before update on public.pinpoint_entries for each row execute function private.pinpoint_entry_invalidate_publication();
create trigger pinpoint_entry_invalidate_after after update on public.pinpoint_entries for each row execute function private.pinpoint_entry_invalidate_publication();
alter table public.pinpoint_entry_events drop constraint pinpoint_entry_events_action_check;
alter table public.pinpoint_entry_events add constraint pinpoint_entry_events_action_check check(action in ('enroll','create','save','submit','withdraw','reject','approve','unpublish'));
alter table public.pinpoint_entry_events drop constraint pinpoint_entry_events_actor_check;
alter table public.pinpoint_entry_events add constraint pinpoint_entry_events_actor_check
  check(actor_id=poster_id or action in ('reject','approve','unpublish'));

create function private.pinpoint_entry_publication_evidence(category text,target uuid,revision uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not private.pinpoint_intake_reviewer() then raise exception 'Admin membership and MFA required' using errcode='42501'; end if;
  return (select jsonb_build_object('entryId',v.entry_id,'revisionId',v.revision_id,'category',v.category,'areaId',v.area_id,
    'placeReviewId',v.id,'authorityReviewId',v.authority_review_id,'mediaState',v.media_state)
    from public.pinpoint_entry_publication_reviews v where v.entry_id=target and v.revision_id=revision and v.category=$1);
end;
$$;

alter table public.pinpoint_entry_permissions enable row level security;
alter table public.pinpoint_entry_publication_reviews enable row level security;
alter table public.pinpoint_entry_removals enable row level security;
alter table public.approved_entry_specials enable row level security;
revoke all on public.pinpoint_entry_permissions,public.pinpoint_entry_publication_reviews,public.pinpoint_entry_removals,public.approved_entry_specials from public,anon,authenticated,service_role;
grant select on public.pinpoint_entry_permissions,public.pinpoint_entry_publication_reviews,public.pinpoint_entry_removals to authenticated,service_role;
grant select on public.approved_entry_specials to anon,authenticated,service_role;
create policy entry_permissions_read on public.pinpoint_entry_permissions for select to authenticated
  using((poster_id=(select auth.uid()) and private.pinpoint_entry_active(category)) or (select private.pinpoint_intake_reviewer()));
create policy entry_publication_reviews_read on public.pinpoint_entry_publication_reviews for select to authenticated
  using((poster_id=(select auth.uid()) and private.pinpoint_entry_active(category)) or (select private.pinpoint_intake_reviewer()));
create policy entry_removals_read on public.pinpoint_entry_removals for select to authenticated using((select private.pinpoint_intake_reviewer()));
create policy approved_entry_specials_read on public.approved_entry_specials for select to anon,authenticated using(private.pinpoint_entry_public_eligible(id));
create trigger entry_permissions_immutable before update or delete on public.pinpoint_entry_permissions for each row execute function private.pinpoint_entry_immutable();
create trigger entry_publication_reviews_immutable before update or delete on public.pinpoint_entry_publication_reviews for each row execute function private.pinpoint_entry_immutable();
create trigger entry_removals_immutable before update or delete on public.pinpoint_entry_removals for each row execute function private.pinpoint_entry_immutable();

create function public.pinpoint_entry_confirm_permission(category text,target uuid,revision uuid,expected_version integer) returns jsonb language sql security invoker set search_path='' as $$ select private.pinpoint_entry_confirm_permission(category,target,revision,expected_version); $$;
create function public.pinpoint_entry_review_queue() returns jsonb language sql security invoker set search_path='' as $$ select private.pinpoint_entry_review_queue(); $$;
create function public.pinpoint_entry_approve(category text,target uuid,revision uuid,expected_version integer,authority_notes text,location_notes text,media_state text) returns jsonb language sql security invoker set search_path='' as $$ select private.pinpoint_entry_approve(category,target,revision,expected_version,authority_notes,location_notes,media_state); $$;
create function public.pinpoint_entry_unpublish(category text,target uuid,expected_version integer,reason text) returns jsonb language sql security invoker set search_path='' as $$ select private.pinpoint_entry_unpublish(category,target,expected_version,reason); $$;
create function public.pinpoint_entry_publication_evidence(category text,target uuid,revision uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.pinpoint_entry_publication_evidence(category,target,revision); $$;
revoke all on function private.pinpoint_entry_public_eligible(uuid),private.pinpoint_entry_confirm_permission(text,uuid,uuid,integer),private.pinpoint_entry_review_queue(),private.pinpoint_entry_approve(text,uuid,uuid,integer,text,text,text),private.pinpoint_entry_unpublish(text,uuid,integer,text),private.pinpoint_entry_invalidate_publication(),private.pinpoint_entry_publication_evidence(text,uuid,uuid),public.pinpoint_entry_confirm_permission(text,uuid,uuid,integer),public.pinpoint_entry_review_queue(),public.pinpoint_entry_approve(text,uuid,uuid,integer,text,text,text),public.pinpoint_entry_unpublish(text,uuid,integer,text),public.pinpoint_entry_publication_evidence(text,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.pinpoint_entry_public_eligible(uuid) to anon,authenticated;
grant execute on function private.pinpoint_entry_confirm_permission(text,uuid,uuid,integer),private.pinpoint_entry_review_queue(),private.pinpoint_entry_approve(text,uuid,uuid,integer,text,text,text),private.pinpoint_entry_unpublish(text,uuid,integer,text),private.pinpoint_entry_publication_evidence(text,uuid,uuid),public.pinpoint_entry_confirm_permission(text,uuid,uuid,integer),public.pinpoint_entry_review_queue(),public.pinpoint_entry_approve(text,uuid,uuid,integer,text,text,text),public.pinpoint_entry_unpublish(text,uuid,integer,text),public.pinpoint_entry_publication_evidence(text,uuid,uuid) to authenticated;
comment on table public.approved_entry_specials is 'Safe approved Tourism/Event content; current poster, reviewed place, exact dates and atomic removal gate public reads. No private authority or permission notes.';

create function private.pinpoint_entry_owner_publication(category text,target uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item public.pinpoint_entries%rowtype; content jsonb; state text; correction text;
begin
  perform private.pinpoint_entry_category(category);
  if not private.pinpoint_entry_active(category) then raise exception 'Category poster required' using errcode='42501'; end if;
  select * into item from public.pinpoint_entries e where e.id=target and e.category=$1 and e.poster_id=auth.uid();
  if item.id is null then raise exception 'Entry owner required' using errcode='42501'; end if;
  select r.content into content from public.pinpoint_entry_revisions r where r.entry_id=target and r.id=item.approved_revision_id;
  state:=case when item.withdrawn_at is not null then 'withdrawn' when item.pending_revision_id is not null then 'awaiting_review'
    when content is not null and (content->>'endsAt')::timestamptz<=statement_timestamp() then 'ended'
    when content is not null and (content->>'startsAt')::timestamptz>statement_timestamp() then 'scheduled'
    when content is not null then 'available'
    when exists(select 1 from public.pinpoint_entry_removals removal where removal.entry_id=target) then 'unpublished' else 'private' end;
  select c.reason into correction from public.pinpoint_entry_corrections c where c.entry_id=target order by c.version desc limit 1;
  return jsonb_build_object('state',state,'permissionConfirmed',exists(select 1 from public.pinpoint_entry_permissions permission
    where permission.entry_id=target and permission.revision_id=item.pending_revision_id),'correction',correction);
end;
$$;
create function public.pinpoint_entry_owner_publication(category text,target uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.pinpoint_entry_owner_publication(category,target); $$;
revoke all on function private.pinpoint_entry_owner_publication(text,uuid),public.pinpoint_entry_owner_publication(text,uuid) from public,anon,authenticated,service_role;
grant execute on function private.pinpoint_entry_owner_publication(text,uuid),public.pinpoint_entry_owner_publication(text,uuid) to authenticated;

create function public.pinpoint_entry_public_feed(category text,area uuid,page integer default 1) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare count_total bigint; items jsonb;
begin
  if category is null or category not in ('tourism','event') or area is null or page is null or page not between 1 and 10000 then
    raise exception 'Valid special category, location and page required' using errcode='22023'; end if;
  select count(*) into count_total from public.approved_entry_specials a where a.category=$1 and a.area_id=area;
  select coalesce(jsonb_agg(item),'[]') into items from (
    select jsonb_build_object('entryId',a.id,'category',a.category,'content',a.content,'approvedAt',a.approved_at,
      'state',case when (a.content->>'startsAt')::timestamptz>statement_timestamp() then 'upcoming' else 'live' end) as item
    from public.approved_entry_specials a where a.category=$1 and a.area_id=area
    order by a.approved_at desc,a.id limit 20 offset ((page-1)*20)
  ) page_items;
  return jsonb_build_object('category',category,'areaId',area,'page',page,'totalCount',count_total,'items',items,
    'hasNext',count_total>page*20,'serverNow',statement_timestamp());
end;
$$;
create function public.pinpoint_entry_public_detail(target uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('serverNow',statement_timestamp(),'item',(select jsonb_build_object('entryId',a.id,'category',a.category,'content',a.content,'approvedAt',a.approved_at,
    'state',case when (a.content->>'startsAt')::timestamptz>statement_timestamp() then 'upcoming' else 'live' end)
    from public.approved_entry_specials a where a.id=target));
$$;
revoke all on function public.pinpoint_entry_public_feed(text,uuid,integer),public.pinpoint_entry_public_detail(uuid) from public,anon,authenticated,service_role;
grant execute on function public.pinpoint_entry_public_feed(text,uuid,integer),public.pinpoint_entry_public_detail(uuid) to anon,authenticated;
