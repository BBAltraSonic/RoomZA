-- Additive card media and saved Specials. Existing reviewed revisions remain valid.
begin;
create table public.discovery_media (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete restrict,
 category text not null check(category in ('shopping','tourism','event','service')),
 offer_id uuid references public.shopping_offers(id) on delete restrict,
 entry_id uuid references public.pinpoint_entries(id) on delete restrict,
 service_id uuid references public.service_submissions(id) on delete restrict,
 path text not null unique, mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp')),
 bytes integer not null check(bytes between 1 and 10485760), ready boolean not null default false,
 created_at timestamptz not null default clock_timestamp(),
 check(num_nonnulls(offer_id,entry_id,service_id)=1),
 check((category='shopping' and offer_id is not null) or (category in ('tourism','event') and entry_id is not null) or (category='service' and service_id is not null))
);
create index discovery_media_offer on public.discovery_media(offer_id);
create index discovery_media_entry on public.discovery_media(entry_id);
create index discovery_media_service on public.discovery_media(service_id);
alter table public.discovery_media enable row level security;
revoke all on public.discovery_media from public,anon,authenticated;
create table public.saved_specials (
 user_id uuid not null references auth.users(id) on delete cascade,
 offer_id uuid references public.shopping_offers(id) on delete cascade,
 entry_id uuid references public.pinpoint_entries(id) on delete cascade,
 created_at timestamptz not null default clock_timestamp(), check(num_nonnulls(offer_id,entry_id)=1)
);
create unique index saved_specials_offer_user on public.saved_specials(user_id,offer_id) where offer_id is not null;
create unique index saved_specials_entry_user on public.saved_specials(user_id,entry_id) where entry_id is not null;
create index saved_specials_offer on public.saved_specials(offer_id);
create index saved_specials_entry on public.saved_specials(entry_id);
create index saved_specials_user_created on public.saved_specials(user_id,created_at desc);
-- Reference guards and reviewer reads must not scan the entire revision history.
create index discovery_offer_revision_media on public.shopping_offer_revisions using gin ((content->'mediaIds'));
create index discovery_entry_revision_media on public.pinpoint_entry_revisions using gin ((content->'mediaIds'));
create index discovery_service_submitted_media on public.service_submissions using gin ((submitted->'mediaIds'));
create index discovery_service_event_media on public.service_submission_events using gin ((content->'mediaIds'));
create index discovery_service_approved_media on public.approved_services using gin ((content->'mediaIds'));
alter table public.saved_specials enable row level security;
revoke all on public.saved_specials from public,anon,authenticated;
grant select,insert,delete on public.saved_specials to authenticated;
create policy saved_specials_owner_read on public.saved_specials for select to authenticated using(user_id=(select auth.uid()));
create policy saved_specials_owner_delete on public.saved_specials for delete to authenticated using(user_id=(select auth.uid()));
-- Saves must use the validated RPC; no direct INSERT policy is granted.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('discovery-media','discovery-media',false,10485760,array['image/jpeg','image/png','image/webp']);

create function private.discovery_card_validate(content jsonb,complete boolean,special boolean) returns void
language plpgsql security invoker set search_path='' as $$
declare field text; ids jsonb:=content->'mediaIds';
begin
 if ids is not null and (jsonb_typeof(ids) is distinct from 'array') then raise exception 'Invalid photos' using errcode='22023'; end if;
 if ids is not null then
   if jsonb_array_length(ids)>(case when special then 1 else 20 end)
     or exists(select 1 from jsonb_array_elements(ids) v where jsonb_typeof(v)<>'string' or v#>>'{}' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
     or (select count(*) from jsonb_array_elements(ids))<>(select count(distinct v) from jsonb_array_elements(ids) v) then raise exception 'Invalid photos' using errcode='22023'; end if;
 end if;
 if content ? 'mediaRightsConfirmed' and jsonb_typeof(content->'mediaRightsConfirmed') is distinct from 'boolean' then raise exception 'Invalid photo consent' using errcode='22023'; end if;
 if complete and coalesce(jsonb_array_length(ids),0)>0 and content->'mediaRightsConfirmed' is distinct from 'true'::jsonb then raise exception 'Photo publishing rights required' using errcode='22023'; end if;
 if special then
   foreach field in array array['priceCents','originalPriceCents'] loop
     if content ? field and (jsonb_typeof(content->field) is distinct from 'number' or (content->>field)::numeric<>trunc((content->>field)::numeric) or (content->>field)::numeric not between 0 and 2147483647) then raise exception 'Invalid price' using errcode='22023'; end if;
   end loop;
   if content ? 'originalPriceCents' and (not content ? 'priceCents' or (content->>'originalPriceCents')::numeric<=(content->>'priceCents')::numeric) then raise exception 'Original price must be higher' using errcode='22023'; end if;
 end if;
end; $$;
revoke all on function private.discovery_card_validate(jsonb,boolean,boolean) from public,anon,authenticated;
-- Extend the installed validators without changing contact or publication policy.
-- Supports the live legacy baseline and the separately developed contact baseline.
do $$
declare name text; source text; argument text; anchor text; added text; position integer;
begin
 foreach name in array array['private.pinpoint_intake_validate(jsonb,boolean)','private.pinpoint_entry_content(jsonb,boolean)','private.pinpoint_service_content(jsonb,boolean)'] loop
  source:=pg_get_functiondef(name::regprocedure);
  argument:=case when name like '%service%' then 'payload' else 'content' end;
  added:=',''mediaIds'',''mediaRightsConfirmed'''||case when name like '%service%' then '' else ',''priceCents'',''originalPriceCents''' end;
  anchor:=case when strpos(source,'''publicContact'',''contactConsent''')>0 then '''publicContact'',''contactConsent''' when name like '%service%' then '''phone''))' else '''endsAt''))' end;
  if strpos(source,anchor)=0 then raise exception 'Expected content whitelist missing: %',name; end if;
  if anchor like '%))' then source:=replace(source,anchor,left(anchor,length(anchor)-2)||added||'))'); else source:=replace(source,anchor,anchor||added); end if;
  position:=strpos(source,E'\nbegin\n');
  if position=0 then raise exception 'Expected validator body missing: %',name; end if;
  source:=overlay(source placing ' perform private.discovery_card_validate('||argument||',complete,'||case when name like '%service%' then 'false' else 'true' end||');'||E'\n' from position+7 for 0);
  execute source;
 end loop;
 source:=pg_get_functiondef('private.pinpoint_offer_public_snapshot(uuid,timestamp with time zone)'::regprocedure);
 anchor:=case when strpos(source,$literal$jsonb_object_keys(content - 'publicContact' - 'contactConsent')$literal$)>0 then $literal$jsonb_object_keys(content - 'publicContact' - 'contactConsent')$literal$ else 'jsonb_object_keys(content)' end;
 if strpos(source,anchor)=0 then raise exception 'Expected offer snapshot validation missing'; end if;
 source:=replace(source,anchor,$literal$jsonb_object_keys(content - 'publicContact' - 'contactConsent' - 'mediaIds' - 'mediaRightsConfirmed' - 'priceCents' - 'originalPriceCents')$literal$);
 execute source;
end; $$;

create function private.discovery_media_referenced(media uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.shopping_offer_revisions where content->'mediaIds' @> jsonb_build_array(media::text))
 or exists(select 1 from public.pinpoint_entry_revisions where content->'mediaIds' @> jsonb_build_array(media::text))
 or exists(select 1 from public.service_submissions where submitted->'mediaIds' @> jsonb_build_array(media::text))
 or exists(select 1 from public.service_submission_events where content->'mediaIds' @> jsonb_build_array(media::text))
 or exists(select 1 from public.approved_services where content->'mediaIds' @> jsonb_build_array(media::text)); $$;
create function private.discovery_media_published(media uuid) returns boolean language plpgsql stable security definer set search_path='' as $$
declare item public.discovery_media%rowtype; snapshot jsonb;
begin
 select * into item from public.discovery_media where id=media and ready;
 if item.id is null then return false; end if;
 if item.offer_id is not null then snapshot:=private.pinpoint_offer_public_snapshot(item.offer_id,statement_timestamp()); return coalesce(snapshot->>'status'='live' and snapshot->'content'->'mediaIds' @> jsonb_build_array(media::text),false);
 elsif item.entry_id is not null then return exists(select 1 from public.approved_entry_specials a where a.id=item.entry_id and private.pinpoint_entry_public_eligible(a.id) and (a.category='event' or (a.content->>'startsAt')::timestamptz<=statement_timestamp()) and (a.content->>'endsAt')::timestamptz>statement_timestamp() and a.content->'mediaIds' @> jsonb_build_array(media::text));
 else return exists(select 1 from public.approved_services a where a.id=item.service_id and private.pinpoint_service_visible(a.id) and a.content->'mediaIds' @> jsonb_build_array(media::text)); end if;
end; $$;
create function private.discovery_media_access(object_path text,upload boolean default false) returns boolean language plpgsql stable security definer set search_path='' as $$
declare item public.discovery_media%rowtype;
begin
 select * into item from public.discovery_media where path=object_path;
 if item.id is null then return false; end if;
 if upload then return item.owner_id=auth.uid() and not item.ready; end if;
 return item.owner_id=auth.uid() or ((private.pinpoint_intake_reviewer() or private.pinpoint_service_reviewer()) and private.discovery_media_referenced(item.id)) or private.discovery_media_published(item.id);
end; $$;
revoke all on function private.discovery_media_referenced(uuid),private.discovery_media_published(uuid),private.discovery_media_access(text,boolean) from public,anon,authenticated;
grant execute on function private.discovery_media_access(text,boolean) to anon,authenticated;
create policy discovery_media_insert on storage.objects for insert to authenticated with check(bucket_id='discovery-media' and private.discovery_media_access(name,true));
create policy discovery_media_read on storage.objects for select to anon,authenticated using(bucket_id='discovery-media' and private.discovery_media_access(name,false));
-- Immutable objects: replacements get fresh IDs; no storage UPDATE permission.

create function public.discovery_media_manage(command text,category text,target uuid,expected_version integer default null,media uuid default null,mime text default null,bytes integer default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare subject uuid; version integer; item public.discovery_media%rowtype; new_id uuid; object_path text;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or category not in ('shopping','tourism','event','service') then raise exception 'Sign in required' using errcode='42501'; end if;
 if category='shopping' then select poster_id,o.version into subject,version from public.shopping_offers o where id=target for update;
 elsif category='service' then select poster_id,s.version into subject,version from public.service_submissions s where id=target for update;
 else select poster_id,e.version into subject,version from public.pinpoint_entries e where id=target and e.category=$2 for update; end if;
 if subject is distinct from auth.uid() then raise exception 'Photo owner required' using errcode='42501'; end if;
 if (category='shopping' and not private.pinpoint_offer_poster_eligible(auth.uid())) or (category in ('tourism','event') and not private.pinpoint_entry_subject_eligible(auth.uid(),category)) or (category='service' and not private.pinpoint_service_eligible()) then raise exception 'Active poster required' using errcode='42501'; end if;
 if command='reserve' then
  if version is distinct from expected_version then raise exception 'Draft changed' using errcode='PT409'; end if;
  if mime not in ('image/jpeg','image/png','image/webp') or bytes is null or bytes not between 1 and 10485760 then raise exception 'Invalid image' using errcode='22023'; end if;
  if (select count(*) from public.discovery_media m where m.owner_id=subject and coalesce(m.offer_id,m.entry_id,m.service_id)=target and not private.discovery_media_referenced(m.id))>=(case when category='service' then 40 else 4 end) then raise exception 'Remove unused draft photos first' using errcode='22023'; end if;
  new_id:=gen_random_uuid(); object_path:=subject::text||'/'||target::text||'/'||new_id::text||case mime when 'image/jpeg' then '.jpg' when 'image/png' then '.png' else '.webp' end;
  insert into public.discovery_media(id,owner_id,category,offer_id,entry_id,service_id,path,mime_type,bytes) values(new_id,subject,category,case when category='shopping' then target end,case when category in ('tourism','event') then target end,case when category='service' then target end,object_path,mime,bytes) returning * into item;
 elsif command in ('complete','delete') then
  select * into item from public.discovery_media m where m.id=media and m.owner_id=subject and m.category=$2 and coalesce(m.offer_id,m.entry_id,m.service_id)=target for update;
  if item.id is null then raise exception 'Photo not found' using errcode='42501'; end if;
  if command='complete' then
   if not exists(select 1 from storage.objects o where o.bucket_id='discovery-media' and o.name=item.path and (o.metadata->>'size')::bigint=item.bytes and o.metadata->>'mimetype'=item.mime_type) then raise exception 'Upload incomplete' using errcode='22023'; end if;
   update public.discovery_media m set ready=true where m.id=item.id;
  else
   if private.discovery_media_referenced(item.id) then raise exception 'Submitted photos are immutable; remove the photo from the next draft instead' using errcode='22023'; end if;
   if exists(select 1 from public.shopping_offers where draft->'mediaIds' @> jsonb_build_array(item.id::text)) or exists(select 1 from public.pinpoint_entries where draft->'mediaIds' @> jsonb_build_array(item.id::text)) or exists(select 1 from public.service_submissions where draft->'mediaIds' @> jsonb_build_array(item.id::text)) then raise exception 'Save the draft without this photo before deleting it' using errcode='22023'; end if;
   delete from public.discovery_media m where m.id=item.id;
  end if;
 else raise exception 'Invalid photo command' using errcode='22023'; end if;
 return jsonb_build_object('id',item.id,'path',item.path);
end; $$;
create function public.discovery_media_list(category text,target uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Sign in required' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'path',m.path) order by m.created_at),'[]') from public.discovery_media m where m.category=$1 and coalesce(m.offer_id,m.entry_id,m.service_id)=$2 and m.ready and (m.owner_id=auth.uid() or ((private.pinpoint_intake_reviewer() or private.pinpoint_service_reviewer()) and private.discovery_media_referenced(m.id))));
end; $$;
create function private.discovery_media_scope_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare content jsonb; media_id uuid; card_category text;
begin
 card_category:=case tg_table_name when 'shopping_offers' then 'shopping' when 'pinpoint_entries' then to_jsonb(new)->>'category' else 'service' end;
 for content in select new.draft union all select case when tg_table_name='service_submissions' then to_jsonb(new)->'submitted' else null end loop
  for media_id in select value::uuid from jsonb_array_elements_text(coalesce(content->'mediaIds','[]')) loop
   if not exists(select 1 from public.discovery_media m where m.id=media_id and m.owner_id=new.poster_id and m.category=card_category and coalesce(m.offer_id,m.entry_id,m.service_id)=new.id and m.ready) then raise exception 'Photo must belong to this draft' using errcode='22023'; end if;
  end loop;
 end loop;
 return new;
end; $$;
create trigger discovery_offer_media_scope before insert or update on public.shopping_offers for each row execute function private.discovery_media_scope_guard();
create trigger discovery_entry_media_scope before insert or update on public.pinpoint_entries for each row execute function private.discovery_media_scope_guard();
create trigger discovery_service_media_scope before insert or update on public.service_submissions for each row execute function private.discovery_media_scope_guard();

-- Entry review records distinguish reviewed photos from no-media revisions.
alter table public.pinpoint_entry_publication_reviews drop constraint pinpoint_entry_publication_reviews_media_state_check;
alter table public.pinpoint_entry_publication_reviews add constraint pinpoint_entry_publication_reviews_media_state_check check(media_state in ('none','reviewed'));
do $$ declare source text; begin
 source:=pg_get_functiondef('private.pinpoint_entry_approve(text,uuid,uuid,integer,text,text,text)'::regprocedure);
 if strpos(source,$literal$media_state is distinct from 'none'$literal$)=0 or strpos(source,$literal$select p.id into permission$literal$)=0 or strpos(source,$literal$btrim(location_notes),'none')$literal$)=0 then raise exception 'Expected entry approval checks missing'; end if;
 source:=replace(source,$literal$media_state is distinct from 'none'$literal$,$literal$(media_state is null or media_state not in ('none','reviewed'))$literal$);
 source:=replace(source,$literal$select p.id into permission$literal$, $literal$if (coalesce(jsonb_array_length(content->'mediaIds'),0)>0) <> (media_state='reviewed') then raise exception 'Review photo rights for this revision' using errcode='22023'; end if; select p.id into permission$literal$);
 source:=replace(source,$literal$btrim(location_notes),'none')$literal$,$literal$btrim(location_notes),media_state)$literal$);
 execute source;
end; $$;

create function private.discovery_special_snapshot(category text,target uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare snapshot jsonb;
begin
 if category='shopping' then snapshot:=private.pinpoint_offer_public_snapshot(target,statement_timestamp()); return case when snapshot->>'status'='live' then snapshot end;
 elsif category in ('tourism','event') then
 select jsonb_build_object('entryId',a.id,'category',a.category,'content',a.content,'approvedAt',a.approved_at,'state',case when (a.content->>'startsAt')::timestamptz>statement_timestamp() then 'upcoming' else 'live' end) into snapshot from public.approved_entry_specials a where a.id=target and a.category=$1 and private.pinpoint_entry_public_eligible(a.id) and (a.category='event' or (a.content->>'startsAt')::timestamptz<=statement_timestamp()) and (a.content->>'endsAt')::timestamptz>statement_timestamp(); return snapshot;
 end if; return null;
end; $$;
create function public.discovery_card_presentation(targets jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare target jsonb; snapshot jsonb; category text; target_id uuid; result jsonb:='[]'; paths jsonb; total bigint;
begin
 if jsonb_typeof(targets) is distinct from 'array' or jsonb_array_length(targets)>250 then raise exception 'Invalid targets' using errcode='22023'; end if;
 for target in select value from jsonb_array_elements(targets) loop
  category:=target->>'category'; target_id:=(target->>'id')::uuid;
  if category='service' then select jsonb_build_object('content',a.content) into snapshot from public.approved_services a where a.id=target_id and private.pinpoint_service_visible(a.id); else snapshot:=private.discovery_special_snapshot(category,target_id); end if;
  if snapshot is null then continue; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'path',m.path) order by v.ordinality),'[]') into paths from jsonb_array_elements_text(coalesce(snapshot->'content'->'mediaIds','[]')) with ordinality v(id,ordinality) join public.discovery_media m on m.id=v.id::uuid and m.ready;
  select count(*) into total from public.saved_specials s where (category='shopping' and s.offer_id=target_id) or (category in ('tourism','event') and s.entry_id=target_id);
  result:=result||jsonb_build_array(jsonb_build_object('id',target_id,'category',category,'media',paths,'savedCount',total));
 end loop; return result;
end; $$;
create function public.saved_specials_read(state_only boolean default false) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare targets jsonb; items jsonb; item record; snapshot jsonb;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then return jsonb_build_object('authenticated',false,'targets','[]'::jsonb,'items','[]'::jsonb,'serverNow',statement_timestamp()); end if;
 targets:='[]'; items:='[]';
 for item in select coalesce(s.offer_id,s.entry_id) as id,case when s.offer_id is not null then 'shopping' else e.category end as category from public.saved_specials s left join public.pinpoint_entries e on e.id=s.entry_id where s.user_id=auth.uid() order by s.created_at desc loop
  targets:=targets||jsonb_build_array(jsonb_build_object('id',item.id,'category',item.category));
  if not state_only then snapshot:=private.discovery_special_snapshot(item.category,item.id); items:=items||jsonb_build_array(jsonb_build_object('id',item.id,'category',item.category,'item',snapshot)); end if;
 end loop;
 return jsonb_build_object('authenticated',true,'targets',targets,'items',items,'serverNow',statement_timestamp());
end; $$;
create function public.saved_specials_write(category text,target uuid,save boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare total bigint;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Sign in to save Specials' using errcode='42501'; end if;
 if category='shopping' then perform 1 from public.shopping_offers where id=target for update; elsif category in ('tourism','event') then perform 1 from public.pinpoint_entries e where id=target and e.category=$1 for update; else raise exception 'Invalid Special' using errcode='22023'; end if;
 if save then
  if private.discovery_special_snapshot(category,target) is null then raise exception 'Special is unavailable' using errcode='22023'; end if;
  insert into public.saved_specials(user_id,offer_id,entry_id) values(auth.uid(),case when category='shopping' then target end,case when category<>'shopping' then target end) on conflict do nothing;
 else delete from public.saved_specials s where s.user_id=auth.uid() and ((category='shopping' and s.offer_id=target) or (category in ('tourism','event') and s.entry_id=target)); end if;
 select count(*) into total from public.saved_specials s where (category='shopping' and s.offer_id=target) or (category in ('tourism','event') and s.entry_id=target);
 return jsonb_build_object('saved',save,'savedCount',total);
end; $$;
revoke all on function private.discovery_media_scope_guard(),private.discovery_special_snapshot(text,uuid),public.discovery_media_manage(text,text,uuid,integer,uuid,text,integer),public.discovery_media_list(text,uuid),public.discovery_card_presentation(jsonb),public.saved_specials_read(boolean),public.saved_specials_write(text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.discovery_media_manage(text,text,uuid,integer,uuid,text,integer),public.discovery_media_list(text,uuid),public.saved_specials_write(text,uuid,boolean) to authenticated;
grant execute on function public.discovery_card_presentation(jsonb),public.saved_specials_read(boolean) to anon,authenticated;
commit;
